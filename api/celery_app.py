"""Celery Application — background task processing for PAIONE."""

from celery import Celery
from celery.schedules import crontab

from config import settings

celery = Celery(
    "paione",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Celery configuration
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Berlin",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Queue routing
    task_routes={
        "tasks.proactive.*": {"queue": "proactive"},
        "tasks.memory.*": {"queue": "memory"},
        "tasks.*": {"queue": "default"},
    },
)

# Register task modules explicitly
import tasks.proactive  # noqa: F401, E402
import tasks.memory     # noqa: F401, E402


# Beat schedule — periodic tasks
celery.conf.beat_schedule = {
    "daily-briefing": {
        "task": "tasks.proactive.send_daily_briefing",
        "schedule": crontab(hour=7, minute=30),
    },
    "pre-meeting-check": {
        "task": "tasks.proactive.check_upcoming_meetings",
        "schedule": 900.0,  # Every 15 minutes
    },
    "follow-up-check": {
        "task": "tasks.proactive.check_follow_ups",
        "schedule": 3600.0,  # Every hour
    },
}
