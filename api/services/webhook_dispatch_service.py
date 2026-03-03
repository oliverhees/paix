"""Webhook Dispatch Service — fires configured webhooks after routine runs."""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.routine import RoutineNotification, RoutineRun, RoutineWebhook

logger = logging.getLogger(__name__)


class WebhookDispatchService:
    """Dispatches webhook calls for routine run results."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def dispatch_webhooks(self, db: AsyncSession, routine_id,
                                run: RoutineRun,
                                notification: RoutineNotification) -> int:
        """Dispatch all matching webhooks for a routine run.
        Returns count of successfully dispatched webhooks."""
        result = await db.execute(
            select(RoutineWebhook).where(
                RoutineWebhook.routine_id == routine_id,
                RoutineWebhook.is_active == True,
                RoutineWebhook.trigger_on.in_([run.status, "always"]),
            )
        )
        webhooks = list(result.scalars().all())
        if not webhooks:
            return 0

        dispatched = 0
        for webhook in webhooks:
            try:
                response_code = await self._send_webhook(webhook, run, notification)
                if response_code and 200 <= response_code < 300:
                    dispatched += 1
                    # Update notification with webhook result
                    await db.execute(
                        update(RoutineNotification)
                        .where(RoutineNotification.id == notification.id)
                        .values(
                            webhook_sent=True,
                            webhook_response_code=response_code,
                        )
                    )
            except Exception as e:
                logger.error("Webhook dispatch failed for %s: %s", webhook.id, e)

        await db.flush()
        logger.info("Dispatched %d/%d webhooks for routine %s",
                    dispatched, len(webhooks), routine_id)
        return dispatched

    async def _send_webhook(self, webhook: RoutineWebhook,
                           run: RoutineRun,
                           notification: RoutineNotification) -> int | None:
        """Send a single webhook. Returns HTTP status code or None on error."""
        # Build payload
        if webhook.payload_template:
            # Simple template substitution
            payload_str = webhook.payload_template
            payload_str = payload_str.replace("{{run_id}}", str(run.id))
            payload_str = payload_str.replace("{{routine_id}}", str(run.routine_id))
            payload_str = payload_str.replace("{{status}}", run.status)
            payload_str = payload_str.replace("{{summary}}", notification.summary or "")
            payload_str = payload_str.replace("{{title}}", notification.title or "")
            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                payload = {"raw": payload_str}
        else:
            payload = {
                "event": "routine.run.completed",
                "run_id": str(run.id),
                "routine_id": str(run.routine_id),
                "status": run.status,
                "trigger_type": run.trigger_type,
                "title": notification.title,
                "summary": notification.summary,
                "duration_ms": run.duration_ms,
                "total_tokens": run.total_tokens,
                "estimated_cost_cents": run.estimated_cost_cents,
                "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        # Build headers
        headers = {"Content-Type": "application/json"}
        if webhook.headers:
            headers.update(webhook.headers)

        # HMAC signature
        body_bytes = json.dumps(payload).encode("utf-8")
        if webhook.secret:
            signature = hmac.new(
                webhook.secret.encode("utf-8"),
                body_bytes,
                hashlib.sha256,
            ).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={signature}"

        # Send
        method = webhook.method.upper()
        try:
            if method == "POST":
                response = await self.client.post(webhook.url, json=payload, headers=headers)
            elif method == "GET":
                response = await self.client.get(webhook.url, headers=headers)
            elif method == "PUT":
                response = await self.client.put(webhook.url, json=payload, headers=headers)
            else:
                logger.warning("Unsupported webhook method: %s", method)
                return None

            logger.info("Webhook %s returned %d", webhook.url[:80], response.status_code)
            return response.status_code
        except httpx.TimeoutException:
            logger.warning("Webhook timeout: %s", webhook.url[:80])
            return None
        except httpx.RequestError as e:
            logger.warning("Webhook request error: %s — %s", webhook.url[:80], e)
            return None


# Singleton
webhook_dispatch_service = WebhookDispatchService()
