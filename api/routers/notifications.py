"""Notifications Endpoints — read, manage, and configure notifications."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.notification import Notification, NotificationSettings
from models.user import User

router = APIRouter()


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────


class NotificationSettingsUpdate(BaseModel):
    daily_briefing_time: str | None = None  # "HH:MM"
    pre_meeting_minutes: int | None = None
    channels: dict | None = None  # {"telegram": true, "pwa_push": true, "email": false}


class TestNotificationRequest(BaseModel):
    channel: str = "telegram"  # "telegram" | "pwa_push"


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("/notifications")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all notifications for the current user."""
    limit = min(limit, 100)

    query = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )

    if unread_only:
        query = query.where(Notification.read == False)  # noqa: E712

    result = await db.execute(query)
    notifications = list(result.scalars().all())

    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "content": n.content,
                "read": n.read,
                "action_url": n.action_url,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ]
    }


@router.put("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    await db.execute(
        update(Notification)
        .where(Notification.id == nid, Notification.user_id == user.id)
        .values(read=True)
    )
    await db.flush()
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.read == False,  # noqa: E712
        )
        .values(read=True)
    )
    await db.flush()
    return {"message": "All notifications marked as read"}


@router.get("/notifications/settings")
async def get_notification_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notification settings for the current user."""
    result = await db.execute(
        select(NotificationSettings).where(
            NotificationSettings.user_id == user.id
        )
    )
    settings_row = result.scalar_one_or_none()

    if settings_row is None:
        # Create default settings
        settings_row = NotificationSettings(user_id=user.id)
        db.add(settings_row)
        await db.flush()

    return {
        "settings": {
            "daily_briefing_enabled": settings_row.daily_briefing_enabled,
            "daily_briefing_time": settings_row.daily_briefing_time.strftime("%H:%M")
            if settings_row.daily_briefing_time
            else "07:30",
            "pre_meeting_enabled": settings_row.pre_meeting_enabled,
            "pre_meeting_minutes": settings_row.pre_meeting_minutes,
            "follow_up_enabled": settings_row.follow_up_enabled,
            "follow_up_hours": settings_row.follow_up_hours,
            "deadline_warning_enabled": settings_row.deadline_warning_enabled,
            "deadline_warning_hours": settings_row.deadline_warning_hours,
            "channels": settings_row.channels,
            "telegram_chat_id": settings_row.telegram_chat_id,
        }
    }


@router.put("/notifications/settings")
async def update_notification_settings(
    request: NotificationSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update notification settings."""
    result = await db.execute(
        select(NotificationSettings).where(
            NotificationSettings.user_id == user.id
        )
    )
    settings_row = result.scalar_one_or_none()

    if settings_row is None:
        settings_row = NotificationSettings(user_id=user.id)
        db.add(settings_row)
        await db.flush()

    update_values = {}
    if request.daily_briefing_time is not None:
        from datetime import time

        parts = request.daily_briefing_time.split(":")
        update_values["daily_briefing_time"] = time(int(parts[0]), int(parts[1]))
    if request.pre_meeting_minutes is not None:
        update_values["pre_meeting_minutes"] = request.pre_meeting_minutes
    if request.channels is not None:
        update_values["channels"] = request.channels

    if update_values:
        await db.execute(
            update(NotificationSettings)
            .where(NotificationSettings.user_id == user.id)
            .values(**update_values)
        )
        await db.flush()

    # Re-read
    result = await db.execute(
        select(NotificationSettings).where(
            NotificationSettings.user_id == user.id
        )
    )
    updated = result.scalar_one()

    return {
        "settings": {
            "daily_briefing_enabled": updated.daily_briefing_enabled,
            "daily_briefing_time": updated.daily_briefing_time.strftime("%H:%M")
            if updated.daily_briefing_time
            else "07:30",
            "pre_meeting_enabled": updated.pre_meeting_enabled,
            "pre_meeting_minutes": updated.pre_meeting_minutes,
            "follow_up_enabled": updated.follow_up_enabled,
            "follow_up_hours": updated.follow_up_hours,
            "deadline_warning_enabled": updated.deadline_warning_enabled,
            "deadline_warning_hours": updated.deadline_warning_hours,
            "channels": updated.channels,
            "telegram_chat_id": updated.telegram_chat_id,
        }
    }


@router.post("/notifications/test")
async def send_test_notification(
    request: TestNotificationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test notification to verify the channel is configured."""
    if request.channel == "telegram":
        from services.telegram_service import telegram_service

        result = await telegram_service.send_message(
            chat_id="",  # Will be looked up from settings
            text="<b>PAI-X Test</b>\n\nDeine Telegram-Benachrichtigungen funktionieren!",
        )
        # Actually use the user's chat_id
        send_result = await telegram_service.send_alert(
            user_id=str(user.id),
            alert={
                "title": "PAI-X Test",
                "content": "Deine Telegram-Benachrichtigungen funktionieren!",
            },
        )
        return {"message": "Test notification sent", "result": send_result}

    # Create in-app notification for other channels
    notification = Notification(
        user_id=user.id,
        type="test",
        title="PAI-X Test",
        content="Dies ist eine Test-Benachrichtigung.",
        sent_channels=[request.channel],
    )
    db.add(notification)
    await db.flush()

    return {"message": "Test notification created"}
