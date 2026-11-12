"""Tests for the early-access waitlist endpoint."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.database import create_tables
from app.routers import waitlist


@pytest.mark.asyncio
async def test_join_then_join_again(client):
    await create_tables()
    email = f"Reader-{uuid.uuid4().hex[:8]}@Example.com "
    first = await client.post("/api/v1/waitlist", json={"email": email})
    assert first.status_code == 201
    assert first.json() == {"status": "joined"}

    second = await client.post("/api/v1/waitlist", json={"email": email.strip().lower()})
    assert second.status_code == 201
    assert second.json() == {"status": "exists"}


@pytest.mark.asyncio
async def test_rejects_invalid_email(client):
    response = await client.post("/api/v1/waitlist", json={"email": "not-an-email"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_rate_limited_returns_429(client):
    with patch("app.routers.waitlist._within_limit", new=AsyncMock(return_value=False)):
        response = await client.post("/api/v1/waitlist", json={"email": "a@example.com"})
    assert response.status_code == 429


@pytest.mark.asyncio
async def test_limit_uses_last_forwarded_ip(client):
    check = AsyncMock(return_value=True)
    with patch("app.routers.waitlist._within_limit", new=check):
        await client.post(
            "/api/v1/waitlist",
            json={"email": f"ip-{uuid.uuid4().hex[:6]}@example.com"},
            headers={"X-Forwarded-For": "6.6.6.6, 203.0.113.9"},
        )
    check.assert_awaited_once_with("203.0.113.9")


@pytest.mark.asyncio
async def test_limit_fails_open_without_redis():
    broken = AsyncMock(side_effect=ConnectionError("redis down"))
    with patch("app.routers.waitlist._limiter") as limiter:
        limiter.check_limit = broken
        assert await waitlist._within_limit("1.2.3.4") is True
