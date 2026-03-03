"""API Integration Tests — Auth Endpoints."""

import pytest
import httpx

BASE = "http://localhost:8000/api/v1"

TEST_EMAIL = "test_api@test.de"
TEST_PASSWORD = "testpass123"
TEST_NAME = "API Test User"


@pytest.mark.asyncio
async def test_health():
    """Health endpoint returns 200 with status ok."""
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_register_and_login():
    """Register a new user, login, fetch profile, and update profile."""
    async with httpx.AsyncClient() as c:
        # Register — 201 on first run, 409 if user already exists
        r = await c.post(f"{BASE}/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME,
        })
        assert r.status_code in (201, 409), (
            f"Unexpected status {r.status_code}: {r.text}"
        )

        # Login
        r = await c.post(f"{BASE}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert r.status_code == 200, f"Login failed: {r.text}"
        data = r.json()
        assert "access_token" in data, "access_token missing from login response"
        assert "refresh_token" in data, "refresh_token missing from login response"
        assert data["token_type"] == "bearer"
        token = data["access_token"]

        # GET /auth/me — fetch profile
        r = await c.get(
            f"{BASE}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, f"GET /auth/me failed: {r.text}"
        me = r.json()
        assert me["email"] == TEST_EMAIL
        assert "id" in me
        assert "name" in me

        # PUT /auth/me — update name
        r = await c.put(
            f"{BASE}/auth/me",
            json={"name": "Updated Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, f"PUT /auth/me failed: {r.text}"
        updated = r.json()
        assert updated["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_login_wrong_password():
    """Login with wrong password returns 401."""
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/auth/login", json={
            "email": "oliver@test.de",
            "password": "wrongpassword",
        })
        assert r.status_code == 401, (
            f"Expected 401, got {r.status_code}: {r.text}"
        )
        data = r.json()
        assert "detail" in data


@pytest.mark.asyncio
async def test_me_without_token_returns_401():
    """Accessing /auth/me without a token should return 401 or 403."""
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/auth/me")
        assert r.status_code in (401, 403), (
            f"Expected 401/403, got {r.status_code}"
        )


@pytest.mark.asyncio
async def test_login_nonexistent_user():
    """Login with unknown email returns 401."""
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/auth/login", json={
            "email": "nobody_xyz@example.com",
            "password": "somepassword123",
        })
        assert r.status_code == 401, (
            f"Expected 401, got {r.status_code}: {r.text}"
        )
