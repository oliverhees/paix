"""Integrations Router — CRUD endpoints for user API keys (integration tokens)."""

import asyncio
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.integration import IntegrationToken
from models.user import User

router = APIRouter()

ALLOWED_PROVIDERS = {"anthropic", "openai", "google"}


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────


class ApiKeyInfo(BaseModel):
    """Public representation of a stored API key — never exposes the full token."""

    provider: str
    key_hint: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyListResponse(BaseModel):
    """Response wrapper for the list of stored API keys."""

    keys: list[ApiKeyInfo]


class ApiKeyUpsertRequest(BaseModel):
    """Request body for creating or updating an API key."""

    provider: Literal["anthropic", "openai", "google"]
    api_key: str

    @field_validator("api_key")
    @classmethod
    def api_key_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("api_key must not be empty")
        return v


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────


def _make_key_hint(access_token: str) -> str:
    """Return the last 4 characters of the token, prefixed with asterisks."""
    if len(access_token) <= 4:
        return access_token
    return f"****{access_token[-4:]}"


def _token_to_api_key_info(token: IntegrationToken) -> ApiKeyInfo:
    return ApiKeyInfo(
        provider=token.provider,
        key_hint=_make_key_hint(token.access_token),
        created_at=token.created_at,
        updated_at=token.updated_at,
    )


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get(
    "/settings/api-keys",
    response_model=ApiKeyListResponse,
    summary="List stored API keys",
)
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyListResponse:
    """Return all integration tokens for the authenticated user.

    The full API key is never returned — only the last 4 characters as a hint.
    """
    result = await db.execute(
        select(IntegrationToken).where(IntegrationToken.user_id == current_user.id)
    )
    tokens = result.scalars().all()
    return ApiKeyListResponse(keys=[_token_to_api_key_info(t) for t in tokens])


@router.put(
    "/settings/api-keys",
    response_model=ApiKeyInfo,
    summary="Create or update an API key",
)
async def upsert_api_key(
    body: ApiKeyUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyInfo:
    """Upsert an API key for the given provider.

    - If a token already exists for (user_id, provider) it is updated.
    - Otherwise a new token is created.
    - The full key is stored in plaintext (required for outgoing API calls).
    - Only the key_hint (last 4 chars) is returned.
    """
    result = await db.execute(
        select(IntegrationToken).where(
            IntegrationToken.user_id == current_user.id,
            IntegrationToken.provider == body.provider,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.access_token = body.api_key
        # Trigger onupdate for updated_at by flushing the dirty state
        await db.flush()
        # Refresh to get the server-side updated_at timestamp
        await db.refresh(existing)
        return _token_to_api_key_info(existing)

    new_token = IntegrationToken(
        user_id=current_user.id,
        provider=body.provider,
        access_token=body.api_key,
    )
    db.add(new_token)
    await db.flush()
    await db.refresh(new_token)
    return _token_to_api_key_info(new_token)


@router.delete(
    "/settings/api-keys/{provider}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an API key",
)
async def delete_api_key(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete the stored API key for the given provider.

    Returns 404 if no token exists for this user/provider combination.
    Returns 204 No Content on success.
    """
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown provider '{provider}'. Allowed: {sorted(ALLOWED_PROVIDERS)}",
        )

    result = await db.execute(
        delete(IntegrationToken)
        .where(
            IntegrationToken.user_id == current_user.id,
            IntegrationToken.provider == provider,
        )
        .returning(IntegrationToken.id)
    )
    deleted = result.fetchone()

    if deleted is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No API key found for provider '{provider}'",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────
# Validate API Key
# ──────────────────────────────────────────────


class ApiKeyValidateRequest(BaseModel):
    """Request body for validating an API key."""

    provider: Literal["anthropic", "openai", "google"]
    api_key: str = ""


class ApiKeyValidateResponse(BaseModel):
    """Response body for API key validation."""

    valid: bool
    error: str | None = None


@router.post(
    "/settings/api-keys/validate",
    response_model=ApiKeyValidateResponse,
    summary="Validate an API key",
)
async def validate_api_key(
    body: ApiKeyValidateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyValidateResponse:
    """Teste ob ein API-Key funktioniert, indem ein minimaler API-Call gemacht wird."""
    # If no key provided, use the stored key for this user
    api_key = body.api_key.strip() if body.api_key else ""
    if not api_key:
        from services.llm_service import get_user_api_key
        stored_key = await get_user_api_key(current_user.id, db, body.provider)
        if not stored_key:
            return ApiKeyValidateResponse(valid=False, error="Kein API-Key gespeichert")
        api_key = stored_key

    try:
        if body.provider == "anthropic":
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=api_key)
            try:
                await asyncio.wait_for(
                    client.messages.create(
                        model="claude-haiku-4-5-20251001",
                        max_tokens=10,
                        messages=[{"role": "user", "content": "Hi"}],
                    ),
                    timeout=5.0,
                )
            finally:
                await client.close()

        elif body.provider == "openai":
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key)
            try:
                await asyncio.wait_for(
                    client.chat.completions.create(
                        model="gpt-4o-mini",
                        max_tokens=10,
                        messages=[{"role": "user", "content": "Hi"}],
                    ),
                    timeout=5.0,
                )
            finally:
                await client.close()

        elif body.provider == "google":
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash-lite")
            await asyncio.wait_for(
                model.generate_content_async("Hi"),
                timeout=5.0,
            )

        return ApiKeyValidateResponse(valid=True)
    except asyncio.TimeoutError:
        return ApiKeyValidateResponse(
            valid=False, error="Zeitueberschreitung — der Anbieter hat nicht rechtzeitig geantwortet."
        )
    except Exception as e:
        return ApiKeyValidateResponse(valid=False, error=str(e)[:200])
