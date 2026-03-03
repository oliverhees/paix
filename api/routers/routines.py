"""Routines Endpoints — CRUD, runs, chains, webhooks, templates, notifications."""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────


class RoutineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    prompt: str = Field(..., min_length=1)
    cron_expression: str = Field(..., min_length=1, max_length=100)
    timezone: str = "Europe/Berlin"
    skill_ids: list[str] | None = None
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 8192
    temperature: float = 0.7
    max_tool_rounds: int = 3
    timeout_seconds: int = 300
    retry_on_failure: bool = True
    max_retries: int = 2
    retry_delay_seconds: int = 60
    condition_prompt: str | None = None
    requires_approval: bool = False
    max_cost_per_run_cents: int | None = None
    monthly_budget_cents: int | None = None
    system_prompt_override: str | None = None
    tags: list[str] | None = None
    template_id: str | None = None


class RoutineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    prompt: str | None = None
    cron_expression: str | None = None
    timezone: str | None = None
    skill_ids: list[str] | None = None
    model: str | None = None
    max_tokens: int | None = None
    temperature: float | None = None
    max_tool_rounds: int | None = None
    timeout_seconds: int | None = None
    retry_on_failure: bool | None = None
    max_retries: int | None = None
    condition_prompt: str | None = None
    requires_approval: bool | None = None
    max_cost_per_run_cents: int | None = None
    monthly_budget_cents: int | None = None
    system_prompt_override: str | None = None
    tags: list[str] | None = None


class RoutineResponse(BaseModel):
    id: str
    name: str
    description: str | None
    prompt: str
    cron_expression: str
    cron_human: str
    timezone: str
    is_active: bool
    model: str
    max_tokens: int
    temperature: float
    max_tool_rounds: int
    timeout_seconds: int
    retry_on_failure: bool
    max_retries: int
    retry_delay_seconds: int
    condition_prompt: str | None
    requires_approval: bool
    max_cost_per_run_cents: int | None
    monthly_budget_cents: int | None
    next_run_at: datetime | None
    last_run_at: datetime | None
    last_run_status: str | None
    total_runs: int
    total_cost_cents: int
    tags: list
    skill_ids: list[str]
    created_at: datetime | None
    updated_at: datetime | None


class RunResponse(BaseModel):
    id: str
    routine_id: str
    status: str
    trigger_type: str
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    total_tokens: int
    estimated_cost_cents: int
    tool_calls_count: int
    tool_rounds: int
    result_summary: str | None
    error_message: str | None
    condition_result: str | None
    chat_session_id: str | None
    created_at: datetime | None


class RunDetailResponse(RunResponse):
    resolved_prompt: str
    result_text: str | None
    input_context: dict | None
    artifacts: list[dict]


class NotificationResponse(BaseModel):
    id: str
    run_id: str
    title: str
    summary: str
    notification_type: str
    is_pinned: bool
    is_read: bool
    created_at: datetime | None


class ChainCreate(BaseModel):
    target_routine_id: str
    trigger_on: str = "success"
    pass_result: bool = True
    context_mapping: dict | None = None
    execution_order: int = 0


class ChainResponse(BaseModel):
    id: str
    source_routine_id: str
    target_routine_id: str
    trigger_on: str
    pass_result: bool
    is_active: bool
    execution_order: int
    created_at: datetime | None


class WebhookCreate(BaseModel):
    url: str = Field(..., max_length=2000)
    method: str = "POST"
    headers: dict | None = None
    payload_template: str | None = None
    trigger_on: str = "success"
    secret: str | None = None


class WebhookResponse(BaseModel):
    id: str
    routine_id: str
    url: str
    method: str
    trigger_on: str
    is_active: bool
    created_at: datetime | None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    suggested_cron: str
    variables: list
    is_featured: bool
    usage_count: int


class ManualTriggerRequest(BaseModel):
    context: dict | None = None
    skip_condition: bool = False


class AIBuilderRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=2000)


class CreateFromTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    variables: dict = {}
    cron_expression: str | None = None
    timezone: str = "Europe/Berlin"


class ImportRoutineConfig(BaseModel):
    name: str
    prompt: str
    cron_expression: str
    description: str | None = None
    system_prompt_override: str | None = None
    timezone: str = "Europe/Berlin"
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 8192
    temperature: float = 0.7
    max_tool_rounds: int = 3
    timeout_seconds: int = 300
    retry_on_failure: bool = True
    max_retries: int = 2
    retry_delay_seconds: int = 60
    condition_prompt: str | None = None
    requires_approval: bool = False
    max_cost_per_run_cents: int | None = None
    monthly_budget_cents: int | None = None
    tags: list[str] = []


class ImportRequest(BaseModel):
    routines: list[ImportRoutineConfig]


class BulkActionRequest(BaseModel):
    action: str  # "activate" | "deactivate" | "delete"
    routine_ids: list[str]


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────


def _routine_to_response(routine) -> dict:
    from services.routine_service import routine_service

    return {
        "id": str(routine.id),
        "name": routine.name,
        "description": routine.description,
        "prompt": routine.prompt,
        "cron_expression": routine.cron_expression,
        "cron_human": routine_service.cron_to_human(routine.cron_expression),
        "timezone": routine.timezone,
        "is_active": routine.is_active,
        "model": routine.model,
        "max_tokens": routine.max_tokens,
        "temperature": routine.temperature,
        "max_tool_rounds": routine.max_tool_rounds,
        "timeout_seconds": routine.timeout_seconds,
        "retry_on_failure": routine.retry_on_failure,
        "max_retries": routine.max_retries,
        "retry_delay_seconds": routine.retry_delay_seconds,
        "condition_prompt": routine.condition_prompt,
        "requires_approval": routine.requires_approval,
        "max_cost_per_run_cents": routine.max_cost_per_run_cents,
        "monthly_budget_cents": routine.monthly_budget_cents,
        "next_run_at": routine.next_run_at,
        "last_run_at": routine.last_run_at,
        "last_run_status": routine.last_run_status,
        "total_runs": routine.total_runs,
        "total_cost_cents": routine.total_cost_cents,
        "tags": routine.tags or [],
        "skill_ids": [s.skill_id for s in routine.skills]
        if hasattr(routine, "skills") and routine.skills
        else [],
        "created_at": routine.created_at,
        "updated_at": routine.updated_at,
    }


def _run_to_response(run) -> dict:
    return {
        "id": str(run.id),
        "routine_id": str(run.routine_id),
        "status": run.status,
        "trigger_type": run.trigger_type,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "duration_ms": run.duration_ms,
        "total_tokens": run.total_tokens,
        "estimated_cost_cents": run.estimated_cost_cents,
        "tool_calls_count": run.tool_calls_count,
        "tool_rounds": run.tool_rounds,
        "result_summary": run.result_summary,
        "error_message": run.error_message,
        "condition_result": run.condition_result,
        "chat_session_id": str(run.chat_session_id) if run.chat_session_id else None,
        "created_at": run.created_at,
    }


def _run_to_detail_response(run) -> dict:
    base = _run_to_response(run)
    base["resolved_prompt"] = run.resolved_prompt
    base["result_text"] = run.result_text
    base["input_context"] = run.input_context
    base["artifacts"] = [
        {
            "id": str(a.id),
            "title": a.title,
            "artifact_type": a.artifact_type,
            "language": a.language,
            "content": a.content,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in (run.artifacts or [])
    ]
    return base


def _notification_to_response(n) -> dict:
    return {
        "id": str(n.id),
        "run_id": str(n.run_id),
        "title": n.title,
        "summary": n.summary,
        "notification_type": n.notification_type,
        "is_pinned": n.is_pinned,
        "is_read": n.is_read,
        "created_at": n.created_at,
    }


def _chain_to_response(c) -> dict:
    return {
        "id": str(c.id),
        "source_routine_id": str(c.source_routine_id),
        "target_routine_id": str(c.target_routine_id),
        "trigger_on": c.trigger_on,
        "pass_result": c.pass_result,
        "is_active": c.is_active,
        "execution_order": c.execution_order,
        "created_at": c.created_at,
    }


def _webhook_to_response(w) -> dict:
    return {
        "id": str(w.id),
        "routine_id": str(w.routine_id),
        "url": w.url,
        "method": w.method,
        "trigger_on": w.trigger_on,
        "is_active": w.is_active,
        "created_at": w.created_at,
    }


def _template_to_response(t) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "description": t.description,
        "category": t.category,
        "icon": t.icon,
        "suggested_cron": t.suggested_cron,
        "variables": t.variables or [],
        "is_featured": t.is_featured,
        "usage_count": t.usage_count,
    }


# ──────────────────────────────────────────────
# Endpoints — Static paths first (before {routine_id})
# ──────────────────────────────────────────────


@router.get("/routines")
async def list_routines(
    is_active: bool | None = None,
    tag: str | None = None,
    sort: str = "next_run",
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all routines for the current user."""
    from services.routine_service import routine_service

    routines, total = await routine_service.list_routines(
        db,
        user.id,
        is_active=is_active,
        tag=tag,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return {
        "routines": [_routine_to_response(r) for r in routines],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/routines", status_code=status.HTTP_201_CREATED)
async def create_routine(
    body: RoutineCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new routine."""
    from services.routine_scheduler_service import routine_scheduler
    from services.routine_service import routine_service

    routine = await routine_service.create_routine(db, user.id, **body.model_dump())
    routine_scheduler.schedule_routine(routine)
    return {"routine": _routine_to_response(routine)}


# ---- Notifications (static path before {routine_id}) ----


@router.get("/routines/notifications")
async def list_notifications(
    pinned_only: bool = False,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List routine notifications for the current user."""
    from services.routine_service import routine_service

    notifications = await routine_service.list_notifications(
        db, user.id, pinned_only=pinned_only, limit=limit
    )
    return {
        "notifications": [_notification_to_response(n) for n in notifications],
        "total": len(notifications),
    }


@router.get("/routines/notifications/count")
async def get_notification_counts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get unread and pinned notification counts."""
    from services.routine_service import routine_service

    counts = await routine_service.get_notification_counts(db, user.id)
    return counts


@router.post("/routines/notifications/dismiss-all", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_all_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Dismiss all routine notifications for the current user."""
    from services.routine_service import routine_service

    await routine_service.dismiss_all_notifications(db, user.id)


# ---- Push Subscriptions (static path before {routine_id}) ----


class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh_key: str
    auth_key: str
    user_agent: str | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/routines/push/subscribe", status_code=status.HTTP_201_CREATED)
async def push_subscribe(
    body: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Register a Web Push subscription."""
    from services.push_notification_service import push_notification_service

    sub = await push_notification_service.subscribe(
        db, user.id, body.endpoint, body.p256dh_key, body.auth_key, body.user_agent
    )
    await db.commit()
    return {"subscription_id": str(sub.id), "status": "subscribed"}


@router.delete("/routines/push/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def push_unsubscribe(
    body: PushUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove a Web Push subscription."""
    from services.push_notification_service import push_notification_service

    await push_notification_service.unsubscribe(db, user.id, body.endpoint)
    await db.commit()


@router.get("/routines/push/status")
async def push_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get push subscription status and VAPID public key."""
    from services.push_notification_service import push_notification_service

    return await push_notification_service.get_subscription_status(db, user.id)


# ---- Templates (static path before {routine_id}) ----


@router.get("/routines/templates")
async def list_templates(
    category: str | None = None,
    featured: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List available routine templates."""
    from services.routine_service import routine_service

    templates = await routine_service.list_templates(
        db, category=category, featured=featured
    )
    return {
        "templates": [_template_to_response(t) for t in templates],
        "total": len(templates),
    }


@router.get("/routines/templates/{template_id}")
async def get_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single routine template by ID."""
    from services.routine_service import routine_service

    template = await routine_service.get_template(db, uuid.UUID(template_id))
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"template": _template_to_response(template)}


@router.post("/routines/from-template/{template_id}", status_code=status.HTTP_201_CREATED)
async def create_from_template(
    template_id: str,
    body: CreateFromTemplateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a routine from a template."""
    from services.routine_scheduler_service import routine_scheduler
    from services.routine_service import routine_service

    routine = await routine_service.create_from_template(
        db,
        user.id,
        uuid.UUID(template_id),
        name=body.name,
        variables=body.variables,
        cron_expression=body.cron_expression,
        timezone=body.timezone,
    )
    if not routine:
        raise HTTPException(status_code=404, detail="Template not found")
    routine_scheduler.schedule_routine(routine)
    return {"routine": _routine_to_response(routine)}


# ---- Analytics (static path before {routine_id}) ----


@router.get("/routines/analytics")
async def get_analytics(
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get aggregated analytics for the current user's routine runs.

    Optional query params:
    - date_from: ISO-8601 date/datetime string (inclusive lower bound on created_at)
    - date_to:   ISO-8601 date/datetime string (inclusive upper bound on created_at)
    """
    from services.routine_service import routine_service

    parsed_from: datetime | None = None
    parsed_to: datetime | None = None

    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            parsed_from = dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid date_from format: '{date_from}'. Use ISO-8601 (e.g. 2026-01-01 or 2026-01-01T00:00:00).",
            )

    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            parsed_to = dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid date_to format: '{date_to}'. Use ISO-8601 (e.g. 2026-03-31 or 2026-03-31T23:59:59).",
            )

    analytics = await routine_service.get_analytics(
        db, user.id, date_from=parsed_from, date_to=parsed_to
    )
    return analytics


# ---- Chains graph (static path before {routine_id}) ----


@router.get("/routines/chains/graph")
async def get_chain_graph(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the full chain DAG for the current user's routines."""
    from services.routine_service import routine_service

    graph = await routine_service.get_chain_graph(db, user.id)
    return graph


# ---- Chains delete (static path before {routine_id}) ----


@router.delete("/routines/chains/{chain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chain(
    chain_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a chain link."""
    from services.routine_service import routine_service

    deleted = await routine_service.delete_chain(db, uuid.UUID(chain_id), user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chain not found")


# ---- Webhooks delete (static path before {routine_id}) ----


@router.delete("/routines/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a webhook."""
    from services.routine_service import routine_service

    deleted = await routine_service.delete_webhook(db, uuid.UUID(webhook_id), user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Webhook not found")


# ---- Notification dismiss (static path) ----


@router.put(
    "/routines/notifications/{notification_id}/dismiss",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def dismiss_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Dismiss a single routine notification."""
    from services.routine_service import routine_service

    dismissed = await routine_service.dismiss_notification(
        db, uuid.UUID(notification_id), user.id
    )
    if not dismissed:
        raise HTTPException(status_code=404, detail="Notification not found")


# ---- AI Builder (static path before {routine_id}) ----


_AI_BUILDER_SYSTEM_PROMPT = """You are a routine configuration expert for an AI task automation platform.
The user will describe a routine they want to create. Your job is to generate a complete, production-ready
routine configuration as a JSON object.

Return ONLY a valid JSON object with exactly these fields:
{
  "name": "<short, descriptive name (max 80 chars)>",
  "description": "<one-sentence description of what this routine does>",
  "prompt": "<the full prompt the AI will execute on each run — be specific and actionable>",
  "cron_expression": "<valid cron expression, e.g. '0 8 * * 1-5' for weekdays at 8am>",
  "model": "claude-sonnet-4-6",
  "max_tokens": <integer between 1024 and 16384>,
  "temperature": <float between 0.0 and 1.0>,
  "tags": [<list of relevant string tags>],
  "skill_ids": []
}

Guidelines:
- cron_expression must be a valid 5-part cron string (minute hour day month weekday)
- Use sensible defaults: max_tokens 4096, temperature 0.7 for most routines
- The prompt field should be detailed enough to produce useful output without further clarification
- tags should reflect the category (e.g. "productivity", "monitoring", "reporting")
- skill_ids is always an empty list unless the user explicitly mentions specific tools
- All text should match the language used in the user's description
- Do NOT include any explanation outside the JSON object"""


@router.post("/routines/ai-builder")
async def ai_builder(
    body: AIBuilderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a routine configuration from a natural language description using AI."""
    from services.llm_service import llm_service
    from services.llm_service import get_user_anthropic_key

    api_key = await get_user_anthropic_key(user.id, db)

    messages = [
        {
            "role": "user",
            "content": f"Create a routine configuration for the following description:\n\n{body.description}",
        }
    ]

    try:
        raw_response = await llm_service.complete(
            messages=messages,
            system_prompt=_AI_BUILDER_SYSTEM_PROMPT,
            model="claude-sonnet-4-6",
            max_tokens=1024,
            temperature=0.3,
            api_key=api_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("AI builder LLM call failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    # Strip markdown code fences if the model wrapped its output
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Drop first line (```json or ```) and last line (```)
        cleaned = "\n".join(lines[1:-1]).strip()

    try:
        suggestion = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("AI builder returned invalid JSON: %s | raw: %s", exc, raw_response[:500])
        raise HTTPException(
            status_code=502,
            detail="AI returned an invalid configuration. Please rephrase your description.",
        ) from exc

    # Enforce required keys and safe defaults
    suggestion.setdefault("model", "claude-sonnet-4-6")
    suggestion.setdefault("max_tokens", 4096)
    suggestion.setdefault("temperature", 0.7)
    suggestion.setdefault("tags", [])
    suggestion.setdefault("skill_ids", [])

    # Clamp numeric values to safe ranges
    suggestion["max_tokens"] = max(512, min(16384, int(suggestion.get("max_tokens", 4096))))
    suggestion["temperature"] = max(0.0, min(1.0, float(suggestion.get("temperature", 0.7))))

    return {"suggestion": suggestion}


# ---- Export / Import / Bulk (static paths before {routine_id}) ----


@router.get("/routines/export")
async def export_routines(
    ids: str | None = None,  # comma-separated UUIDs
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all or selected routines as JSON."""
    from services.routine_service import routine_service

    routine_ids = None
    if ids:
        routine_ids = [uuid.UUID(id.strip()) for id in ids.split(",")]
    routines = await routine_service.export_routines(db, user.id, routine_ids)
    return {
        "routines": routines,
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/routines/import", status_code=201)
async def import_routines(
    body: ImportRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import routines from exported JSON. Imported routines start inactive."""
    from services.routine_service import routine_service

    created_ids = await routine_service.import_routines(
        db, user.id, [r.model_dump() for r in body.routines]
    )
    await db.commit()
    return {"imported": len(created_ids), "routine_ids": [str(id) for id in created_ids]}


@router.post("/routines/bulk")
async def bulk_action(
    body: BulkActionRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Perform bulk action (activate/deactivate/delete) on routines."""
    from services.routine_service import routine_service

    if body.action not in ("activate", "deactivate", "delete"):
        raise HTTPException(status_code=400, detail="Invalid action")
    ids = [uuid.UUID(id) for id in body.routine_ids]
    count = await routine_service.bulk_action(db, user.id, ids, body.action)
    await db.commit()
    if body.action in ("activate", "deactivate"):
        from services.routine_scheduler_service import routine_scheduler
        await routine_scheduler.load_all_jobs()
    return {"affected": count, "action": body.action}


# ---- Schedule (static path before {routine_id}) ----


@router.get("/routines/schedule")
async def get_schedule(
    count: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the next N upcoming scheduled runs across all active routines."""
    from services.routine_service import routine_service

    schedule = await routine_service.get_schedule(db, user.id, count=min(count, 100))
    return {"schedule": schedule, "count": len(schedule)}


# ──────────────────────────────────────────────
# Endpoints — Parameterized {routine_id} paths
# ──────────────────────────────────────────────


@router.get("/routines/{routine_id}/export")
async def export_single_routine(
    routine_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a single routine as JSON."""
    from services.routine_service import routine_service

    result = await routine_service.export_routine(db, uuid.UUID(routine_id), user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Routine not found")
    return {
        "routine": result,
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/routines/{routine_id}")
async def get_routine(
    routine_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single routine by ID."""
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return {"routine": _routine_to_response(routine)}


@router.put("/routines/{routine_id}")
async def update_routine(
    routine_id: str,
    body: RoutineUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update an existing routine."""
    from services.routine_scheduler_service import routine_scheduler
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    update_data = body.model_dump(exclude_unset=True)
    routine = await routine_service.update_routine(db, routine, update_data)

    # Re-schedule if cron or active status changed
    if routine.is_active:
        routine_scheduler.schedule_routine(routine)
    else:
        routine_scheduler.unschedule_routine(str(routine.id))

    return {"routine": _routine_to_response(routine)}


@router.delete("/routines/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(
    routine_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a routine permanently."""
    from services.routine_scheduler_service import routine_scheduler
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    routine_scheduler.unschedule_routine(str(routine.id))
    await routine_service.delete_routine(db, routine)


@router.patch("/routines/{routine_id}/toggle")
async def toggle_routine(
    routine_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Toggle a routine's active state."""
    from services.routine_scheduler_service import routine_scheduler
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    routine = await routine_service.toggle_routine(db, routine)

    if routine.is_active:
        routine_scheduler.schedule_routine(routine)
    else:
        routine_scheduler.unschedule_routine(str(routine.id))

    return {"routine": _routine_to_response(routine)}


@router.post("/routines/{routine_id}/run", status_code=202)
async def trigger_run(
    routine_id: str,
    data: ManualTriggerRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually trigger a routine run."""
    from services.routine_service import routine_service
    from services.routine_executor_service import routine_executor

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    result = await routine_executor.execute_manual(
        routine_id=routine.id,
        user_id=user.id,
        context=data.context if data else None,
        skip_condition=data.skip_condition if data else False,
    )
    return result


@router.post("/routines/{routine_id}/runs/{run_id}/cancel")
async def cancel_run(
    routine_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel a pending or running routine execution."""
    from services.routine_executor_service import routine_executor

    cancelled = await routine_executor.cancel_run(uuid.UUID(run_id), user.id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Run not found or cannot be cancelled")
    return {"status": "cancelled", "run_id": run_id}


@router.post("/routines/{routine_id}/runs/{run_id}/retry", status_code=202)
async def retry_run(
    routine_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retry a failed routine run."""
    from services.routine_executor_service import routine_executor

    result = await routine_executor.retry_run(uuid.UUID(run_id), user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Run not found or cannot be retried")
    return result


@router.get("/routines/{routine_id}/runs")
async def list_runs(
    routine_id: str,
    status_filter: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List runs for a specific routine."""
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    runs, total = await routine_service.list_runs(
        db,
        routine.id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return {
        "runs": [_run_to_response(r) for r in runs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/routines/{routine_id}/runs/{run_id}")
async def get_run_detail(
    routine_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get detailed information about a specific run."""
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    run = await routine_service.get_run(db, uuid.UUID(run_id), routine.id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return {"run": _run_to_detail_response(run)}


# ---- Chains (nested under routine) ----


@router.get("/routines/{routine_id}/chains")
async def list_chains(
    routine_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List chains where this routine is the source."""
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    chains = await routine_service.list_chains(db, routine.id)
    return {
        "chains": [_chain_to_response(c) for c in chains],
        "total": len(chains),
    }


@router.post("/routines/{routine_id}/chains", status_code=status.HTTP_201_CREATED)
async def add_chain(
    routine_id: str,
    body: ChainCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a chain link from this routine to a target routine."""
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Source routine not found")

    # Verify target routine exists and belongs to user
    target = await routine_service.get_routine(
        db, uuid.UUID(body.target_routine_id), user.id
    )
    if not target:
        raise HTTPException(status_code=404, detail="Target routine not found")

    chain = await routine_service.create_chain(
        db,
        source_routine_id=routine.id,
        target_routine_id=target.id,
        trigger_on=body.trigger_on,
        pass_result=body.pass_result,
        context_mapping=body.context_mapping,
        execution_order=body.execution_order,
    )
    return {"chain": _chain_to_response(chain)}


# ---- Webhooks (nested under routine) ----


@router.get("/routines/{routine_id}/webhooks")
async def list_webhooks(
    routine_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List webhooks for a specific routine."""
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    webhooks = await routine_service.list_webhooks(db, routine.id)
    return {
        "webhooks": [_webhook_to_response(w) for w in webhooks],
        "total": len(webhooks),
    }


@router.post("/routines/{routine_id}/webhooks", status_code=status.HTTP_201_CREATED)
async def add_webhook(
    routine_id: str,
    body: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a webhook to a routine."""
    from services.routine_service import routine_service

    routine = await routine_service.get_routine(db, uuid.UUID(routine_id), user.id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    webhook = await routine_service.create_webhook(
        db,
        routine_id=routine.id,
        url=body.url,
        method=body.method,
        headers=body.headers,
        payload_template=body.payload_template,
        trigger_on=body.trigger_on,
        secret=body.secret,
    )
    return {"webhook": _webhook_to_response(webhook)}
