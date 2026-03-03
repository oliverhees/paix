"""Proactive Tasks — daily briefing, pre-meeting alerts, follow-up checks."""

import asyncio
from datetime import datetime, timedelta, timezone

from celery_app import celery
from config import settings


def _run_async(coro):
    """Helper to run async code in Celery (sync) workers."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery.task(name="tasks.proactive.send_daily_briefing")
def send_daily_briefing():
    """
    Cron: Every day at 07:30 — generate and send daily briefing.
    Iterates all users with daily_briefing_enabled and sends via Telegram.
    """
    _run_async(_send_daily_briefing_async())


async def _send_daily_briefing_async():
    """Async implementation of daily briefing."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"http://localhost:8000/api/v1/internal/trigger/daily-briefing",
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            return response.json()
    except Exception as exc:
        return {"error": str(exc)}


@celery.task(name="tasks.proactive.check_upcoming_meetings")
def check_upcoming_meetings():
    """
    Cron: Every 15 minutes — check if any meeting starts within 60 minutes.
    If yes, trigger pre-meeting alert.
    """
    _run_async(_check_upcoming_meetings_async())


async def _check_upcoming_meetings_async():
    """Async implementation of pre-meeting check."""
    from sqlalchemy import select

    from models.database import async_session
    from models.notification import NotificationSettings
    from models.user import User
    from services.calendar_service import calendar_service

    import httpx

    async with async_session() as db:
        result = await db.execute(
            select(User, NotificationSettings)
            .join(
                NotificationSettings,
                NotificationSettings.user_id == User.id,
                isouter=True,
            )
            .where(User.is_active == True)  # noqa: E712
        )
        users_settings = [(row[0], row[1]) for row in result.all()]

    for user, notif_settings in users_settings:
        if notif_settings is None or not notif_settings.pre_meeting_enabled:
            continue

        user_id = str(user.id)
        alert_minutes = notif_settings.pre_meeting_minutes or 60

        # Get upcoming events
        events = await calendar_service.get_upcoming_events(user_id, days=1)

        now = datetime.now(timezone.utc)
        for event in events:
            time_until = (event.start - now).total_seconds() / 60.0
            if 0 < time_until <= alert_minutes:
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        await client.post(
                            f"http://localhost:8000/api/v1/internal/trigger/pre-meeting-alert",
                            headers={"X-Internal-Key": settings.internal_api_key},
                            json={
                                "event_id": event.id,
                                "minutes_until": int(time_until),
                                "user_id": user_id,
                            },
                        )
                except Exception:
                    pass


@celery.task(name="tasks.proactive.check_follow_ups")
def check_follow_ups():
    """
    Cron: Every hour — check for overdue follow-ups and send reminders.
    """
    _run_async(_check_follow_ups_async())


async def _check_follow_ups_async():
    """Async implementation of follow-up check."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"http://localhost:8000/api/v1/internal/trigger/follow-up-check",
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            return response.json()
    except Exception as exc:
        return {"error": str(exc)}
