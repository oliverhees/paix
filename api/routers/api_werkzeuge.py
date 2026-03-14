"""API Werkzeuge Endpoints — REST API tool registration and management."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.api_werkzeug import ApiWerkzeug
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────


class EndpointDef(BaseModel):
    name: str
    description: str = ""
    method: str = "GET"
    path: str = "/"
    parameters: dict = {}


class ApiWerkzeugRequest(BaseModel):
    name: str
    description: str = ""
    base_url: str
    auth: dict = {}
    headers: dict = {}
    endpoints: list[EndpointDef] = []

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        if len(v) > 100:
            raise ValueError("name must not exceed 100 characters")
        return v

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        v = v.strip().rstrip("/")
        if not v.startswith("http://") and not v.startswith("https://"):
            raise ValueError("base_url must start with http:// or https://")
        return v


class ApiWerkzeugUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    base_url: str | None = None
    auth: dict | None = None
    headers: dict | None = None
    endpoints: list[EndpointDef] | None = None
    active: bool | None = None


def _werkzeug_to_dict(w: ApiWerkzeug) -> dict:
    """Serialize an ApiWerkzeug ORM object to a response dict."""
    return {
        "id": str(w.id),
        "name": w.name,
        "description": w.description,
        "base_url": w.base_url,
        "auth": w.auth,
        "headers": w.headers,
        "endpoints": w.endpoints,
        "active": w.active,
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "updated_at": w.updated_at.isoformat() if w.updated_at else None,
    }


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("/api-werkzeuge")
async def list_api_werkzeuge(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered API werkzeuge for the authenticated user."""
    result = await db.execute(
        select(ApiWerkzeug)
        .where(ApiWerkzeug.user_id == user.id)
        .order_by(ApiWerkzeug.created_at.asc())
    )
    werkzeuge = list(result.scalars().all())
    return {"api_werkzeuge": [_werkzeug_to_dict(w) for w in werkzeuge]}


@router.post("/api-werkzeuge", status_code=status.HTTP_201_CREATED)
async def create_api_werkzeug(
    request: ApiWerkzeugRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new REST API as a tool source."""
    werkzeug = ApiWerkzeug(
        user_id=user.id,
        name=request.name,
        description=request.description,
        base_url=request.base_url,
        auth=request.auth,
        headers=request.headers,
        endpoints=[ep.model_dump() for ep in request.endpoints],
        active=True,
    )
    db.add(werkzeug)
    await db.flush()

    return {"api_werkzeug": _werkzeug_to_dict(werkzeug)}


@router.put("/api-werkzeuge/{werkzeug_id}")
async def update_api_werkzeug(
    werkzeug_id: uuid.UUID,
    request: ApiWerkzeugUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing API werkzeug."""
    result = await db.execute(
        select(ApiWerkzeug).where(
            ApiWerkzeug.id == werkzeug_id,
            ApiWerkzeug.user_id == user.id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Werkzeug '{werkzeug_id}' not found",
        )

    update_vals: dict = {}
    if request.name is not None:
        update_vals["name"] = request.name.strip()
    if request.description is not None:
        update_vals["description"] = request.description
    if request.base_url is not None:
        update_vals["base_url"] = request.base_url.strip().rstrip("/")
    if request.auth is not None:
        update_vals["auth"] = request.auth
    if request.headers is not None:
        update_vals["headers"] = request.headers
    if request.endpoints is not None:
        update_vals["endpoints"] = [ep.model_dump() for ep in request.endpoints]
    if request.active is not None:
        update_vals["active"] = request.active

    if update_vals:
        await db.execute(
            update(ApiWerkzeug)
            .where(ApiWerkzeug.id == werkzeug_id)
            .values(**update_vals)
        )
        await db.flush()

    result = await db.execute(
        select(ApiWerkzeug).where(ApiWerkzeug.id == werkzeug_id)
    )
    updated = result.scalar_one()
    return {"api_werkzeug": _werkzeug_to_dict(updated)}


@router.delete(
    "/api-werkzeuge/{werkzeug_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_api_werkzeug(
    werkzeug_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a registered API werkzeug."""
    result = await db.execute(
        select(ApiWerkzeug).where(
            ApiWerkzeug.id == werkzeug_id,
            ApiWerkzeug.user_id == user.id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Werkzeug '{werkzeug_id}' not found",
        )

    await db.execute(
        delete(ApiWerkzeug).where(ApiWerkzeug.id == werkzeug_id)
    )
    await db.flush()


@router.post("/api-werkzeuge/{werkzeug_id}/test")
async def test_api_werkzeug(
    werkzeug_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test connection to an API werkzeug by making a HEAD request to base_url."""
    result = await db.execute(
        select(ApiWerkzeug).where(
            ApiWerkzeug.id == werkzeug_id,
            ApiWerkzeug.user_id == user.id,
        )
    )
    werkzeug = result.scalar_one_or_none()
    if werkzeug is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Werkzeug '{werkzeug_id}' not found",
        )

    import httpx

    try:
        headers = dict(werkzeug.headers or {})
        auth = werkzeug.auth or {}
        if auth.get("type") == "bearer" and auth.get("token"):
            headers["Authorization"] = f"Bearer {auth['token']}"
        elif auth.get("type") == "header" and auth.get("key") and auth.get("value"):
            headers[auth["key"]] = auth["value"]

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.head(werkzeug.base_url, headers=headers)
            return {
                "success": resp.status_code < 500,
                "status_code": resp.status_code,
                "error": None,
            }
    except Exception as e:
        return {
            "success": False,
            "status_code": None,
            "error": str(e),
        }
