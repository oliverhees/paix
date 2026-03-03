"""Internal Endpoints — machine-to-machine triggers for n8n and Celery."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.database import get_db, async_session
from models.notification import Notification, NotificationSettings
from models.user import User
from services.calendar_service import calendar_service
from services.graphiti_service import graphiti_service
from services.llm_service import llm_service
from services.telegram_service import telegram_service

router = APIRouter()


# ──────────────────────────────────────────────
# Internal API Key Dependency
# ──────────────────────────────────────────────


async def verify_internal_key(
    x_internal_key: str = Header(..., alias="X-Internal-Key"),
) -> bool:
    """Verify the internal API key for machine-to-machine auth."""
    if not settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal API key not configured",
        )
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )
    return True


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────


class MeetingAlertRequest(BaseModel):
    event_id: str
    minutes_until: int
    user_id: str | None = None


class FollowUpCheckRequest(BaseModel):
    user_id: str | None = None


class DeadlineWarningRequest(BaseModel):
    user_id: str | None = None


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────


async def _get_all_users_with_notifications(
    db: AsyncSession,
) -> list[tuple[User, NotificationSettings]]:
    """Get all active users with their notification settings."""
    result = await db.execute(
        select(User, NotificationSettings).join(
            NotificationSettings,
            NotificationSettings.user_id == User.id,
            isouter=True,
        ).where(User.is_active == True)  # noqa: E712
    )
    return [(row[0], row[1]) for row in result.all()]


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.post("/internal/trigger/daily-briefing")
async def trigger_daily_briefing(
    _: bool = Depends(verify_internal_key),
):
    """
    Generate and send daily briefing to all users.
    Called by n8n cron job at 07:30.
    """
    sent_to: list[str] = []

    async with async_session() as db:
        users_settings = await _get_all_users_with_notifications(db)

        for user, notif_settings in users_settings:
            if notif_settings is None or not notif_settings.daily_briefing_enabled:
                continue

            user_id = str(user.id)

            # Generate briefing content
            events = await calendar_service.get_events_today(user_id)
            events_list = [
                {"title": ev.title, "start": ev.start.isoformat()}
                for ev in events
            ]

            priorities = []
            try:
                goals = await graphiti_service.get_telos_dimension(user_id, "goals")
                priorities = [
                    {"text": e.get("content", ""), "source": "TELOS.GOALS"}
                    for e in goals.get("entries", [])[:3]
                ]
            except Exception:
                pass

            briefing = {
                "greeting": f"Guten Morgen, {user.name}.",
                "events": events_list,
                "priorities": priorities,
                "idea_of_the_day": None,
            }

            # Send via configured channels
            channels = notif_settings.channels or {}
            channels_sent = []

            if channels.get("telegram") and notif_settings.telegram_chat_id:
                await telegram_service.send_briefing(user_id, briefing)
                channels_sent.append("telegram")

            # Store as notification
            notification = Notification(
                user_id=user.id,
                type="daily_briefing",
                title=f"Tages-Briefing",
                content=briefing["greeting"],
                sent_channels=channels_sent,
            )
            db.add(notification)
            sent_to.append(user.email)

        await db.commit()

    return {"sent_to": sent_to}


@router.post("/internal/trigger/pre-meeting-alert")
async def trigger_pre_meeting_alert(
    request: MeetingAlertRequest,
    _: bool = Depends(verify_internal_key),
):
    """
    Generate and send a pre-meeting alert.
    Called by n8n when a meeting is approaching.
    """
    sent_to: list[str] = []

    async with async_session() as db:
        # If no user_id specified, send to all users
        if request.user_id:
            result = await db.execute(
                select(User).where(User.id == request.user_id)
            )
            users = [result.scalar_one_or_none()]
            users = [u for u in users if u is not None]
        else:
            result = await db.execute(
                select(User).where(User.is_active == True)  # noqa: E712
            )
            users = list(result.scalars().all())

        for user in users:
            user_id = str(user.id)

            # Get meeting context from Graphiti
            context = ""
            try:
                results = await graphiti_service.search(
                    query=f"event {request.event_id}", limit=3
                )
                if results:
                    context = "\n".join(
                        r.get("summary", r.get("content", ""))
                        for r in results
                        if r.get("summary") or r.get("content")
                    )
            except Exception:
                pass

            alert = {
                "title": f"Meeting in {request.minutes_until} Minuten",
                "content": f"Event ID: {request.event_id}\n{context}".strip(),
            }

            # Send via Telegram
            await telegram_service.send_alert(user_id, alert)

            # Store as notification
            notification = Notification(
                user_id=user.id,
                type="pre_meeting_alert",
                title=alert["title"],
                content=alert["content"],
                sent_channels=["telegram"],
            )
            db.add(notification)
            sent_to.append(user.email)

        await db.commit()

    return {"sent_to": sent_to}


@router.post("/internal/trigger/follow-up-check")
async def trigger_follow_up_check(
    request: FollowUpCheckRequest | None = None,
    _: bool = Depends(verify_internal_key),
):
    """Check for overdue follow-ups and send reminders."""
    sent_to: list[str] = []

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.is_active == True)  # noqa: E712
        )
        users = list(result.scalars().all())

        for user in users:
            user_id = str(user.id)

            try:
                results = await graphiti_service.search(
                    query="overdue follow-up action item open", limit=5
                )
                if results:
                    items_text = "\n".join(
                        f"- {r.get('name', r.get('content', ''))}"
                        for r in results
                    )
                    alert = {
                        "title": "Offene Follow-Ups",
                        "content": items_text,
                    }
                    await telegram_service.send_alert(user_id, alert)
                    sent_to.append(user.email)
            except Exception:
                pass

        await db.commit()

    return {"sent_to": sent_to}


@router.post("/internal/trigger/deadline-warning")
async def trigger_deadline_warning(
    request: DeadlineWarningRequest | None = None,
    _: bool = Depends(verify_internal_key),
):
    """Check for approaching deadlines and send warnings."""
    sent_to: list[str] = []

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.is_active == True)  # noqa: E712
        )
        users = list(result.scalars().all())

        for user in users:
            user_id = str(user.id)

            try:
                results = await graphiti_service.search(
                    query="deadline due soon approaching", limit=5
                )
                if results:
                    items_text = "\n".join(
                        f"- {r.get('name', r.get('content', ''))}"
                        for r in results
                    )
                    alert = {
                        "title": "Deadline-Warnung",
                        "content": items_text,
                    }
                    await telegram_service.send_alert(user_id, alert)
                    sent_to.append(user.email)
            except Exception:
                pass

        await db.commit()

    return {"sent_to": sent_to}
