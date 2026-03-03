"""Telegram Channel Adapter — accumulates response and sends via Telegram Bot API."""

import logging
from typing import Any

from services.channel_adapters.base import ChannelAdapter

logger = logging.getLogger(__name__)


class TelegramAdapter(ChannelAdapter):
    """Accumulates streaming events and sends the final text via Telegram."""

    def __init__(self, chat_id: str) -> None:
        self._chat_id = chat_id
        self._text_buffer: list[str] = []
        self._skill_used: str | None = None
        self._artifacts: list[dict] = []

    async def send_event(self, event: dict[str, Any]) -> None:
        event_type = event.get("type", "")

        if event_type == "chunk":
            self._text_buffer.append(event.get("content", ""))
        elif event_type == "skill_used":
            self._skill_used = event.get("skill")
        elif event_type == "artifact_end":
            self._artifacts.append({
                "title": event.get("title", ""),
                "type": event.get("artifact_type", ""),
            })
        elif event_type == "end":
            # Send accumulated response via Telegram
            await self._flush()
        elif event_type == "error":
            # Send error message
            from services.telegram_service import telegram_service

            await telegram_service.send_message(
                self._chat_id,
                f"Fehler: {event.get('message', 'Unbekannter Fehler')}",
            )

    async def _flush(self) -> None:
        """Send the accumulated text buffer to Telegram."""
        from services.telegram_service import telegram_service

        text = "".join(self._text_buffer).strip()
        if not text:
            text = "(Keine Textantwort)"

        # Truncate for Telegram's 4096 char limit
        if len(text) > 4000:
            text = text[:4000] + "\n\n... (gekuerzt)"

        await telegram_service.send_message(self._chat_id, text, parse_mode="")

    @property
    def channel_name(self) -> str:
        return "telegram"

    @property
    def full_text(self) -> str:
        """Get the accumulated text (for persistence)."""
        return "".join(self._text_buffer)
