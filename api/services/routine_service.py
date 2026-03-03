"""Routine Service — CRUD and business logic for routines."""

import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from croniter import croniter
from sqlalchemy import func, select, update, delete, case, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.routine import (
    Routine, RoutineSkill, RoutineRun, RoutineRunArtifact,
    RoutineNotification, RoutineChain, RoutineWebhook,
    RoutineTemplate,
)


class RoutineService:
    """CRUD and business logic for routines."""

    # ── Routine CRUD ──

    async def create_routine(self, db, user_id, name, prompt, cron_expression,
                             description=None, timezone="Europe/Berlin",
                             skill_ids=None, model="claude-sonnet-4-6",
                             max_tokens=8192, temperature=0.7,
                             max_tool_rounds=3, timeout_seconds=300,
                             retry_on_failure=True, max_retries=2,
                             retry_delay_seconds=60, condition_prompt=None,
                             requires_approval=False, max_cost_per_run_cents=None,
                             monthly_budget_cents=None, system_prompt_override=None,
                             tags=None, template_id=None) -> Routine:
        """Create a routine with optional skills."""
        # Validate cron expression
        if not croniter.is_valid(cron_expression):
            raise ValueError(f"Invalid cron expression: {cron_expression}")

        # Compute next_run_at
        next_run = self.compute_next_run(cron_expression, timezone)

        routine = Routine(
            user_id=user_id, name=name, prompt=prompt,
            cron_expression=cron_expression, description=description,
            timezone=timezone, model=model, max_tokens=max_tokens,
            temperature=temperature, max_tool_rounds=max_tool_rounds,
            timeout_seconds=timeout_seconds, retry_on_failure=retry_on_failure,
            max_retries=max_retries, retry_delay_seconds=retry_delay_seconds,
            condition_prompt=condition_prompt, requires_approval=requires_approval,
            max_cost_per_run_cents=max_cost_per_run_cents,
            monthly_budget_cents=monthly_budget_cents,
            system_prompt_override=system_prompt_override,
            tags=tags or [], template_id=template_id,
            next_run_at=next_run,
        )
        db.add(routine)
        await db.flush()

        # Create skill associations
        if skill_ids:
            for sid in skill_ids:
                db.add(RoutineSkill(routine_id=routine.id, skill_id=sid))
            await db.flush()

        return routine

    async def get_routine(self, db, routine_id, user_id) -> Routine | None:
        """Get a routine by ID, ensuring it belongs to user."""
        result = await db.execute(
            select(Routine)
            .options(selectinload(Routine.skills))
            .where(Routine.id == routine_id, Routine.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_routines(self, db, user_id, is_active=None, tag=None,
                            sort="next_run", limit=20, offset=0) -> tuple[list[Routine], int]:
        """List routines for a user with filters and pagination."""
        # Count
        count_q = select(func.count()).select_from(Routine).where(Routine.user_id == user_id)
        if is_active is not None:
            count_q = count_q.where(Routine.is_active == is_active)
        count_result = await db.execute(count_q)
        total = count_result.scalar() or 0

        # Query
        q = select(Routine).options(selectinload(Routine.skills)).where(Routine.user_id == user_id)
        if is_active is not None:
            q = q.where(Routine.is_active == is_active)
        if tag:
            q = q.where(Routine.tags.contains([tag]))

        # Sorting
        sort_map = {
            "next_run": Routine.next_run_at.asc().nullslast(),
            "last_run": Routine.last_run_at.desc().nullslast(),
            "created": Routine.created_at.desc(),
            "name": Routine.name.asc(),
        }
        q = q.order_by(sort_map.get(sort, Routine.next_run_at.asc().nullslast()))
        q = q.limit(limit).offset(offset)

        result = await db.execute(q)
        return list(result.scalars().all()), total

    async def update_routine(self, db, routine_id, user_id, **kwargs) -> Routine | None:
        """Update routine fields. Recomputes next_run if schedule changed."""
        routine = await self.get_routine(db, routine_id, user_id)
        if not routine:
            return None

        schedule_changed = False
        for key, value in kwargs.items():
            if key == "skill_ids":
                continue  # Handle separately
            if hasattr(routine, key) and value is not None:
                if key in ("cron_expression", "timezone"):
                    schedule_changed = True
                setattr(routine, key, value)

        # Handle skill_ids update
        if "skill_ids" in kwargs and kwargs["skill_ids"] is not None:
            await db.execute(
                delete(RoutineSkill).where(RoutineSkill.routine_id == routine_id)
            )
            for sid in kwargs["skill_ids"]:
                db.add(RoutineSkill(routine_id=routine_id, skill_id=sid))

        # Recompute next_run if schedule changed
        if schedule_changed:
            if croniter.is_valid(routine.cron_expression):
                routine.next_run_at = self.compute_next_run(
                    routine.cron_expression, routine.timezone
                )
            else:
                raise ValueError(f"Invalid cron expression: {routine.cron_expression}")

        await db.flush()
        return routine

    async def delete_routine(self, db, routine_id, user_id) -> bool:
        """Delete a routine. Returns True if found and deleted."""
        routine = await self.get_routine(db, routine_id, user_id)
        if not routine:
            return False
        await db.delete(routine)
        await db.flush()
        return True

    async def toggle_routine(self, db, routine_id, user_id) -> Routine | None:
        """Toggle is_active. Recompute next_run when activating."""
        routine = await self.get_routine(db, routine_id, user_id)
        if not routine:
            return None

        routine.is_active = not routine.is_active
        if routine.is_active:
            routine.next_run_at = self.compute_next_run(
                routine.cron_expression, routine.timezone
            )
        else:
            routine.next_run_at = None

        await db.flush()
        return routine

    # ── Run Management ──

    async def create_run(self, db, routine_id, user_id, resolved_prompt,
                         trigger_type="scheduled", input_context=None,
                         parent_run_id=None) -> RoutineRun:
        """Create a new run record."""
        run = RoutineRun(
            routine_id=routine_id, user_id=user_id,
            resolved_prompt=resolved_prompt, trigger_type=trigger_type,
            input_context=input_context, parent_run_id=parent_run_id,
        )
        db.add(run)
        await db.flush()
        return run

    async def get_run(self, db, run_id, user_id=None) -> RoutineRun | None:
        """Get a run by ID."""
        q = select(RoutineRun).options(
            selectinload(RoutineRun.artifacts)
        ).where(RoutineRun.id == run_id)
        if user_id:
            q = q.where(RoutineRun.user_id == user_id)
        result = await db.execute(q)
        return result.scalar_one_or_none()

    async def list_runs(self, db, routine_id, user_id,
                        status=None, limit=20, offset=0) -> tuple[list[RoutineRun], int]:
        """List runs for a routine."""
        count_q = (
            select(func.count()).select_from(RoutineRun)
            .where(RoutineRun.routine_id == routine_id, RoutineRun.user_id == user_id)
        )
        if status:
            count_q = count_q.where(RoutineRun.status == status)
        total = (await db.execute(count_q)).scalar() or 0

        q = (
            select(RoutineRun)
            .where(RoutineRun.routine_id == routine_id, RoutineRun.user_id == user_id)
            .order_by(RoutineRun.created_at.desc())
            .limit(limit).offset(offset)
        )
        if status:
            q = q.where(RoutineRun.status == status)

        result = await db.execute(q)
        return list(result.scalars().all()), total

    async def update_run_status(self, db, run_id, status, **kwargs) -> None:
        """Update run status and optional fields."""
        values = {"status": status, **kwargs}
        await db.execute(
            update(RoutineRun).where(RoutineRun.id == run_id).values(**values)
        )

    async def update_routine_stats(self, db, routine_id, run_status,
                                   cost_cents=0) -> None:
        """Update routine cached stats after a run completes."""
        values = {
            "last_run_at": datetime.now(ZoneInfo("UTC")),
            "last_run_status": run_status,
            "total_runs": Routine.total_runs + 1,
            "total_cost_cents": Routine.total_cost_cents + cost_cents,
        }
        await db.execute(
            update(Routine).where(Routine.id == routine_id).values(**values)
        )

    # ── Notifications ──

    async def create_notification(self, db, run_id, user_id, title, summary,
                                  notification_type="result") -> RoutineNotification:
        """Create a routine notification."""
        notif = RoutineNotification(
            run_id=run_id, user_id=user_id, title=title,
            summary=summary, notification_type=notification_type,
        )
        db.add(notif)
        await db.flush()
        return notif

    async def list_notifications(self, db, user_id, pinned_only=True,
                                 limit=20) -> tuple[list[RoutineNotification], int, int]:
        """List routine notifications. Returns (notifications, pinned_count, total)."""
        pinned_q = (
            select(func.count()).select_from(RoutineNotification)
            .where(RoutineNotification.user_id == user_id, RoutineNotification.is_pinned == True)
        )
        pinned_count = (await db.execute(pinned_q)).scalar() or 0

        q = (
            select(RoutineNotification)
            .where(RoutineNotification.user_id == user_id)
            .order_by(RoutineNotification.created_at.desc())
            .limit(limit)
        )
        if pinned_only:
            q = q.where(RoutineNotification.is_pinned == True)

        result = await db.execute(q)
        notifications = list(result.scalars().all())
        return notifications, pinned_count, len(notifications)

    async def dismiss_notification(self, db, notification_id, user_id) -> bool:
        """Dismiss (unpin) a notification."""
        result = await db.execute(
            update(RoutineNotification)
            .where(RoutineNotification.id == notification_id, RoutineNotification.user_id == user_id)
            .values(is_pinned=False, is_read=True, dismissed_at=datetime.now(ZoneInfo("UTC")))
        )
        return result.rowcount > 0

    async def dismiss_all_notifications(self, db, user_id) -> int:
        """Dismiss all pinned notifications. Returns count."""
        result = await db.execute(
            update(RoutineNotification)
            .where(RoutineNotification.user_id == user_id, RoutineNotification.is_pinned == True)
            .values(is_pinned=False, is_read=True, dismissed_at=datetime.now(ZoneInfo("UTC")))
        )
        return result.rowcount

    async def get_notification_counts(self, db, user_id) -> dict:
        """Get pinned and unread counts."""
        pinned = (await db.execute(
            select(func.count()).select_from(RoutineNotification)
            .where(RoutineNotification.user_id == user_id, RoutineNotification.is_pinned == True)
        )).scalar() or 0
        unread = (await db.execute(
            select(func.count()).select_from(RoutineNotification)
            .where(RoutineNotification.user_id == user_id, RoutineNotification.is_read == False)
        )).scalar() or 0
        return {"pinned": pinned, "unread": unread}

    # ── Chains ──

    async def add_chain(self, db, source_routine_id, target_routine_id,
                        trigger_on="success", pass_result=True,
                        context_mapping=None, execution_order=0) -> RoutineChain:
        """Add a chain link. Validates no cycles."""
        # Check cycle
        if await self._would_create_cycle(db, source_routine_id, target_routine_id):
            raise ValueError("Adding this chain would create a cycle")

        chain = RoutineChain(
            source_routine_id=source_routine_id,
            target_routine_id=target_routine_id,
            trigger_on=trigger_on, pass_result=pass_result,
            context_mapping=context_mapping, execution_order=execution_order,
        )
        db.add(chain)
        await db.flush()
        return chain

    async def delete_chain(self, db, chain_id) -> bool:
        """Delete a chain link."""
        result = await db.execute(
            delete(RoutineChain).where(RoutineChain.id == chain_id)
        )
        return result.rowcount > 0

    async def list_chains(self, db, routine_id) -> list[RoutineChain]:
        """List chains where routine is source or target."""
        result = await db.execute(
            select(RoutineChain).where(
                (RoutineChain.source_routine_id == routine_id) |
                (RoutineChain.target_routine_id == routine_id)
            ).order_by(RoutineChain.execution_order)
        )
        return list(result.scalars().all())

    async def get_chain_graph(self, db, user_id) -> dict:
        """Get full DAG for a user (nodes + edges)."""
        routines_result = await db.execute(
            select(Routine.id, Routine.name, Routine.is_active)
            .where(Routine.user_id == user_id)
        )
        nodes = [{"id": str(r.id), "name": r.name, "is_active": r.is_active}
                 for r in routines_result.all()]

        routine_ids = [n["id"] for n in nodes]
        chains_result = await db.execute(
            select(RoutineChain).where(
                RoutineChain.source_routine_id.in_(routine_ids)
            )
        )
        edges = [{
            "id": str(c.id),
            "source": str(c.source_routine_id),
            "target": str(c.target_routine_id),
            "trigger_on": c.trigger_on,
            "is_active": c.is_active,
        } for c in chains_result.scalars().all()]

        return {"nodes": nodes, "edges": edges}

    async def _would_create_cycle(self, db, source_id, target_id) -> bool:
        """DFS cycle detection: would adding source->target create a cycle?"""
        if source_id == target_id:
            return True

        # BFS from target, see if we can reach source
        visited = set()
        queue = [target_id]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)

            result = await db.execute(
                select(RoutineChain.target_routine_id)
                .where(RoutineChain.source_routine_id == current)
            )
            for row in result.all():
                next_id = row[0]
                if next_id == source_id:
                    return True
                queue.append(next_id)

        return False

    # ── Webhooks ──

    async def add_webhook(self, db, routine_id, url, method="POST",
                          headers=None, payload_template=None,
                          trigger_on="success", secret=None) -> RoutineWebhook:
        """Add a webhook to a routine."""
        webhook = RoutineWebhook(
            routine_id=routine_id, url=url, method=method,
            headers=headers or {}, payload_template=payload_template,
            trigger_on=trigger_on, secret=secret,
        )
        db.add(webhook)
        await db.flush()
        return webhook

    async def list_webhooks(self, db, routine_id) -> list[RoutineWebhook]:
        """List webhooks for a routine."""
        result = await db.execute(
            select(RoutineWebhook).where(RoutineWebhook.routine_id == routine_id)
        )
        return list(result.scalars().all())

    async def delete_webhook(self, db, webhook_id) -> bool:
        """Delete a webhook."""
        result = await db.execute(
            delete(RoutineWebhook).where(RoutineWebhook.id == webhook_id)
        )
        return result.rowcount > 0

    # ── Templates ──

    async def list_templates(self, db, category=None,
                             featured=None) -> list[RoutineTemplate]:
        """List routine templates."""
        q = select(RoutineTemplate).order_by(RoutineTemplate.usage_count.desc())
        if category:
            q = q.where(RoutineTemplate.category == category)
        if featured is not None:
            q = q.where(RoutineTemplate.is_featured == featured)
        result = await db.execute(q)
        return list(result.scalars().all())

    async def get_template(self, db, template_id) -> RoutineTemplate | None:
        """Get a template by ID."""
        result = await db.execute(
            select(RoutineTemplate).where(RoutineTemplate.id == template_id)
        )
        return result.scalar_one_or_none()

    async def create_from_template(self, db, user_id, template_id,
                                   name, variables, cron_expression=None,
                                   timezone="Europe/Berlin") -> Routine:
        """Create a routine from a template."""
        template = await self.get_template(db, template_id)
        if not template:
            raise ValueError("Template not found")

        # Substitute variables in prompt
        prompt = template.prompt_template
        for key, value in variables.items():
            prompt = prompt.replace("{{" + key + "}}", str(value))

        routine = await self.create_routine(
            db, user_id=user_id, name=name, prompt=prompt,
            cron_expression=cron_expression or template.suggested_cron,
            timezone=timezone,
            model=template.default_model,
            max_tokens=template.default_max_tokens,
            system_prompt_override=template.system_prompt_override,
            skill_ids=template.suggested_skills,
            template_id=template_id,
        )

        # Increment usage count
        await db.execute(
            update(RoutineTemplate)
            .where(RoutineTemplate.id == template_id)
            .values(usage_count=RoutineTemplate.usage_count + 1)
        )

        return routine

    # ── Analytics ──

    async def get_analytics(
        self,
        db: AsyncSession,
        user_id,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> dict:
        """Return aggregated analytics for a user's routine runs.

        Executes three SQL-level aggregation queries — no Python loops over rows.
        All queries are scoped strictly to user_id to prevent cross-user leakage.
        """

        # ── Query 1: Overall summary ──
        summary_q = select(
            func.count().label("total_runs"),
            func.count(
                case((RoutineRun.status == "completed", 1))
            ).label("successful"),
            func.count(
                case((RoutineRun.status == "failed", 1))
            ).label("failed"),
            func.coalesce(func.sum(RoutineRun.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(RoutineRun.estimated_cost_cents), 0).label("total_cost_cents"),
            func.coalesce(func.avg(RoutineRun.duration_ms), 0).label("avg_duration_ms"),
        ).where(RoutineRun.user_id == user_id)

        if date_from is not None:
            summary_q = summary_q.where(RoutineRun.created_at >= date_from)
        if date_to is not None:
            summary_q = summary_q.where(RoutineRun.created_at <= date_to)

        summary_row = (await db.execute(summary_q)).one()

        total_runs = summary_row.total_runs or 0
        successful = summary_row.successful or 0
        failed = summary_row.failed or 0
        success_rate = round((successful / total_runs * 100), 2) if total_runs > 0 else 0.0

        summary = {
            "total_runs": total_runs,
            "successful_runs": successful,
            "failed_runs": failed,
            "success_rate": success_rate,
            "total_tokens": int(summary_row.total_tokens),
            "total_cost_cents": int(summary_row.total_cost_cents),
            "avg_duration_ms": float(summary_row.avg_duration_ms),
        }

        # ── Query 2: Daily breakdown — last 30 days ──
        thirty_days_ago = datetime.now(ZoneInfo("UTC")) - timedelta(days=30)
        day_label = cast(RoutineRun.created_at, Date).label("date")

        daily_q = (
            select(
                day_label,
                func.count().label("total"),
                func.count(
                    case((RoutineRun.status == "completed", 1))
                ).label("success"),
                func.count(
                    case((RoutineRun.status == "failed", 1))
                ).label("failed"),
            )
            .where(
                RoutineRun.user_id == user_id,
                RoutineRun.created_at >= thirty_days_ago,
            )
            .group_by(day_label)
            .order_by(day_label)
        )

        daily_rows = (await db.execute(daily_q)).all()
        daily_runs = [
            {
                "date": str(row.date),
                "total": row.total,
                "success": row.success,
                "failed": row.failed,
            }
            for row in daily_rows
        ]

        # ── Query 3: Per-routine breakdown ──
        per_routine_q = (
            select(
                RoutineRun.routine_id.label("routine_id"),
                Routine.name.label("routine_name"),
                func.count().label("run_count"),
                func.count(
                    case((RoutineRun.status == "completed", 1))
                ).label("success_count"),
                func.coalesce(func.avg(RoutineRun.duration_ms), 0).label("avg_duration_ms"),
                func.coalesce(func.sum(RoutineRun.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(RoutineRun.estimated_cost_cents), 0).label("total_cost_cents"),
            )
            .join(Routine, Routine.id == RoutineRun.routine_id)
            .where(RoutineRun.user_id == user_id)
            .group_by(RoutineRun.routine_id, Routine.name)
            .order_by(func.count().desc())
        )

        if date_from is not None:
            per_routine_q = per_routine_q.where(RoutineRun.created_at >= date_from)
        if date_to is not None:
            per_routine_q = per_routine_q.where(RoutineRun.created_at <= date_to)

        per_routine_rows = (await db.execute(per_routine_q)).all()
        per_routine = [
            {
                "routine_id": str(row.routine_id),
                "routine_name": row.routine_name,
                "run_count": row.run_count,
                "success_count": row.success_count,
                "avg_duration_ms": float(row.avg_duration_ms),
                "total_tokens": int(row.total_tokens),
                "total_cost_cents": int(row.total_cost_cents),
            }
            for row in per_routine_rows
        ]

        return {
            "summary": summary,
            "daily_runs": daily_runs,
            "per_routine": per_routine,
        }

    # ── Export / Import / Bulk ──

    async def export_routine(self, db, routine_id, user_id) -> dict | None:
        """Export a single routine as a portable JSON config."""
        routine = await self.get_routine(db, routine_id, user_id)
        if not routine:
            return None
        return self._routine_to_export(routine)

    def _routine_to_export(self, routine) -> dict:
        """Convert a routine to a portable export format (no user data, no IDs)."""
        return {
            "name": routine.name,
            "description": routine.description,
            "prompt": routine.prompt,
            "system_prompt_override": routine.system_prompt_override,
            "cron_expression": routine.cron_expression,
            "timezone": routine.timezone,
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
            "tags": routine.tags or [],
        }

    async def export_routines(self, db, user_id, routine_ids=None) -> list[dict]:
        """Export multiple routines. If routine_ids provided, export only those."""
        q = select(Routine).where(Routine.user_id == user_id)
        if routine_ids:
            q = q.where(Routine.id.in_(routine_ids))
        result = await db.execute(q)
        routines = list(result.scalars().all())
        return [self._routine_to_export(r) for r in routines]

    async def import_routines(self, db, user_id, routine_configs: list[dict]) -> list:
        """Import routines from exported configs. Returns list of created routine IDs."""
        created_ids = []
        for config in routine_configs:
            routine = Routine(
                user_id=user_id,
                name=config["name"],
                description=config.get("description"),
                prompt=config["prompt"],
                system_prompt_override=config.get("system_prompt_override"),
                cron_expression=config["cron_expression"],
                timezone=config.get("timezone", "Europe/Berlin"),
                model=config.get("model", "claude-sonnet-4-6"),
                max_tokens=config.get("max_tokens", 8192),
                temperature=config.get("temperature", 0.7),
                max_tool_rounds=config.get("max_tool_rounds", 3),
                timeout_seconds=config.get("timeout_seconds", 300),
                retry_on_failure=config.get("retry_on_failure", True),
                max_retries=config.get("max_retries", 2),
                retry_delay_seconds=config.get("retry_delay_seconds", 60),
                condition_prompt=config.get("condition_prompt"),
                requires_approval=config.get("requires_approval", False),
                max_cost_per_run_cents=config.get("max_cost_per_run_cents"),
                monthly_budget_cents=config.get("monthly_budget_cents"),
                tags=config.get("tags", []),
                is_active=False,  # imported routines start inactive
            )
            db.add(routine)
            await db.flush()
            created_ids.append(routine.id)
        return created_ids

    async def bulk_action(self, db, user_id, routine_ids: list, action: str) -> int:
        """Perform bulk action on routines. Returns count of affected routines."""
        q = select(Routine).where(
            Routine.user_id == user_id,
            Routine.id.in_(routine_ids),
        )
        result = await db.execute(q)
        routines = list(result.scalars().all())

        if action == "activate":
            for r in routines:
                r.is_active = True
        elif action == "deactivate":
            for r in routines:
                r.is_active = False
        elif action == "delete":
            for r in routines:
                await db.delete(r)

        await db.flush()
        return len(routines)

    # ── Schedule ──

    async def get_schedule(self, db, user_id, count: int = 20) -> list[dict]:
        """Compute the next N upcoming runs across all active routines for a user."""
        result = await db.execute(
            select(Routine).where(
                Routine.user_id == user_id,
                Routine.is_active == True,
            )
        )
        routines = list(result.scalars().all())

        upcoming = []
        now = datetime.now(ZoneInfo("UTC"))

        for routine in routines:
            try:
                tz = ZoneInfo(routine.timezone or "Europe/Berlin")
                local_now = now.astimezone(tz)
                cron = croniter(routine.cron_expression, local_now)

                # Collect next 3 fire times per routine so the merged list
                # has enough entries even if one routine dominates by schedule.
                for _ in range(3):
                    next_time = cron.get_next(datetime)
                    # Ensure the result is tz-aware UTC before serialising.
                    if next_time.tzinfo is None:
                        next_time = next_time.replace(tzinfo=tz)
                    upcoming.append({
                        "routine_id": str(routine.id),
                        "routine_name": routine.name,
                        "scheduled_at": next_time.astimezone(ZoneInfo("UTC")).isoformat(),
                        "cron_expression": routine.cron_expression,
                        "timezone": routine.timezone,
                    })
            except Exception:
                continue  # Skip routines with invalid cron expressions

        upcoming.sort(key=lambda x: x["scheduled_at"])
        return upcoming[:count]

    # ── Helpers ──

    def compute_next_run(self, cron_expression: str, tz_name: str,
                         after: datetime | None = None) -> datetime:
        """Compute the next run time using croniter with timezone support."""
        tz = ZoneInfo(tz_name)
        base = after or datetime.now(tz)
        cron = croniter(cron_expression, base)
        return cron.get_next(datetime)

    def cron_to_human(self, cron_expression: str) -> str:
        """Convert cron expression to human-readable text (basic)."""
        parts = cron_expression.split()
        if len(parts) != 5:
            return cron_expression

        minute, hour, dom, month, dow = parts

        if dom == "*" and month == "*":
            if dow == "*":
                return f"Every day at {hour}:{minute.zfill(2)}"
            elif dow == "MON-FRI":
                return f"Every weekday at {hour}:{minute.zfill(2)}"
            elif dow == "1-5":
                return f"Every weekday at {hour}:{minute.zfill(2)}"
            else:
                return f"Every {dow} at {hour}:{minute.zfill(2)}"

        return cron_expression


# Singleton
routine_service = RoutineService()
