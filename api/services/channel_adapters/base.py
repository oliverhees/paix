"""Abstract Channel Adapter — defines the interface for chat delivery channels."""

from abc import ABC, abstractmethod
from typing import Any


class ChannelAdapter(ABC):
    """Base class for all chat delivery channels."""

    @abstractmethod
    async def send_event(self, event: dict[str, Any]) -> None:
        """Send a single event to the channel.

        Events are dicts with a 'type' key:
        - chunk: {type, content, session_id, message_id}
        - end: {type, message_id, skill_used, sources}
        - error: {type, message, code}
        - skill_used: {type, skill, session_id, message_id}
        - tool_use_start: {type, tool_name, tool_id, index, session_id, message_id}
        - tool_use_input: {type, tool_name, tool_id, input, session_id, message_id}
        - tool_use_result: {type, tool_name, tool_id, result, success, session_id, message_id}
        - artifact_start/meta/chunk/end: artifact streaming events
        - code_execution_start/result: Docker sandbox events
        - thinking: {type, session_id, message_id}
        """
        ...

    @property
    @abstractmethod
    def channel_name(self) -> str:
        """Return the name of this channel (e.g., 'websocket', 'telegram', 'rest')."""
        ...
