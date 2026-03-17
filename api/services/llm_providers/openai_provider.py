"""OpenAI provider — GPT-4o, o3 family via openai SDK."""

import json
import logging
import uuid
from typing import Any, AsyncGenerator

from config import settings
from services.llm_providers.base import LLMProvider, ToolUseResult  # noqa: F401

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 30


def _convert_tools_to_openai(tools: list[dict] | None) -> list[dict] | None:
    """Convert Anthropic-style tool defs to OpenAI function-calling format."""
    if not tools:
        return None
    openai_tools = []
    for t in tools:
        openai_tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
            },
        })
    return openai_tools


def _build_openai_messages(
    messages: list[dict],
    system_prompt: str | None,
) -> list[dict]:
    """
    Build OpenAI-compatible message list.
    - System prompt becomes first message with role "system"
    - Tool result messages get mapped to the 'tool' role
    """
    out: list[dict] = []
    if system_prompt:
        out.append({"role": "system", "content": system_prompt})

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content")

        # Handle Anthropic-style tool_result messages
        if role == "user" and isinstance(content, list):
            # Check if this is a list of tool_results
            if content and isinstance(content[0], dict) and content[0].get("type") == "tool_result":
                for tr in content:
                    out.append({
                        "role": "tool",
                        "tool_call_id": tr.get("tool_use_id", ""),
                        "content": tr.get("content", ""),
                    })
                continue

        # Handle assistant messages with tool_use blocks (Anthropic format)
        if role == "assistant" and isinstance(content, list):
            text_parts = []
            tool_calls = []
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif block.get("type") == "tool_use":
                        tool_calls.append({
                            "id": block.get("id", str(uuid.uuid4())),
                            "type": "function",
                            "function": {
                                "name": block["name"],
                                "arguments": json.dumps(block.get("input", {})),
                            },
                        })
            assistant_msg: dict[str, Any] = {"role": "assistant"}
            if text_parts:
                assistant_msg["content"] = "".join(text_parts)
            else:
                assistant_msg["content"] = None
            if tool_calls:
                assistant_msg["tool_calls"] = tool_calls
            out.append(assistant_msg)
            continue

        out.append({"role": role, "content": content})

    return out


class OpenAIProvider(LLMProvider):
    """OpenAI API provider with per-key client pooling."""

    def __init__(self) -> None:
        self._clients: dict[str, Any] = {}

    def _get_client(self, api_key: str | None = None) -> Any:
        from openai import AsyncOpenAI

        key = api_key or getattr(settings, "openai_api_key", None)
        if not key:
            raise ValueError(
                "No OpenAI API key configured. "
                "Set OPENAI_API_KEY in .env or save a key in Settings > KI-Modelle."
            )
        if key not in self._clients:
            self._clients[key] = AsyncOpenAI(api_key=key)
        return self._clients[key]

    # ── Public API ────────────────────────────────

    async def complete(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gpt-4o",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> str:
        client = self._get_client(api_key)
        oai_messages = _build_openai_messages(messages, system_prompt)
        oai_tools = _convert_tools_to_openai(tools)

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": oai_messages,
        }
        if oai_tools:
            kwargs["tools"] = oai_tools

        response = await client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        return choice.message.content or ""

    async def complete_raw(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gpt-4o",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> Any:
        client = self._get_client(api_key)
        oai_messages = _build_openai_messages(messages, system_prompt)
        oai_tools = _convert_tools_to_openai(tools)

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": oai_messages,
        }
        if oai_tools:
            kwargs["tools"] = oai_tools

        return await client.chat.completions.create(**kwargs)

    async def complete_with_tool_handling(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gpt-4o",
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

            choice = response.choices[0]
            finish_reason = choice.finish_reason

            if finish_reason != "tool_calls" or not choice.message.tool_calls:
                result.text = choice.message.content or ""
                break

            # Build assistant message with tool calls in Anthropic-normalised format
            assistant_content_blocks: list[dict] = []
            if choice.message.content:
                assistant_content_blocks.append({
                    "type": "text",
                    "text": choice.message.content,
                })

            # Parse all tool calls first
            parsed_calls: list[tuple[str, str, dict]] = []  # (id, name, input)
            for tc in choice.message.tool_calls:
                tool_name = tc.function.name
                try:
                    tool_input = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    tool_input = {}

                assistant_content_blocks.append({
                    "type": "tool_use",
                    "id": tc.id,
                    "name": tool_name,
                    "input": tool_input,
                })
                parsed_calls.append((tc.id, tool_name, tool_input))

            working_messages.append({
                "role": "assistant",
                "content": assistant_content_blocks,
            })

            # Execute tools and collect results
            tool_results_content = []
            for tool_use_id, tool_name, tool_input in parsed_calls:
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
        model: str = "gpt-4o",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        client = self._get_client(api_key)
        oai_messages = _build_openai_messages(messages, system_prompt)
        oai_tools = _convert_tools_to_openai(tools)

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": oai_messages,
            "stream": True,
        }
        if oai_tools:
            kwargs["tools"] = oai_tools

        stream = await client.chat.completions.create(**kwargs)
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def stream_raw_events(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gpt-4o",
        max_tokens: int = 16384,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream raw events normalised to the same format as Anthropic.
        Reconstructs the final message object at the end.
        """
        client = self._get_client(api_key)
        oai_messages = _build_openai_messages(messages, system_prompt)
        oai_tools = _convert_tools_to_openai(tools)

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": oai_messages,
            "stream": True,
        }
        if oai_tools:
            kwargs["tools"] = oai_tools

        stream = await client.chat.completions.create(**kwargs)

        # Track state for reconstructing the final message
        full_text = ""
        tool_calls_state: dict[int, dict] = {}  # index -> {id, name, arguments}
        finish_reason = None

        async for chunk in stream:
            if not chunk.choices:
                continue

            choice = chunk.choices[0]
            delta = choice.delta

            # Text content
            if delta.content:
                full_text += delta.content
                yield {"event": "text_delta", "text": delta.content}

            # Tool calls
            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    idx = tc_delta.index

                    if idx not in tool_calls_state:
                        # New tool call starting
                        tool_id = tc_delta.id or f"call_{uuid.uuid4().hex[:8]}"
                        tool_name = tc_delta.function.name if tc_delta.function and tc_delta.function.name else ""
                        tool_calls_state[idx] = {
                            "id": tool_id,
                            "name": tool_name,
                            "arguments": "",
                        }
                        if tool_name:
                            yield {
                                "event": "tool_start",
                                "index": idx,
                                "tool_name": tool_name,
                                "tool_id": tool_id,
                            }
                    else:
                        # Update name if provided later
                        if tc_delta.function and tc_delta.function.name:
                            old_name = tool_calls_state[idx]["name"]
                            if not old_name:
                                tool_calls_state[idx]["name"] = tc_delta.function.name
                                yield {
                                    "event": "tool_start",
                                    "index": idx,
                                    "tool_name": tc_delta.function.name,
                                    "tool_id": tool_calls_state[idx]["id"],
                                }

                    # Accumulate arguments
                    if tc_delta.function and tc_delta.function.arguments:
                        tool_calls_state[idx]["arguments"] += tc_delta.function.arguments
                        yield {
                            "event": "tool_delta",
                            "index": idx,
                            "partial_json": tc_delta.function.arguments,
                        }

            # Finish reason
            if choice.finish_reason:
                finish_reason = choice.finish_reason

        # Emit tool_end for all tracked tool calls
        for idx in sorted(tool_calls_state.keys()):
            yield {"event": "tool_end", "index": idx}

        # Map OpenAI finish reasons to Anthropic-style stop reasons
        stop_reason_map = {
            "stop": "end_turn",
            "tool_calls": "tool_use",
            "length": "max_tokens",
            "content_filter": "end_turn",
        }
        mapped_stop = stop_reason_map.get(finish_reason or "stop", "end_turn")
        yield {"event": "message_end", "stop_reason": mapped_stop}

        # Build a reconstructed final message that mimics Anthropic's structure
        final_message = _build_anthropic_like_final(
            full_text, tool_calls_state, mapped_stop
        )
        yield {"event": "final_message", "message": final_message}

    async def close(self) -> None:
        for client in self._clients.values():
            await client.close()
        self._clients.clear()


# ── Helper: build Anthropic-like final message ─────────

class _SimpleBlock:
    """Minimal object that mimics Anthropic content blocks for chat.py compatibility."""

    def __init__(self, block_type: str, **kwargs: Any):
        self.type = block_type
        for k, v in kwargs.items():
            setattr(self, k, v)

    def model_dump(self) -> dict:
        d = {"type": self.type}
        for k, v in self.__dict__.items():
            if k != "type":
                d[k] = v
        return d


class _SimpleMessage:
    """Minimal message object that mimics Anthropic response for chat.py compatibility."""

    def __init__(self, content: list[_SimpleBlock], stop_reason: str):
        self.content = content
        self.stop_reason = stop_reason


def _build_anthropic_like_final(
    full_text: str,
    tool_calls_state: dict[int, dict],
    stop_reason: str,
) -> _SimpleMessage:
    """Reconstruct a message object matching Anthropic's shape."""
    content: list[_SimpleBlock] = []

    if full_text:
        content.append(_SimpleBlock("text", text=full_text))

    for idx in sorted(tool_calls_state.keys()):
        tc = tool_calls_state[idx]
        try:
            parsed_input = json.loads(tc["arguments"]) if tc["arguments"] else {}
        except json.JSONDecodeError:
            parsed_input = {}
        content.append(
            _SimpleBlock(
                "tool_use",
                id=tc["id"],
                name=tc["name"],
                input=parsed_input,
            )
        )

    return _SimpleMessage(content=content, stop_reason=stop_reason)
