"""Agent State Service — CRUD operations for persistent agent memory."""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_state import AgentState

logger = logging.getLogger(__name__)


class AgentStateService:
    """Manages persistent agent state per user."""

    async def get(
        self, db: AsyncSession, user_id: uuid.UUID, key: str
    ) -> Any | None:
        """Get a single state value by key. Returns parsed JSON value or None."""
        result = await db.execute(
            select(AgentState).where(
                AgentState.user_id == user_id,
                AgentState.key == key,
            )
        )
        state = result.scalar_one_or_none()
        if state is None:
            return None
        try:
            return json.loads(state.value)
        except json.JSONDecodeError:
            return state.value

    async def set(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        key: str,
        value: Any,
        scope: str = "global",
    ) -> AgentState:
        """Set a state value (upsert). Value is JSON-serialized."""
        result = await db.execute(
            select(AgentState).where(
                AgentState.user_id == user_id,
                AgentState.key == key,
            )
        )
        existing = result.scalar_one_or_none()
        json_value = json.dumps(value, ensure_ascii=False, default=str)

        if existing:
            existing.value = json_value
            existing.scope = scope
            existing.updated_at = datetime.now(timezone.utc)
            await db.flush()
            return existing
        else:
            state = AgentState(
                user_id=user_id,
                key=key,
                value=json_value,
                scope=scope,
            )
            db.add(state)
            await db.flush()
            return state

    async def delete(
        self, db: AsyncSession, user_id: uuid.UUID, key: str
    ) -> bool:
        """Delete a state entry. Returns True if it existed."""
        result = await db.execute(
            delete(AgentState).where(
                AgentState.user_id == user_id,
                AgentState.key == key,
            )
        )
        await db.flush()
        return result.rowcount > 0

    async def list_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        scope: str | None = None,
    ) -> list[dict]:
        """List all state entries for a user, optionally filtered by scope."""
        query = select(AgentState).where(AgentState.user_id == user_id)
        if scope:
            query = query.where(AgentState.scope == scope)
        query = query.order_by(AgentState.updated_at.desc())

        result = await db.execute(query)
        states = result.scalars().all()

        entries = []
        for s in states:
            try:
                parsed_value = json.loads(s.value)
            except json.JSONDecodeError:
                parsed_value = s.value
            entries.append(
                {
                    "key": s.key,
                    "value": parsed_value,
                    "scope": s.scope,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                }
            )
        return entries

    async def cleanup_session_states(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> int:
        """Delete all session-scoped states for a user. Returns count deleted."""
        result = await db.execute(
            delete(AgentState).where(
                AgentState.user_id == user_id,
                AgentState.scope == "session",
            )
        )
        await db.flush()
        return result.rowcount


# Singleton
agent_state_service = AgentStateService()
