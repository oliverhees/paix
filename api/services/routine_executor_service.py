"""Routine Executor Service — core execution engine for scheduled routines.

Runs routine prompts through the LLM with tool use support,
manages the full execution pipeline from condition checks to
artifact collection and notification delivery.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import extract, func, select
from sqlalchemy.orm import selectinload

from models.database import async_session
from models.routine import Routine, RoutineRun, RoutineRunArtifact
from models.user import User
from services.chat_service import chat_service
from services.llm_service import llm_service, get_user_api_key
from services.llm_providers.factory import resolve_provider
from services.routine_service import routine_service
from services.skill_service import skill_service

logger = logging.getLogger(__name__)

# ── Artifact Tool Definition (same as chat.py) ──

ARTIFACT_TOOL = {
    "name": "create_artifact",
    "description": (
        "Create a visual artifact that will be displayed in a side panel. "
        "Use this for: code files, documents, HTML pages, Mermaid diagrams, SVG graphics, "
        "or any substantial content that benefits from its own viewing space. "
        "Do NOT use for short inline code snippets or brief text answers."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Short title for the artifact",
            },
            "artifact_type": {
                "type": "string",
                "enum": ["code", "markdown", "html", "mermaid", "svg"],
                "description": (
                    "Type of artifact: 'code' for source code, 'markdown' for documents, "
                    "'html' for interactive pages, 'mermaid' for diagrams, 'svg' for graphics"
                ),
            },
            "language": {
                "type": "string",
                "description": "Programming language for code artifacts (e.g. 'python', 'typescript').",
            },
            "content": {
                "type": "string",
                "description": "The full content of the artifact.",
            },
        },
        "required": ["title", "artifact_type", "content"],
    },
}


class RoutineExecutorService:
    """Core execution engine for running routine prompts through the LLM."""

    # ── Cost Estimation ──

    @staticmethod
    def _estimate_cost_cents(input_tokens: int, output_tokens: int, model: str) -> int:
        """Estimate cost in cents based on model pricing.

        Rates are per million tokens (USD).
        """
        rates = {
            "claude-sonnet-4-6": (3.0, 15.0),
            "claude-haiku-4-5-20251001": (0.25, 1.25),
        }
        input_rate, output_rate = rates.get(model, (3.0, 15.0))
        cost = (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000
        return max(1, int(cost * 100))  # Convert to cents, minimum 1 cent

    # ── Variable Resolution ──

    @staticmethod
    def _resolve_variables(prompt: str, tz_name: str) -> str:
        """Replace template variables in prompt with timezone-aware values."""
        tz = ZoneInfo(tz_name)
        now = datetime.now(tz)
        day_names_de = [
            "Montag", "Dienstag", "Mittwoch", "Donnerstag",
            "Freitag", "Samstag", "Sonntag",
        ]
        replacements = {
            "{{date}}": now.strftime("%Y-%m-%d"),
            "{{time}}": now.strftime("%H:%M"),
            "{{datetime}}": now.strftime("%Y-%m-%d %H:%M"),
            "{{day_of_week}}": now.strftime("%A"),
            "{{day_of_week_de}}": day_names_de[now.weekday()],
            "{{month}}": now.strftime("%B"),
            "{{year}}": str(now.year),
        }
        for key, value in replacements.items():
            prompt = prompt.replace(key, value)
        return prompt

    # ── Monthly Budget Check ──

    async def _check_monthly_budget(
        self, db, routine: Routine
    ) -> tuple[bool, int]:
        """Check if the routine has exceeded its monthly budget.

        Returns (within_budget, spent_this_month_cents).
        """
        if routine.monthly_budget_cents is None:
            return True, 0

        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(func.coalesce(func.sum(RoutineRun.estimated_cost_cents), 0))
            .where(
                RoutineRun.routine_id == routine.id,
                extract("year", RoutineRun.created_at) == now.year,
                extract("month", RoutineRun.created_at) == now.month,
            )
        )
        spent = result.scalar() or 0
        return spent < routine.monthly_budget_cents, spent

    # ── Condition Evaluation ──

    async def _evaluate_condition(
        self, condition_prompt: str, api_key: str | None, model: str
    ) -> tuple[bool, str]:
        """Evaluate a condition prompt via LLM.

        Returns (should_execute, reason_text).
        """
        system = (
            "Du beantwortest Fragen mit 'ja' oder 'nein'. "
            "Antworte zuerst mit einem klaren 'Ja' oder 'Nein', "
            "dann optional eine kurze Begruendung."
        )
        response = await llm_service.complete(
            messages=[{"role": "user", "content": condition_prompt}],
            system_prompt=system,
            model=model,
            max_tokens=256,
            temperature=0.3,
            api_key=api_key,
        )
        response_lower = response.strip().lower()
        should_run = response_lower.startswith("ja")
        return should_run, response.strip()

    # ── Main Execution Pipeline ──

    async def execute_routine(
        self,
        routine_id: str,
        trigger_type: str = "scheduled",
        input_context: dict | None = None,
        skip_condition: bool = False,
        chain_depth: int = 0,
    ) -> str | None:
        """Execute a routine through the full pipeline.

        Returns the run_id (str) or None if skipped.
        """
        async with async_session() as db:
            # Step 1: Load routine from DB
            result = await db.execute(
                select(Routine)
                .options(selectinload(Routine.skills))
                .where(Routine.id == routine_id)
            )
            routine = result.scalar_one_or_none()
            if not routine:
                logger.error("Routine %s not found", routine_id)
                return None

            # Step 2: Check if routine is active
            if not routine.is_active:
                logger.info("Routine %s is inactive, skipping", routine_id)
                return None

            user_id = routine.user_id

            # Step 3: Check monthly budget
            within_budget, spent = await self._check_monthly_budget(db, routine)
            if not within_budget:
                logger.warning(
                    "Routine %s over monthly budget (%d/%d cents)",
                    routine_id, spent, routine.monthly_budget_cents,
                )
                return None

            # Get user API key early (needed for condition check too)
            provider_name = resolve_provider(routine.model)
            user_api_key = await get_user_api_key(user_id, db, provider_name)

            # Step 7 (early): Resolve prompt variables
            resolved_prompt = self._resolve_variables(
                routine.prompt, routine.timezone
            )

            # Merge input_context into prompt if provided
            if input_context:
                context_lines = [f"{k}: {v}" for k, v in input_context.items()]
                resolved_prompt = (
                    resolved_prompt + "\n\nKontext:\n" + "\n".join(context_lines)
                )

            run = None
            try:
                # Step 4: Create RoutineRun record
                run = await routine_service.create_run(
                    db,
                    routine_id=routine.id,
                    user_id=user_id,
                    resolved_prompt=resolved_prompt,
                    trigger_type=trigger_type,
                    input_context=input_context,
                )
                await db.commit()

                start_time = time.monotonic()

                # Step 5: Evaluate condition prompt
                if routine.condition_prompt and not skip_condition:
                    should_run, reason = await self._evaluate_condition(
                        routine.condition_prompt, user_api_key, routine.model
                    )
                    if not should_run:
                        logger.info(
                            "Routine %s condition not met: %s",
                            routine_id, reason,
                        )
                        await routine_service.update_run_status(
                            db, run.id, "skipped",
                            condition_result="no",
                            condition_reason=reason,
                            completed_at=datetime.now(timezone.utc),
                        )
                        await routine_service.update_routine_stats(
                            db, routine.id, "skipped"
                        )
                        next_run = routine_service.compute_next_run(
                            routine.cron_expression, routine.timezone
                        )
                        from sqlalchemy import update as sa_update
                        await db.execute(
                            sa_update(Routine)
                            .where(Routine.id == routine.id)
                            .values(next_run_at=next_run)
                        )
                        await db.commit()
                        return str(run.id)

                    # Condition passed
                    await routine_service.update_run_status(
                        db, run.id, "running",
                        condition_result="yes",
                        condition_reason=reason,
                        started_at=datetime.now(timezone.utc),
                    )
                    await db.commit()
                else:
                    # No condition — mark as running
                    await routine_service.update_run_status(
                        db, run.id, "running",
                        started_at=datetime.now(timezone.utc),
                    )
                    await db.commit()

                # Step 6: Create hidden chat session
                chat_session = await chat_service.create_session(
                    db, user_id, title=f"[Routine] {routine.name}"
                )
                await routine_service.update_run_status(
                    db, run.id, "running",
                    chat_session_id=chat_session.id,
                )
                await db.commit()

                # Step 8: Load skills as Anthropic tools
                tools = await skill_service.get_tools_for_user(db, user_id)
                routine_skill_ids = {s.skill_id for s in routine.skills}
                if routine_skill_ids:
                    tools = [
                        t for t in tools
                        if t["name"] in routine_skill_ids
                    ]
                # Always include artifact tool
                tools.append(ARTIFACT_TOOL)

                # Step 9: Build system prompt (with user persona)
                if routine.system_prompt_override:
                    system_prompt = routine.system_prompt_override
                else:
                    # Load user for persona customization
                    user_result = await db.execute(
                        select(User).where(User.id == user_id)
                    )
                    user_obj = user_result.scalar_one()
                    persona_name = user_obj.persona_name or "PAI-X"

                    if user_obj.persona_prompt:
                        system_prompt = (
                            user_obj.persona_prompt + "\n\n"
                            "Du fuehrst gerade eine geplante Routine aus. "
                            "Gib eine hilfreiche, strukturierte Antwort."
                        )
                    else:
                        system_prompt = (
                            f"Du bist {persona_name}, ein autonomer AI-Assistent der eine geplante "
                            "Routine ausfuehrt. Gib eine hilfreiche, strukturierte Antwort."
                        )

                # Step 10: Execute LLM with tool handling
                artifacts_collected: list[dict] = []

                async def _tool_executor(tool_name: str, tool_input: dict) -> str:
                    if tool_name == "create_artifact":
                        artifacts_collected.append({
                            "title": tool_input.get("title", "Artifact"),
                            "artifact_type": tool_input.get("artifact_type", "code"),
                            "language": tool_input.get("language"),
                            "content": tool_input.get("content", ""),
                        })
                        return "Artifact created successfully."
                    return await skill_service.execute_tool_call(
                        db=db,
                        user_id=user_id,
                        tool_name=tool_name,
                        tool_input=tool_input,
                    )

                has_tools = bool(routine_skill_ids) or True  # artifact tool always present

                # Enforce timeout
                try:
                    llm_result = await asyncio.wait_for(
                        llm_service.complete_with_tool_handling(
                            messages=[{"role": "user", "content": resolved_prompt}],
                            system_prompt=system_prompt,
                            model=routine.model,
                            max_tokens=routine.max_tokens,
                            temperature=routine.temperature,
                            api_key=user_api_key,
                            tools=tools if has_tools else None,
                            tool_executor=_tool_executor if has_tools else None,
                        ),
                        timeout=routine.timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    raise TimeoutError(
                        f"Routine execution timed out after {routine.timeout_seconds}s"
                    )

                result_text = llm_result.text
                end_time = time.monotonic()
                duration_ms = int((end_time - start_time) * 1000)

                # Token estimation (complete_with_tool_handling does not return token info)
                input_tokens = len(resolved_prompt) // 4
                output_tokens = len(result_text) // 4
                total_tokens = input_tokens + output_tokens
                cost_cents = self._estimate_cost_cents(
                    input_tokens, output_tokens, routine.model
                )

                # Step 11: Extract artifacts
                for art_data in artifacts_collected:
                    artifact = RoutineRunArtifact(
                        run_id=run.id,
                        title=art_data["title"],
                        artifact_type=art_data["artifact_type"],
                        language=art_data.get("language"),
                        content=art_data["content"],
                    )
                    db.add(artifact)

                # Step 12: Save results
                tool_rounds = 0
                if llm_result.tool_calls:
                    tool_rounds = max(tc["round"] for tc in llm_result.tool_calls)

                await routine_service.update_run_status(
                    db, run.id, "completed",
                    result_text=result_text,
                    result_summary=result_text[:500],
                    completed_at=datetime.now(timezone.utc),
                    duration_ms=duration_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    estimated_cost_cents=cost_cents,
                    tool_calls_count=len(llm_result.tool_calls),
                    tool_rounds=tool_rounds,
                )

                # Step 13: Save messages to chat session
                await chat_service.add_message(
                    db, chat_session.id, "user", resolved_prompt
                )
                await chat_service.add_message(
                    db, chat_session.id, "assistant", result_text,
                    skill_used=llm_result.skill_used,
                )

                # Step 14: Create notification
                notification = await routine_service.create_notification(
                    db, run.id, user_id,
                    title=f"Routine: {routine.name}",
                    summary=result_text[:200],
                )

                # Step 14b: Send push notification (fire-and-forget)
                import asyncio as _asyncio

                async def _send_push():
                    try:
                        from services.push_notification_service import push_notification_service
                        async with async_session() as push_db:
                            await push_notification_service.send_push_to_user(
                                push_db, user_id, notification
                            )
                            await push_db.commit()
                    except Exception as push_err:
                        logger.warning("Push notification failed: %s", push_err)

                _asyncio.create_task(_send_push())

                # Step 14c: Dispatch webhooks (fire-and-forget)
                async def _dispatch_webhooks():
                    try:
                        from services.webhook_dispatch_service import webhook_dispatch_service
                        async with async_session() as wh_db:
                            await webhook_dispatch_service.dispatch_webhooks(
                                wh_db, routine.id, run, notification
                            )
                            await wh_db.commit()
                    except Exception as wh_err:
                        logger.warning("Webhook dispatch failed: %s", wh_err)

                _asyncio.create_task(_dispatch_webhooks())

                # Step 15: Update routine stats and compute next run
                await routine_service.update_routine_stats(
                    db, routine.id, "completed", cost_cents=cost_cents
                )
                next_run = routine_service.compute_next_run(
                    routine.cron_expression, routine.timezone
                )
                from sqlalchemy import update as sa_update
                await db.execute(
                    sa_update(Routine)
                    .where(Routine.id == routine.id)
                    .values(next_run_at=next_run)
                )

                await db.commit()

                # Step 16: Trigger chained routines (fire-and-forget)
                if chain_depth < 10:
                    await self._trigger_chains(
                        str(routine.id), run.status, result_text,
                        chain_depth=chain_depth,
                    )
                else:
                    logger.warning(
                        "Chain depth limit reached (%d) for routine %s",
                        chain_depth, routine_id,
                    )

                logger.info(
                    "Routine %s completed in %dms (tokens: %d, cost: %d cents)",
                    routine_id, duration_ms, total_tokens, cost_cents,
                )
                return str(run.id)

            except Exception as exc:
                logger.error(
                    "Routine %s execution failed: %s", routine_id, exc,
                    exc_info=True,
                )

                if run:
                    try:
                        error_type = type(exc).__name__
                        await routine_service.update_run_status(
                            db, run.id, "failed",
                            error_message=str(exc),
                            error_type=error_type,
                            completed_at=datetime.now(timezone.utc),
                        )
                        await routine_service.update_routine_stats(
                            db, routine.id, "failed"
                        )

                        # Compute next run even on failure
                        next_run = routine_service.compute_next_run(
                            routine.cron_expression, routine.timezone
                        )
                        from sqlalchemy import update as sa_update
                        await db.execute(
                            sa_update(Routine)
                            .where(Routine.id == routine.id)
                            .values(next_run_at=next_run)
                        )

                        await db.commit()

                        # Trigger failure chains
                        if chain_depth < 10:
                            await self._trigger_chains(
                                str(routine.id), "failed",
                                str(exc),
                                chain_depth=chain_depth,
                            )

                        # Retry logic
                        if routine.retry_on_failure:
                            # Load current retry count from the run
                            run_result = await db.execute(
                                select(RoutineRun.retry_count)
                                .where(RoutineRun.id == run.id)
                            )
                            retry_count = run_result.scalar() or 0

                            if retry_count < routine.max_retries:
                                logger.info(
                                    "Scheduling retry %d/%d for routine %s in %ds",
                                    retry_count + 1,
                                    routine.max_retries,
                                    routine_id,
                                    routine.retry_delay_seconds,
                                )
                                asyncio.get_event_loop().call_later(
                                    routine.retry_delay_seconds,
                                    lambda: asyncio.ensure_future(
                                        self._retry_execution(
                                            str(routine.id),
                                            str(run.id),
                                            retry_count + 1,
                                            trigger_type,
                                        )
                                    ),
                                )
                    except Exception as inner_exc:
                        logger.error(
                            "Failed to update run status on error: %s",
                            inner_exc,
                            exc_info=True,
                        )
                        try:
                            await db.rollback()
                        except Exception:
                            pass

                return str(run.id) if run else None

    async def _retry_execution(
        self,
        routine_id: str,
        parent_run_id: str,
        retry_count: int,
        trigger_type: str,
    ) -> None:
        """Internal: schedule a retry of a failed routine execution."""
        logger.info(
            "Retrying routine %s (attempt %d, parent_run=%s)",
            routine_id, retry_count, parent_run_id,
        )
        async with async_session() as db:
            # Load routine
            result = await db.execute(
                select(Routine)
                .options(selectinload(Routine.skills))
                .where(Routine.id == routine_id)
            )
            routine = result.scalar_one_or_none()
            if not routine or not routine.is_active:
                return

            user_id = routine.user_id
            resolved_prompt = self._resolve_variables(
                routine.prompt, routine.timezone
            )

            # Create a new run as retry
            run = await routine_service.create_run(
                db,
                routine_id=routine.id,
                user_id=user_id,
                resolved_prompt=resolved_prompt,
                trigger_type=trigger_type,
                parent_run_id=uuid.UUID(parent_run_id),
            )
            # Update retry count on the new run
            from sqlalchemy import update as sa_update
            await db.execute(
                sa_update(RoutineRun)
                .where(RoutineRun.id == run.id)
                .values(retry_count=retry_count)
            )
            await db.commit()

        # Execute through the standard pipeline (skip_condition on retries)
        await self.execute_routine(
            routine_id,
            trigger_type=trigger_type,
            skip_condition=True,
            chain_depth=0,
        )

    # ── Chain Execution ──

    async def _trigger_chains(
        self,
        source_routine_id: str,
        run_status: str,
        result_text: str | None,
        chain_depth: int = 0,
    ) -> None:
        """Fire-and-forget: trigger chained routines based on run outcome."""
        import asyncio as _asyncio

        async def _execute_chains():
            try:
                async with async_session() as db:
                    from sqlalchemy import select as sa_select
                    from models.routine import RoutineChain

                    # Find matching chains
                    result = await db.execute(
                        sa_select(RoutineChain)
                        .where(
                            RoutineChain.source_routine_id == source_routine_id,
                            RoutineChain.is_active == True,
                            RoutineChain.trigger_on.in_([run_status, "always"]),
                        )
                        .order_by(RoutineChain.execution_order)
                    )
                    chains = list(result.scalars().all())

                    if not chains:
                        return

                    logger.info(
                        "[ChainExecution] Found %d chains for routine %s (status=%s, depth=%d)",
                        len(chains), source_routine_id, run_status, chain_depth,
                    )

                    for chain in chains:
                        try:
                            # Build input context if pass_result is True
                            input_context = None
                            if chain.pass_result and result_text:
                                input_context = {
                                    "source_routine_id": source_routine_id,
                                    "source_status": run_status,
                                    "source_result": result_text[:2000],
                                }
                                # Apply context_mapping if defined
                                if chain.context_mapping:
                                    for key, source_key in chain.context_mapping.items():
                                        if source_key in input_context:
                                            input_context[key] = input_context[source_key]

                            logger.info(
                                "[ChainExecution] Triggering chain %s -> %s (trigger_on=%s, depth=%d)",
                                source_routine_id, chain.target_routine_id,
                                chain.trigger_on, chain_depth + 1,
                            )

                            await self.execute_routine(
                                str(chain.target_routine_id),
                                trigger_type="chain",
                                input_context=input_context,
                                chain_depth=chain_depth + 1,
                            )
                        except Exception as chain_err:
                            logger.error(
                                "[ChainExecution] Failed to execute chain target %s: %s",
                                chain.target_routine_id, chain_err,
                            )

            except Exception as outer_err:
                logger.error(
                    "[ChainExecution] Chain execution failed for routine %s: %s",
                    source_routine_id, outer_err,
                )

        _asyncio.create_task(_execute_chains())

    # ── Manual Trigger ──

    async def execute_manual(
        self,
        routine_id: uuid.UUID,
        user_id: uuid.UUID,
        context: dict | None = None,
        skip_condition: bool = False,
    ) -> dict:
        """Manually trigger a routine execution.

        Returns a dict with id and status of the run.
        """
        run_id = await self.execute_routine(
            str(routine_id),
            trigger_type="manual",
            input_context=context,
            skip_condition=skip_condition,
        )

        if run_id is None:
            return {"id": None, "status": "skipped"}

        # Fetch the final run status
        async with async_session() as db:
            run = await routine_service.get_run(db, uuid.UUID(run_id), user_id)
            if run:
                return {
                    "id": str(run.id),
                    "status": run.status,
                    "result_summary": run.result_summary,
                    "duration_ms": run.duration_ms,
                    "estimated_cost_cents": run.estimated_cost_cents,
                    "chat_session_id": str(run.chat_session_id) if run.chat_session_id else None,
                }

        return {"id": run_id, "status": "unknown"}

    # ── Cancel Run ──

    async def cancel_run(
        self, run_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Cancel a pending or running execution.

        Returns True if the run was found and cancelled.
        """
        async with async_session() as db:
            run = await routine_service.get_run(db, run_id, user_id)
            if not run:
                return False
            if run.status not in ("pending", "running"):
                return False

            await routine_service.update_run_status(
                db, run.id, "cancelled",
                completed_at=datetime.now(timezone.utc),
                error_message="Cancelled by user",
            )
            await db.commit()
            logger.info("Run %s cancelled by user %s", run_id, user_id)
            return True

    # ── Retry Run ──

    async def retry_run(
        self, run_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict:
        """Retry a failed run by creating a new run with parent_run_id.

        Returns a dict with the new run's id and status.
        """
        async with async_session() as db:
            original_run = await routine_service.get_run(db, run_id, user_id)
            if not original_run:
                return {"id": None, "status": "not_found"}
            if original_run.status != "failed":
                return {"id": None, "status": "not_failed"}

            routine_id = original_run.routine_id

        # Execute through the standard pipeline
        new_run_id = await self.execute_routine(
            str(routine_id),
            trigger_type="manual_retry",
            skip_condition=True,
        )

        if new_run_id is None:
            return {"id": None, "status": "skipped"}

        # Link the parent run
        async with async_session() as db:
            from sqlalchemy import update as sa_update
            await db.execute(
                sa_update(RoutineRun)
                .where(RoutineRun.id == uuid.UUID(new_run_id))
                .values(parent_run_id=run_id)
            )
            await db.commit()

            new_run = await routine_service.get_run(
                db, uuid.UUID(new_run_id), user_id
            )
            if new_run:
                return {
                    "id": str(new_run.id),
                    "status": new_run.status,
                    "parent_run_id": str(run_id),
                }

        return {"id": new_run_id, "status": "unknown"}


# Singleton
routine_executor = RoutineExecutorService()
