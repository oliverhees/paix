"""Google Gemini provider — via google-generativeai SDK."""

import json
import logging
import uuid
from typing import Any, AsyncGenerator

from config import settings
from services.llm_providers.base import LLMProvider, ToolUseResult  # noqa: F401

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 3


def _convert_tools_to_google(tools: list[dict] | None) -> list[Any] | None:
    """Convert Anthropic-style tool defs to Google function declarations."""
    if not tools:
        return None
    from google.generativeai import types

    func_decls = []
    for t in tools:
        schema = t.get("input_schema", {"type": "object", "properties": {}})
        # Google expects a specific format — clean up the schema
        cleaned_schema = _clean_schema_for_google(schema)
        func_decls.append(types.FunctionDeclaration(
            name=t["name"],
            description=t.get("description", ""),
            parameters=cleaned_schema,
        ))
    return [types.Tool(function_declarations=func_decls)]


def _clean_schema_for_google(schema: dict) -> dict:
    """Clean a JSON Schema for Google's function calling (strip unsupported keys)."""
    cleaned = {}
    for k, v in schema.items():
        if k in ("type", "properties", "required", "description", "enum", "items"):
            if k == "properties" and isinstance(v, dict):
                cleaned[k] = {
                    pk: _clean_schema_for_google(pv) for pk, pv in v.items()
                }
            elif k == "items" and isinstance(v, dict):
                cleaned[k] = _clean_schema_for_google(v)
            else:
                cleaned[k] = v
    return cleaned


def _build_gemini_messages(messages: list[dict]) -> list[dict]:
    """
    Convert our normalised messages to Gemini format.
    - "user" -> "user"
    - "assistant" -> "model"
    - Tool results become function response parts
    """
    from google.generativeai import types

    gemini_history: list[dict] = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content")

        # Map role
        gemini_role = "model" if role == "assistant" else "user"

        # Handle tool_result messages (Anthropic-style)
        if role == "user" and isinstance(content, list):
            if content and isinstance(content[0], dict) and content[0].get("type") == "tool_result":
                parts = []
                for tr in content:
                    parts.append(types.Part.from_function_response(
                        name=tr.get("tool_name", "unknown"),
                        response={"result": tr.get("content", "")},
                    ))
                gemini_history.append({"role": "user", "parts": parts})
                continue

        # Handle assistant messages with tool_use blocks
        if role == "assistant" and isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        parts.append(types.Part.from_text(block.get("text", "")))
                    elif block.get("type") == "tool_use":
                        parts.append(types.Part.from_function_response(
                            name=block["name"],
                            response=block.get("input", {}),
                        ))
            if parts:
                gemini_history.append({"role": "model", "parts": parts})
            continue

        # Plain text message
        if isinstance(content, str):
            gemini_history.append({
                "role": gemini_role,
                "parts": [types.Part.from_text(content)],
            })

    return gemini_history


class GoogleProvider(LLMProvider):
    """Google Gemini API provider."""

    def __init__(self) -> None:
        self._clients: dict[str, Any] = {}

    def _get_client(self, api_key: str | None = None, model: str = "gemini-2.0-flash") -> Any:
        import google.generativeai as genai

        key = api_key or getattr(settings, "google_ai_api_key", None)
        if not key:
            raise ValueError(
                "No Google AI API key configured. "
                "Set GOOGLE_AI_API_KEY in .env or save a key in Settings > KI-Modelle."
            )
        cache_key = f"{key}:{model}"
        if cache_key not in self._clients:
            genai.configure(api_key=key)
            self._clients[cache_key] = genai.GenerativeModel(model)
        return self._clients[cache_key]

    def _get_client_with_system(
        self,
        api_key: str | None,
        model: str,
        system_prompt: str | None,
        tools: list[dict] | None,
    ) -> Any:
        """Get a GenerativeModel configured with system instruction and tools."""
        import google.generativeai as genai

        key = api_key or getattr(settings, "google_ai_api_key", None)
        if not key:
            raise ValueError(
                "No Google AI API key configured. "
                "Set GOOGLE_AI_API_KEY in .env or save a key in Settings > KI-Modelle."
            )
        genai.configure(api_key=key)

        kwargs: dict[str, Any] = {}
        if system_prompt:
            kwargs["system_instruction"] = system_prompt
        google_tools = _convert_tools_to_google(tools)
        if google_tools:
            kwargs["tools"] = google_tools

        return genai.GenerativeModel(model, **kwargs)

    # ── Public API ────────────────────────────────

    async def complete(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gemini-2.0-flash",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> str:
        from google.generativeai import types

        client = self._get_client_with_system(api_key, model, system_prompt, tools)
        gemini_messages = _build_gemini_messages(messages)

        config = types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = await client.generate_content_async(
            gemini_messages,
            generation_config=config,
        )

        return response.text or ""

    async def complete_raw(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gemini-2.0-flash",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> Any:
        from google.generativeai import types

        client = self._get_client_with_system(api_key, model, system_prompt, tools)
        gemini_messages = _build_gemini_messages(messages)

        config = types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        return await client.generate_content_async(
            gemini_messages,
            generation_config=config,
        )

    async def complete_with_tool_handling(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gemini-2.0-flash",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        tool_executor: Any = None,
    ) -> ToolUseResult:
        from google.generativeai import types

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

        client = self._get_client_with_system(api_key, model, system_prompt, tools)
        gemini_messages = _build_gemini_messages(messages)
        config = types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        working_history = list(gemini_messages)
        result = ToolUseResult(text="")

        for round_num in range(MAX_TOOL_ROUNDS):
            response = await client.generate_content_async(
                working_history,
                generation_config=config,
            )

            # Check for function calls
            function_calls = []
            text_parts = []
            for part in response.candidates[0].content.parts:
                if hasattr(part, "function_call") and part.function_call.name:
                    function_calls.append(part.function_call)
                elif hasattr(part, "text") and part.text:
                    text_parts.append(part.text)

            if not function_calls:
                result.text = "".join(text_parts)
                break

            # Process function calls
            # Add model response to history
            working_history.append({
                "role": "model",
                "parts": response.candidates[0].content.parts,
            })

            func_response_parts = []
            for fc in function_calls:
                tool_name = fc.name
                tool_input = dict(fc.args) if fc.args else {}

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

                func_response_parts.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response={"result": tool_result_str},
                    )
                )

            working_history.append({
                "role": "user",
                "parts": func_response_parts,
            })
        else:
            logger.warning(
                "Max tool rounds (%d) reached, making final call without tools",
                MAX_TOOL_ROUNDS,
            )
            # Final call without tools
            no_tools_client = self._get_client_with_system(
                api_key, model, system_prompt, None
            )
            response = await no_tools_client.generate_content_async(
                working_history,
                generation_config=config,
            )
            result.text = response.text or ""

        return result

    async def stream(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gemini-2.0-flash",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        from google.generativeai import types

        client = self._get_client_with_system(api_key, model, system_prompt, tools)
        gemini_messages = _build_gemini_messages(messages)

        config = types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = await client.generate_content_async(
            gemini_messages,
            generation_config=config,
            stream=True,
        )

        async for chunk in response:
            if chunk.text:
                yield chunk.text

    async def stream_raw_events(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "gemini-2.0-flash",
        max_tokens: int = 16384,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream raw events normalised to the same format as Anthropic.
        """
        from google.generativeai import types
        from services.llm_providers.openai_provider import _SimpleBlock, _SimpleMessage

        client = self._get_client_with_system(api_key, model, system_prompt, tools)
        gemini_messages = _build_gemini_messages(messages)

        config = types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = await client.generate_content_async(
            gemini_messages,
            generation_config=config,
            stream=True,
        )

        full_text = ""
        tool_calls_state: dict[int, dict] = {}
        tool_index = 0

        async for chunk in response:
            if not chunk.candidates:
                continue

            for part in chunk.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    full_text += part.text
                    yield {"event": "text_delta", "text": part.text}

                elif hasattr(part, "function_call") and part.function_call.name:
                    fc = part.function_call
                    tool_id = f"call_{uuid.uuid4().hex[:8]}"
                    args_json = json.dumps(dict(fc.args) if fc.args else {})

                    tool_calls_state[tool_index] = {
                        "id": tool_id,
                        "name": fc.name,
                        "arguments": args_json,
                    }

                    yield {
                        "event": "tool_start",
                        "index": tool_index,
                        "tool_name": fc.name,
                        "tool_id": tool_id,
                    }
                    yield {
                        "event": "tool_delta",
                        "index": tool_index,
                        "partial_json": args_json,
                    }
                    yield {"event": "tool_end", "index": tool_index}
                    tool_index += 1

        # Determine stop reason
        stop_reason = "end_turn"
        if tool_calls_state:
            stop_reason = "tool_use"

        yield {"event": "message_end", "stop_reason": stop_reason}

        # Build Anthropic-like final message
        content_blocks: list[_SimpleBlock] = []
        if full_text:
            content_blocks.append(_SimpleBlock("text", text=full_text))
        for idx in sorted(tool_calls_state.keys()):
            tc = tool_calls_state[idx]
            try:
                parsed_input = json.loads(tc["arguments"]) if tc["arguments"] else {}
            except json.JSONDecodeError:
                parsed_input = {}
            content_blocks.append(
                _SimpleBlock(
                    "tool_use",
                    id=tc["id"],
                    name=tc["name"],
                    input=parsed_input,
                )
            )

        yield {
            "event": "final_message",
            "message": _SimpleMessage(content=content_blocks, stop_reason=stop_reason),
        }

    async def close(self) -> None:
        self._clients.clear()
