"""Push Notification Service — Web Push API via pywebpush."""

import logging
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.routine import PushSubscription, RoutineNotification

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Manages Web Push subscriptions and sending push notifications."""

    async def subscribe(self, db: AsyncSession, user_id, endpoint: str,
                       p256dh_key: str, auth_key: str,
                       user_agent: str | None = None) -> PushSubscription:
        """Register a new push subscription. If endpoint exists, update keys."""
        # Check existing
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.p256dh_key = p256dh_key
            existing.auth_key = auth_key
            existing.user_agent = user_agent
            existing.is_active = True
            await db.flush()
            return existing

        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh_key=p256dh_key,
            auth_key=auth_key,
            user_agent=user_agent,
        )
        db.add(sub)
        await db.flush()
        return sub

    async def unsubscribe(self, db: AsyncSession, user_id, endpoint: str) -> bool:
        """Deactivate a push subscription."""
        result = await db.execute(
            update(PushSubscription)
            .where(PushSubscription.user_id == user_id,
                   PushSubscription.endpoint == endpoint)
            .values(is_active=False)
        )
        return result.rowcount > 0

    async def get_subscription_status(self, db: AsyncSession, user_id) -> dict:
        """Get push subscription status for a user."""
        result = await db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.is_active == True
            )
        )
        subs = list(result.scalars().all())
        return {
            "subscribed": len(subs) > 0,
            "subscription_count": len(subs),
            "vapid_public_key": settings.vapid_public_key,
        }

    async def send_push_to_user(self, db: AsyncSession, user_id,
                                notification: RoutineNotification) -> int:
        """Send push notification to all active subscriptions for a user.
        Returns count of successfully sent notifications."""
        if not settings.vapid_private_key:
            logger.warning("VAPID private key not configured, skipping push")
            return 0

        result = await db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.is_active == True
            )
        )
        subscriptions = list(result.scalars().all())
        if not subscriptions:
            return 0

        import json
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            logger.error("pywebpush not installed, skipping push notifications")
            return 0

        payload = json.dumps({
            "title": notification.title,
            "body": notification.summary[:200],
            "icon": "/icon-192x192.png",
            "badge": "/badge-72x72.png",
            "url": "/routines",
            "notification_id": str(notification.id),
            "run_id": str(notification.run_id),
            "type": notification.notification_type,
        })

        vapid_claims = {
            "sub": f"mailto:{settings.vapid_claims_email}",
        }

        sent_count = 0
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh_key,
                            "auth": sub.auth_key,
                        },
                    },
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims=vapid_claims,
                )
                sent_count += 1
            except WebPushException as e:
                logger.warning("Push failed for subscription %s: %s", sub.id, e)
                if hasattr(e, 'response') and e.response and e.response.status_code in (404, 410):
                    # Subscription expired or invalid — deactivate
                    sub.is_active = False
            except Exception as e:
                logger.error("Unexpected push error for %s: %s", sub.id, e)

        if sent_count > 0:
            await db.execute(
                update(RoutineNotification)
                .where(RoutineNotification.id == notification.id)
                .values(pwa_push_sent=True)
            )

        await db.flush()
        logger.info("Sent %d/%d push notifications for user %s",
                    sent_count, len(subscriptions), user_id)
        return sent_count


# Singleton
push_notification_service = PushNotificationService()
