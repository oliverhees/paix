"""Auth Endpoints — simplified for single-user mode (no login required)."""

from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_default_user
from models.database import get_db
from models.user import User

router = APIRouter()


def _mask_api_key(key: str | None) -> str | None:
    """Mask an API key for safe display: show first 4 + last 4 chars."""
    if not key:
        return None
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"


# ──────────────────────────────────────────────
# Response Schemas
# ──────────────────────────────────────────────


class UserMeResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None
    timezone: str
    persona_name: str | None = None
    persona_prompt: str | None = None
    persona_personality: str | None = None
    persona_about_user: str | None = None
    persona_communication: str | None = None
    brave_search_api_key: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    created_at: datetime | None = None


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("/auth/me", response_model=UserMeResponse)
async def get_me(user: User = Depends(get_default_user)):
    """Get the single PAIONE user."""
    return UserMeResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        timezone=user.timezone,
        persona_name=user.persona_name,
        persona_prompt=user.persona_prompt,
        persona_personality=user.persona_personality,
        persona_about_user=user.persona_about_user,
        persona_communication=user.persona_communication,
        brave_search_api_key=_mask_api_key(user.brave_search_api_key),
        telegram_bot_token=_mask_api_key(user.telegram_bot_token),
        telegram_chat_id=user.telegram_chat_id,
        created_at=user.created_at,
    )


class UpdateMeRequest(BaseModel):
    name: str | None = None
    avatar_url: str | None = None
    timezone: str | None = None
    persona_name: str | None = None
    persona_prompt: str | None = None
    persona_personality: str | None = None
    persona_about_user: str | None = None
    persona_communication: str | None = None
    brave_search_api_key: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None


@router.put("/auth/me", response_model=UserMeResponse)
async def update_me(
    request: UpdateMeRequest,
    user: User = Depends(get_default_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the PAIONE user's profile."""
    if request.name is not None:
        user.name = request.name
    if request.avatar_url is not None:
        user.avatar_url = request.avatar_url
    if request.timezone is not None:
        user.timezone = request.timezone
    if request.persona_name is not None:
        user.persona_name = request.persona_name
    if request.persona_prompt is not None:
        user.persona_prompt = request.persona_prompt
    if request.persona_personality is not None:
        user.persona_personality = request.persona_personality
    if request.persona_about_user is not None:
        user.persona_about_user = request.persona_about_user
    if request.persona_communication is not None:
        user.persona_communication = request.persona_communication
    if request.brave_search_api_key is not None:
        user.brave_search_api_key = request.brave_search_api_key or None
    if request.telegram_bot_token is not None and not request.telegram_bot_token.startswith("*") and "..." not in request.telegram_bot_token:
        user.telegram_bot_token = request.telegram_bot_token or None
    if request.telegram_chat_id is not None:
        user.telegram_chat_id = request.telegram_chat_id or None
    db.add(user)
    await db.flush()
    return UserMeResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        timezone=user.timezone,
        persona_name=user.persona_name,
        persona_prompt=user.persona_prompt,
        persona_personality=user.persona_personality,
        persona_about_user=user.persona_about_user,
        persona_communication=user.persona_communication,
        brave_search_api_key=_mask_api_key(user.brave_search_api_key),
        telegram_bot_token=_mask_api_key(user.telegram_bot_token),
        telegram_chat_id=user.telegram_chat_id,
        created_at=user.created_at,
    )
