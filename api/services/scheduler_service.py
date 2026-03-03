"""Background scheduler — checks for due reminders every 60 seconds."""

from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from croniter import croniter
from sqlalchemy import select

from models.database import async_session
from models.notification import Notification
from models.reminder import Reminder

scheduler = AsyncIOScheduler()


async def check_due_reminders() -> None:
    """
    Poll for reminders where next_run_at <= now() and is_active=True.
    For each due reminder:
      - Create a Notification row.
      - Advance next_run_at (recurring) or deactivate (one-time).
    """
    now = datetime.now(timezone.utc)

    async with async_session() as db:
        result = await db.execute(
            select(Reminder).where(
                Reminder.is_active == True,  # noqa: E712
                Reminder.next_run_at.isnot(None),
                Reminder.next_run_at <= now,
            )
        )
        due_reminders = list(result.scalars().all())

        for reminder in due_reminders:
            # Create an in-app notification
            notification = Notification(
                user_id=reminder.user_id,
                type="reminder",
                title=f"\u23f0 {reminder.title}",
                content=reminder.description or reminder.title,
                action_url="/reminders",
            )
            db.add(notification)

            # Advance or deactivate
            reminder.last_triggered_at = now
            if reminder.is_recurring and reminder.cron_expression:
                cron = croniter(reminder.cron_expression, now)
                next_dt = cron.get_next(datetime)
                reminder.next_run_at = next_dt.replace(tzinfo=timezone.utc)
            else:
                # One-time reminder: deactivate after firing
                reminder.is_active = False

            db.add(reminder)

        await db.commit()

        if due_reminders:
            print(f"[Scheduler] Triggered {len(due_reminders)} reminder(s)")


def start_scheduler() -> None:
    """Add the reminder-check job and start the background scheduler."""
    scheduler.add_job(
        check_due_reminders,
        IntervalTrigger(seconds=60),
        id="check_due_reminders",
        replace_existing=True,
        misfire_grace_time=30,
    )
    scheduler.start()
    print("[Scheduler] Started — checking reminders every 60s")


def stop_scheduler() -> None:
    """Gracefully stop the background scheduler on application shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] Stopped")
