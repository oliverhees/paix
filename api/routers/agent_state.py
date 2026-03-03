"""Agent State Endpoints — persistent key-value store for agent memory per user."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.user import User
from services.agent_state_service import agent_state_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────

class AgentStateSetRequest(BaseModel):
    value: object
    scope: str = "global"


# ──────────────────────────────────────────────
# GET /agent-state
# ──────────────────────────────────────────────

@router.get("/agent-state")
async def list_agent_state(
    scope: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all agent state entries for the current user.

    Optional query param: ?scope=global or ?scope=session
    """
    entries = await agent_state_service.list_for_user(db, user.id, scope=scope)
    return {"entries": entries, "total": len(entries)}


# ──────────────────────────────────────────────
# GET /agent-state/{key}
# ──────────────────────────────────────────────

@router.get("/agent-state/{key}")
async def get_agent_state(
    key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single agent state entry by key."""
    value = await agent_state_service.get(db, user.id, key)
    if value is None:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    return {"key": key, "value": value}


# ──────────────────────────────────────────────
# PUT /agent-state/{key}
# ──────────────────────────────────────────────

@router.put("/agent-state/{key}")
async def set_agent_state(
    key: str,
    request: AgentStateSetRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or update an agent state entry (upsert)."""
    if len(key) > 255:
        raise HTTPException(status_code=400, detail="Schluessel zu lang (max. 255 Zeichen)")
    if request.scope not in ("global", "session"):
        raise HTTPException(status_code=400, detail="Scope muss 'global' oder 'session' sein")

    state = await agent_state_service.set(
        db, user.id, key, request.value, scope=request.scope
    )
    return {
        "key": state.key,
        "scope": state.scope,
        "updated_at": state.updated_at.isoformat() if state.updated_at else None,
    }


# ──────────────────────────────────────────────
# DELETE /agent-state/{key}
# ──────────────────────────────────────────────

@router.delete("/agent-state/{key}")
async def delete_agent_state(
    key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an agent state entry by key."""
    deleted = await agent_state_service.delete(db, user.id, key)
    if not deleted:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    return {"message": "Eintrag geloescht", "key": key}
