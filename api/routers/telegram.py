"""Telegram Webhook — receives messages from Telegram and routes through ChatEngine."""

import logging

from fastapi import APIRouter, Request
from sqlalchemy import select

from config import settings
from models.database import async_session
from models.notification import NotificationSettings
from models.user import User
from services.chat_engine import chat_engine
from services.channel_adapters.telegram_adapter import TelegramAdapter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    """Receive Telegram Bot updates and process through ChatEngine.

    Telegram sends updates as JSON to this webhook URL.
    We extract the message, find the user, and process through ChatEngine.
    """
    if not settings.telegram_bot_token:
        return {"ok": False, "error": "Telegram not configured"}

    data = await request.json()

    # Extract message from Telegram update
    message = data.get("message") or data.get("edited_message")
    if not message:
        return {"ok": True}  # Ignore non-message updates

    text = message.get("text", "")
    if not text:
        return {"ok": True}  # Ignore non-text messages

    chat_id = str(message["chat"]["id"])

    # Find user by telegram_chat_id
    async with async_session() as db:
        result = await db.execute(
            select(NotificationSettings.user_id).where(
                NotificationSettings.telegram_chat_id == chat_id
            )
        )
        user_id = result.scalar_one_or_none()

        if user_id is None:
            # Unknown user — send a registration message
            from services.telegram_service import telegram_service

            await telegram_service.send_message(
                chat_id,
                "Dein Telegram-Account ist nicht mit PAI-X verknuepft. "
                "Bitte verbinde ihn in den PAI-X Einstellungen.",
            )
            return {"ok": True}

        # Load user
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            return {"ok": True}

        # Process through ChatEngine with TelegramAdapter
        adapter = TelegramAdapter(chat_id)

        try:
            await chat_engine.process_stream(
                adapter=adapter,
                user=user,
                message=text,
                session_id=None,  # Telegram gets its own session per convo
                model="claude-sonnet-4-6",  # Default model for Telegram
                db=db,
            )
        except Exception as exc:
            logger.error("Telegram chat error: %s", exc)
            await adapter.send_event({
                "type": "error",
                "message": str(exc),
                "code": "ENGINE_ERROR",
            })

    return {"ok": True}
