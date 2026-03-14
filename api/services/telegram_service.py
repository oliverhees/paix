"""Telegram Notification Service — sends messages via Telegram Bot API."""

from typing import Any

import httpx

from config import settings


class TelegramService:
    """
    Sends messages to users via the Telegram Bot API.
    Requires TELEGRAM_BOT_TOKEN in settings.
    """

    def __init__(self) -> None:
        self.bot_token = settings.telegram_bot_token
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def send_message(
        self,
        chat_id: str,
        text: str,
        parse_mode: str = "HTML",
    ) -> dict[str, Any]:
        """
        Send a text message to a Telegram chat.
        Returns the Telegram API response or error dict.
        """
        if not self.bot_token:
            return {"ok": False, "error": "Telegram bot token not configured"}

        client = await self._get_client()
        try:
            response = await client.post(
                f"{self.base_url}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": parse_mode,
                },
            )
            return response.json()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    async def send_briefing(self, user_id: str, briefing: dict) -> dict[str, Any]:
        """
        Send a formatted daily briefing to the user's Telegram.
        Looks up the user's telegram_chat_id from notification_settings.
        """
        chat_id = await self._get_user_chat_id(user_id)
        if not chat_id:
            return {"ok": False, "error": "No Telegram chat_id for user"}

        # Format briefing as HTML
        text_parts = [
            f"<b>{briefing.get('greeting', 'Guten Morgen.')}</b>\n",
        ]

        events = briefing.get("events", [])
        if events:
            text_parts.append("<b>Termine heute:</b>")
            for ev in events:
                title = ev.get("title", "Termin")
                start = ev.get("start", "")
                text_parts.append(f"  - {start[:5] if isinstance(start, str) else start}: {title}")
            text_parts.append("")

        priorities = briefing.get("priorities", [])
        if priorities:
            text_parts.append("<b>Prioritaeten:</b>")
            for p in priorities:
                text_parts.append(f"  - {p.get('text', p) if isinstance(p, dict) else p}")
            text_parts.append("")

        idea = briefing.get("idea_of_the_day")
        if idea:
            content = idea.get("content", idea) if isinstance(idea, dict) else idea
            text_parts.append(f"<b>Idee des Tages:</b> {content}")

        text = "\n".join(text_parts)
        return await self.send_message(chat_id, text)

    async def send_alert(self, user_id: str, alert: dict) -> dict[str, Any]:
        """Send an alert notification to the user."""
        chat_id = await self._get_user_chat_id(user_id)
        if not chat_id:
            return {"ok": False, "error": "No Telegram chat_id for user"}

        title = alert.get("title", "Alert")
        content = alert.get("content", "")
        text = f"<b>{title}</b>\n\n{content}"
        return await self.send_message(chat_id, text)

    async def _get_user_chat_id(self, user_id: str) -> str | None:
        """Load user's Telegram chat ID from notification_settings."""
        try:
            import uuid

            from sqlalchemy import select

            from models.database import async_session
            from models.notification import NotificationSettings

            async with async_session() as db:
                result = await db.execute(
                    select(NotificationSettings.telegram_chat_id).where(
                        NotificationSettings.user_id == uuid.UUID(user_id)
                    )
                )
                row = result.scalar_one_or_none()
                return row
        except Exception:
            return None

    async def get_bot_info(self) -> dict[str, Any]:
        """Get bot info (username, name) from Telegram API."""
        if not self.bot_token:
            return {}
        client = await self._get_client()
        try:
            response = await client.get(f"{self.base_url}/getMe")
            data = response.json()
            if data.get("ok"):
                return data["result"]
            return {}
        except Exception:
            return {}

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Singleton
telegram_service = TelegramService()
