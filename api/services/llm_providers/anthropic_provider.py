"""Anthropic Claude provider — wraps existing SDK logic."""

import logging
from typing import Any, AsyncGenerator

import anthropic

from config import settings
from services.llm_providers.base import LLMProvider, ToolUseResult  # noqa: F401

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 30  # Support skills with many tool calls (briefings, research)


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API provider with per-key client pooling."""

    def __init__(self) -> None:
        self._clients: dict[str, anthropic.AsyncAnthropic] = {}

    # ── Client pool ──────────────────────────────

    def _get_client(self, api_key: str | None = None) -> anthropic.AsyncAnthropic:
        key = api_key or settings.anthropic_api_key
        if not key:
            raise ValueError(
                "No Anthropic API key configured. "
                "Set ANTHROPIC_API_KEY in .env or save a key in Settings > KI-Modelle."
            )
        if key not in self._clients:
            self._clients[key] = anthropic.AsyncAnthropic(api_key=key)
        return self._clients[key]

    # ── Helpers ───────────────────────────────────

    @staticmethod
    def _build_kwargs(
        messages: list[dict],
        model: str,
        max_tokens: int,
        temperature: float,
        system_prompt: str | None,
        tools: list[dict] | None,
    ) -> dict:
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        if tools:
            kwargs["tools"] = tools
        return kwargs

    # ── Public API ────────────────────────────────

    async def complete(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> str:
        client = self._get_client(api_key)
        kwargs = self._build_kwargs(
            messages, model, max_tokens, temperature, system_prompt, tools
        )
        response = await client.messages.create(**kwargs)
        text_parts = [
            block.text for block in response.content if hasattr(block, "text")
        ]
        return "".join(text_parts) if text_parts else ""

    async def complete_raw(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> Any:
        client = self._get_client(api_key)
        kwargs = self._build_kwargs(
            messages, model, max_tokens, temperature, system_prompt, tools
        )
        return await client.messages.create(**kwargs)

    async def complete_with_tool_handling(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        tool_executor: Any = None,
    ) -> ToolUseResult:
        if not tools or not tool_executor:
            text = await self.complete(
                messages=messages,
                system_prompt=system_prompt,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                api_key=api_key,
            )
            return ToolUseResult(text=text)

        working_messages = list(messages)
        result = ToolUseResult(text="")

        for round_num in range(MAX_TOOL_ROUNDS):
            response = await self.complete_raw(
                messages=working_messages,
                system_prompt=system_prompt,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                api_key=api_key,
                tools=tools,
            )

            if response.stop_reason != "tool_use":
                text_parts = [
                    block.text
                    for block in response.content
                    if hasattr(block, "text")
                ]
                result.text = "".join(text_parts)
                break

            tool_use_blocks = [
                block
                for block in response.content
                if block.type == "tool_use"
            ]

            if not tool_use_blocks:
                text_parts = [
                    block.text
                    for block in response.content
                    if hasattr(block, "text")
                ]
                result.text = "".join(text_parts)
                break

            working_messages.append({
                "role": "assistant",
                "content": [
                    block.model_dump() if hasattr(block, "model_dump") else block
                    for block in response.content
                ],
            })

            tool_results_content = []
            for tool_block in tool_use_blocks:
                tool_name = tool_block.name
                tool_input = tool_block.input
                tool_use_id = tool_block.id

                logger.info(
                    "Tool call round %d: %s with input %s",
                    round_num + 1,
                    tool_name,
                    tool_input,
                )

                if result.skill_used is None:
                    result.skill_used = tool_name

                result.tool_calls.append({
                    "name": tool_name,
                    "input": tool_input,
                    "round": round_num + 1,
                })

                try:
                    tool_result_str = await tool_executor(tool_name, tool_input)
                except Exception as exc:
                    logger.error("Tool execution failed for %s: %s", tool_name, exc)
                    tool_result_str = f"Error executing skill '{tool_name}': {str(exc)}"

                tool_results_content.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": tool_result_str,
                })

            working_messages.append({
                "role": "user",
                "content": tool_results_content,
            })
        else:
            logger.warning(
                "Max tool rounds (%d) reached, making final call without tools",
                MAX_TOOL_ROUNDS,
            )
            result.text = await self.complete(
                messages=working_messages,
                system_prompt=system_prompt,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                api_key=api_key,
                tools=None,
            )

        return result

    async def stream(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        client = self._get_client(api_key)
        kwargs = self._build_kwargs(
            messages, model, max_tokens, temperature, system_prompt, tools
        )
        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text

    async def stream_raw_events(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 16384,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        client = self._get_client(api_key)
        kwargs = self._build_kwargs(
            messages, model, max_tokens, temperature, system_prompt, tools
        )
        async with client.messages.stream(**kwargs) as stream:
            async for event in stream:
                if event.type == "content_block_start":
                    block = event.content_block
                    if block.type == "tool_use":
                        yield {
                            "event": "tool_start",
                            "index": event.index,
                            "tool_name": block.name,
                            "tool_id": block.id,
                        }
                elif event.type == "content_block_delta":
                    delta = event.delta
                    if delta.type == "text_delta":
                        yield {"event": "text_delta", "text": delta.text}
                    elif delta.type == "input_json_delta":
                        yield {
                            "event": "tool_delta",
                            "index": event.index,
                            "partial_json": delta.partial_json,
                        }
                elif event.type == "content_block_stop":
                    yield {"event": "tool_end", "index": event.index}
                elif event.type == "message_delta":
                    yield {
                        "event": "message_end",
                        "stop_reason": event.delta.stop_reason,
                    }
            final = await stream.get_final_message()
            yield {"event": "final_message", "message": final}

    async def close(self) -> None:
        for client in self._clients.values():
            await client.close()
        self._clients.clear()
