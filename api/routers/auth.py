"""Auth Endpoints — registration, login, token refresh, logout."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_expiry_seconds,
)
from auth.password import hash_password, verify_password
from config import settings
from models.database import get_db
from models.auth_session import AuthSession
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
# Request / Response Schemas
# ──────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)


class RegisterResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    expires_in: int


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
    s3_endpoint_url: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket_name: str | None = None
    s3_region: str | None = None
    created_at: datetime | None = None


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.post(
    "/auth/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user."""
    # Check if email already taken
    existing = await db.execute(
        select(User).where(User.email == request.email)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        name=request.name,
    )
    db.add(user)
    await db.flush()

    return RegisterResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        created_at=user.created_at,
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password, returns JWT tokens."""
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # Store refresh token in DB
    auth_session = AuthSession(
        user_id=user.id,
        refresh_token=refresh_token,
        user_agent=req.headers.get("user-agent"),
        ip_address=req.client.host if req.client else None,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(auth_session)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=get_token_expiry_seconds(),
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
async def refresh(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh an access token using a valid refresh token."""
    try:
        payload = decode_token(request.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not a refresh token",
        )

    # Verify refresh token exists in DB (not revoked)
    result = await db.execute(
        select(AuthSession).where(
            AuthSession.refresh_token == request.refresh_token
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    if session.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    user_id = payload["sub"]
    new_access_token = create_access_token(user_id)

    return RefreshResponse(
        access_token=new_access_token,
        expires_in=get_token_expiry_seconds(),
    )


@router.post("/auth/logout")
async def logout(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout — invalidate all refresh tokens for the user."""
    await db.execute(
        delete(AuthSession).where(AuthSession.user_id == user.id)
    )
    await db.flush()
    return {"message": "Logged out successfully"}


@router.get("/auth/me", response_model=UserMeResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get the currently authenticated user."""
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
        s3_endpoint_url=user.s3_endpoint_url,
        s3_access_key=user.s3_access_key,
        s3_secret_key=_mask_api_key(user.s3_secret_key),
        s3_bucket_name=user.s3_bucket_name,
        s3_region=user.s3_region,
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
    s3_endpoint_url: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket_name: str | None = None
    s3_region: str | None = None


@router.put("/auth/me", response_model=UserMeResponse)
async def update_me(
    request: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the currently authenticated user's profile."""
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
        # Allow clearing by sending empty string
        user.brave_search_api_key = request.brave_search_api_key or None
    if request.s3_endpoint_url is not None:
        user.s3_endpoint_url = request.s3_endpoint_url or None
    if request.s3_access_key is not None:
        user.s3_access_key = request.s3_access_key or None
    if request.s3_secret_key is not None and not request.s3_secret_key.startswith("*") and "..." not in request.s3_secret_key:
        user.s3_secret_key = request.s3_secret_key or None
    if request.s3_bucket_name is not None:
        user.s3_bucket_name = request.s3_bucket_name or None
    if request.s3_region is not None:
        user.s3_region = request.s3_region or None
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
        s3_endpoint_url=user.s3_endpoint_url,
        s3_access_key=user.s3_access_key,
        s3_secret_key=_mask_api_key(user.s3_secret_key),
        s3_bucket_name=user.s3_bucket_name,
        s3_region=user.s3_region,
        created_at=user.created_at,
    )
