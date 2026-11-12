"""Tests for the early-access waitlist endpoint."""

import uuid

import pytest

from app.database import create_tables


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
