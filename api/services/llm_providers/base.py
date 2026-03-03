"""Abstract base class for LLM providers and shared types."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator


@dataclass
class ToolUseResult:
    """Result of a complete_with_tool_handling call."""

    text: str
    skill_used: str | None = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)


class LLMProvider(ABC):
    """
    Abstract base for all LLM providers.

    Every provider must implement the same surface so the LLMService facade
    can delegate transparently.
    """

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> str:
        """Generate a complete non-streaming response. Returns text only."""
        ...

    @abstractmethod
    async def complete_raw(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> Any:
        """Generate a complete response and return the raw provider response object."""
        ...

    @abstractmethod
    async def complete_with_tool_handling(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        tool_executor: Any = None,
    ) -> ToolUseResult:
        """Complete with automatic multi-round tool use handling."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream text chunks."""
        ...

    @abstractmethod
    async def stream_raw_events(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "",
        max_tokens: int = 16384,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream raw events in normalised format:
          {"event": "text_delta", "text": "..."}
          {"event": "tool_start", "index": N, "tool_name": "...", "tool_id": "..."}
          {"event": "tool_delta", "index": N, "partial_json": "..."}
          {"event": "tool_end", "index": N}
          {"event": "message_end", "stop_reason": "..."}
          {"event": "final_message", "message": <reconstructed response>}
        """
        ...

    @abstractmethod
    async def close(self) -> None:
        """Release resources / close HTTP clients."""
        ...


__all__ = ["LLMProvider", "ToolUseResult"]
