"""Reminders Endpoints — create, list, update, delete, and snooze reminders."""

import uuid
from datetime import datetime, timezone, timedelta

from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.reminder import Reminder
from models.user import User

router = APIRouter()


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────


class ReminderCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    remind_at: datetime | None = None  # Required when is_recurring=False
    is_recurring: bool = False
    cron_expression: str | None = None  # Required when is_recurring=True
    category: str | None = None

    @model_validator(mode="after")
    def validate_fields(self) -> "ReminderCreate":
        now = datetime.now(timezone.utc)

        if self.is_recurring:
            if not self.cron_expression:
                raise ValueError(
                    "cron_expression is required for recurring reminders"
                )
            if not croniter.is_valid(self.cron_expression):
                raise ValueError(
                    f"Invalid cron expression: {self.cron_expression!r}. "
                    "Expected format: 'minute hour day month weekday' "
                    "(e.g. '0 9 * * MON')"
                )
        else:
            if self.remind_at is None:
                raise ValueError("remind_at is required for one-time reminders")
            remind_at_utc = self.remind_at
            if remind_at_utc.tzinfo is None:
                remind_at_utc = remind_at_utc.replace(tzinfo=timezone.utc)
            if remind_at_utc <= now:
                raise ValueError("remind_at must be in the future")

        return self


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    remind_at: datetime | None = None
    is_recurring: bool | None = None
    cron_expression: str | None = None
    is_active: bool | None = None
    category: str | None = None


class SnoozeRequest(BaseModel):
    minutes: int = Field(..., ge=1, le=10080)  # 1 minute to 7 days


class ReminderResponse(BaseModel):
    id: str
    title: str
    description: str | None
    remind_at: datetime | None
    is_recurring: bool
    cron_expression: str | None
    next_run_at: datetime | None
    last_triggered_at: datetime | None
    is_active: bool
    category: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────


def _compute_next_run(reminder: Reminder) -> datetime | None:
    """Compute and return the next_run_at value for a reminder."""
    now = datetime.now(timezone.utc)
    if reminder.is_recurring and reminder.cron_expression:
        cron = croniter(reminder.cron_expression, now)
        return cron.get_next(datetime).replace(tzinfo=timezone.utc)
    if reminder.remind_at:
        return reminder.remind_at
    return None


def _reminder_to_response(r: Reminder) -> ReminderResponse:
    return ReminderResponse(
        id=str(r.id),
        title=r.title,
        description=r.description,
        remind_at=r.remind_at,
        is_recurring=r.is_recurring,
        cron_expression=r.cron_expression,
        next_run_at=r.next_run_at,
        last_triggered_at=r.last_triggered_at,
        is_active=r.is_active,
        category=r.category,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


async def _get_reminder_for_user(
    reminder_id: str, user: User, db: AsyncSession
) -> Reminder:
    """Fetch a reminder by ID, scoped to the current user. Raises 404 if not found."""
    try:
        rid = uuid.UUID(reminder_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reminder ID")

    result = await db.execute(
        select(Reminder).where(Reminder.id == rid, Reminder.user_id == user.id)
    )
    reminder = result.scalar_one_or_none()
    if reminder is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("/reminders", response_model=dict)
async def list_reminders(
    active_only: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all reminders for the current user."""
    query = (
        select(Reminder)
        .where(Reminder.user_id == user.id)
        .order_by(Reminder.next_run_at.asc().nulls_last(), Reminder.created_at.desc())
    )
    if active_only:
        query = query.where(Reminder.is_active == True)  # noqa: E712

    result = await db.execute(query)
    reminders = list(result.scalars().all())

    return {
        "reminders": [_reminder_to_response(r).model_dump() for r in reminders],
        "total": len(reminders),
    }


@router.post("/reminders", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    body: ReminderCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new reminder (one-time or recurring)."""
    reminder = Reminder(
        user_id=user.id,
        title=body.title,
        description=body.description,
        remind_at=body.remind_at,
        is_recurring=body.is_recurring,
        cron_expression=body.cron_expression,
        category=body.category,
        is_active=True,
    )
    reminder.next_run_at = _compute_next_run(reminder)

    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)

    return {"reminder": _reminder_to_response(reminder).model_dump()}


@router.put("/reminders/{reminder_id}", response_model=dict)
async def update_reminder(
    reminder_id: str,
    body: ReminderUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing reminder. Recomputes next_run_at when schedule fields change."""
    reminder = await _get_reminder_for_user(reminder_id, user, db)

    # Apply updates
    if body.title is not None:
        reminder.title = body.title
    if body.description is not None:
        reminder.description = body.description
    if body.is_active is not None:
        reminder.is_active = body.is_active
    if body.category is not None:
        reminder.category = body.category

    # Handle schedule changes
    schedule_changed = False
    if body.is_recurring is not None:
        reminder.is_recurring = body.is_recurring
        schedule_changed = True
    if body.cron_expression is not None:
        if not croniter.is_valid(body.cron_expression):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid cron expression: {body.cron_expression!r}",
            )
        reminder.cron_expression = body.cron_expression
        schedule_changed = True
    if body.remind_at is not None:
        now = datetime.now(timezone.utc)
        remind_at_utc = body.remind_at
        if remind_at_utc.tzinfo is None:
            remind_at_utc = remind_at_utc.replace(tzinfo=timezone.utc)
        if remind_at_utc <= now:
            raise HTTPException(
                status_code=422, detail="remind_at must be in the future"
            )
        reminder.remind_at = remind_at_utc
        schedule_changed = True

    # Validate consistency
    if reminder.is_recurring and not reminder.cron_expression:
        raise HTTPException(
            status_code=422,
            detail="cron_expression is required for recurring reminders",
        )
    if not reminder.is_recurring and reminder.remind_at is None:
        raise HTTPException(
            status_code=422,
            detail="remind_at is required for one-time reminders",
        )

    # Recompute next_run_at when schedule changed
    if schedule_changed:
        reminder.next_run_at = _compute_next_run(reminder)

    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)

    return {"reminder": _reminder_to_response(reminder).model_dump()}


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a reminder permanently."""
    reminder = await _get_reminder_for_user(reminder_id, user, db)
    await db.delete(reminder)
    await db.flush()


@router.post("/reminders/{reminder_id}/snooze", response_model=dict)
async def snooze_reminder(
    reminder_id: str,
    body: SnoozeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Snooze a reminder by the given number of minutes.
    Sets next_run_at = now + minutes and reactivates the reminder if it was inactive.
    """
    reminder = await _get_reminder_for_user(reminder_id, user, db)

    new_time = datetime.now(timezone.utc) + timedelta(minutes=body.minutes)
    reminder.next_run_at = new_time
    reminder.remind_at = new_time  # also update remind_at for one-time reminders
    reminder.is_active = True

    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)

    return {
        "reminder": _reminder_to_response(reminder).model_dump(),
        "snoozed_until": new_time.isoformat(),
    }
