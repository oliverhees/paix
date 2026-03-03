"""Anthropic Claude OAuth PKCE flow for subscription token acquisition."""
import base64
import hashlib
import json
import os
import secrets
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User
from routers.auth import get_current_user

router = APIRouter()

CLAUDE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
AUTHORIZE_URL = "https://claude.ai/oauth/authorize"
TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
SCOPES = "user:inference user:profile user:sessions:claude_code user:mcp_servers"

# In-memory PKCE state store (good enough for single-user local app)
_oauth_states: dict[str, dict] = {}


def _generate_pkce():
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


@router.get("/auth/claude/start")
async def claude_oauth_start(
    request: Request,
    user: User = Depends(get_current_user),
):
    """Generate PKCE params and return the authorization URL."""
    code_verifier, code_challenge = _generate_pkce()
    state = secrets.token_urlsafe(16)

    # Store state + verifier + user_id for callback
    _oauth_states[state] = {
        "code_verifier": code_verifier,
        "user_id": str(user.id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Build redirect URI — use the same server that received this request
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/v1/auth/claude/callback"

    params = {
        "response_type": "code",
        "client_id": CLAUDE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    from urllib.parse import urlencode
    auth_url = f"{AUTHORIZE_URL}?{urlencode(params)}"

    return {
        "auth_url": auth_url,
        "state": state,
        "redirect_uri": redirect_uri,
    }


@router.get("/auth/claude/callback")
async def claude_oauth_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle Anthropic OAuth callback, exchange code for token."""
    if error:
        return HTMLResponse(content=_callback_html(success=False, message=f"OAuth error: {error}"))

    if not code or not state:
        return HTMLResponse(content=_callback_html(success=False, message="Missing code or state"))

    state_data = _oauth_states.pop(state, None)
    if not state_data:
        return HTMLResponse(content=_callback_html(success=False, message="Invalid or expired state"))

    # Exchange code for token
    from urllib.parse import urlparse
    import re

    # We need the redirect_uri to match what was sent in the auth request
    # Get it from the current request URL
    # Exchange code for access token
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                TOKEN_URL,
                json={
                    "grant_type": "authorization_code",
                    "client_id": CLAUDE_CLIENT_ID,
                    "code": code,
                    "code_verifier": state_data["code_verifier"],
                    "redirect_uri": f"http://localhost:8000/api/v1/auth/claude/callback",
                },
                headers={
                    "Content-Type": "application/json",
                    "anthropic-beta": "oauth-2025-04-20",
                },
            )
            resp.raise_for_status()
            token_data = resp.json()
    except Exception as e:
        return HTMLResponse(content=_callback_html(success=False, message=f"Token exchange failed: {e}"))

    access_token = token_data.get("access_token")
    if not access_token:
        return HTMLResponse(content=_callback_html(success=False, message="No access token in response"))

    # Save token to integration_tokens
    import uuid as uuid_mod
    from sqlalchemy import select, update
    from models.integration import IntegrationToken

    user_id = uuid_mod.UUID(state_data["user_id"])

    # Check if anthropic token exists
    result = await db.execute(
        select(IntegrationToken).where(
            IntegrationToken.user_id == user_id,
            IntegrationToken.provider == "anthropic",
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.access_token = access_token
        existing.updated_at = datetime.now(timezone.utc)
    else:
        token_obj = IntegrationToken(
            user_id=user_id,
            provider="anthropic",
            access_token=access_token,
        )
        db.add(token_obj)

    await db.commit()

    return HTMLResponse(content=_callback_html(success=True, message="Claude Subscription verbunden!"))


def _callback_html(success: bool, message: str) -> str:
    icon = "✅" if success else "❌"
    color = "#22c55e" if success else "#ef4444"
    return f"""<!DOCTYPE html>
<html>
<head><title>PAI-X OAuth</title>
<style>
  body {{ font-family: system-ui; display: flex; align-items: center; justify-content: center;
         min-height: 100vh; margin: 0; background: #0f172a; color: #f1f5f9; }}
  .card {{ text-align: center; padding: 2rem; border-radius: 1rem;
           background: #1e293b; border: 1px solid #334155; max-width: 400px; }}
  .icon {{ font-size: 3rem; margin-bottom: 1rem; }}
  .msg {{ color: {color}; font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }}
  .sub {{ color: #94a3b8; font-size: 0.875rem; }}
</style>
</head>
<body>
<div class="card">
  <div class="icon">{icon}</div>
  <div class="msg">{message}</div>
  <div class="sub">{"Dieses Fenster wird automatisch geschlossen..." if success else "Bitte schliesse dieses Fenster und versuche es erneut."}</div>
</div>
<script>
  {"setTimeout(() => window.close(), 2000);" if success else ""}
  if (window.opener) {{
    window.opener.postMessage({{"type": "claude_oauth", "success": {"true" if success else "false"}}}, "*");
  }}
</script>
</body>
</html>"""
