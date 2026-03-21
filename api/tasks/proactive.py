"""Proactive task stubs — not yet implemented."""
from celery_app import celery


@celery.task(name="tasks.proactive.send_daily_briefing")
def send_daily_briefing():
    pass


@celery.task(name="tasks.proactive.check_upcoming_meetings")
def check_upcoming_meetings():
    pass


@celery.task(name="tasks.proactive.check_follow_ups")
def check_follow_ups():
    pass
