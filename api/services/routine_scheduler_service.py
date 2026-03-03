"""Routine Scheduler Service — manages APScheduler jobs for routines."""

import uuid
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import async_session
from models.routine import Routine

logger = logging.getLogger(__name__)


class RoutineSchedulerService:
    """Manages APScheduler jobs for routine scheduling."""

    def __init__(self):
        self.scheduler: AsyncIOScheduler | None = None

    def init_scheduler(self, scheduler: AsyncIOScheduler) -> None:
        """Called once during app startup. Receives the shared scheduler."""
        self.scheduler = scheduler

    async def load_all_jobs(self) -> int:
        """On startup: load all active routines from DB and register APScheduler jobs."""
        count = 0
        async with async_session() as db:
            result = await db.execute(
                select(Routine).where(Routine.is_active == True)
            )
            routines = list(result.scalars().all())
            for routine in routines:
                try:
                    self.schedule_routine(routine)
                    count += 1
                except Exception as e:
                    logger.error(f"Failed to schedule routine {routine.id}: {e}")

        logger.info(f"[RoutineScheduler] Loaded {count} routine jobs")
        return count

    def schedule_routine(self, routine: Routine) -> None:
        """Add or replace an APScheduler CronTrigger job for this routine."""
        if not self.scheduler:
            logger.warning("Scheduler not initialized")
            return

        try:
            trigger = CronTrigger.from_crontab(
                routine.cron_expression,
                timezone=routine.timezone,
            )
        except Exception as e:
            logger.error(f"Invalid cron for routine {routine.id}: {e}")
            return

        self.scheduler.add_job(
            _trigger_routine_execution,
            trigger=trigger,
            id=f"routine_{routine.id}",
            replace_existing=True,
            args=[str(routine.id)],
            misfire_grace_time=300,
        )
        logger.info(f"[RoutineScheduler] Scheduled routine {routine.id} ({routine.name})")

    def unschedule_routine(self, routine_id: uuid.UUID) -> None:
        """Remove the APScheduler job for this routine."""
        if not self.scheduler:
            return
        job_id = f"routine_{routine_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info(f"[RoutineScheduler] Unscheduled routine {routine_id}")

    def get_job_info(self, routine_id: uuid.UUID) -> dict | None:
        """Get APScheduler job info."""
        if not self.scheduler:
            return None
        job = self.scheduler.get_job(f"routine_{routine_id}")
        if not job:
            return None
        return {
            "job_id": job.id,
            "next_run_time": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger),
        }


async def _trigger_routine_execution(routine_id: str) -> None:
    """APScheduler callback — executes the routine via the executor service."""
    logger.info(f"[RoutineScheduler] Triggered routine execution: {routine_id}")
    try:
        from services.routine_executor_service import routine_executor
        run_id = await routine_executor.execute_routine(routine_id, trigger_type="scheduled")
        if run_id:
            logger.info(f"[RoutineScheduler] Routine {routine_id} completed, run_id={run_id}")
        else:
            logger.info(f"[RoutineScheduler] Routine {routine_id} was skipped (condition not met or inactive)")
    except Exception as e:
        logger.error(f"[RoutineScheduler] Failed to execute routine {routine_id}: {e}")


# Singleton
routine_scheduler = RoutineSchedulerService()
