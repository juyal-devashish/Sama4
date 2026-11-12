"""Early-access waitlist endpoint."""

from sqlalchemy import select

from app.clients.cache import Cache
from app.models.waitlist import WaitlistSignup

URL = "/api/v1/waitlist"


async def test_join_normalizes_email_then_reports_exists(client, db_session):
    first = await client.post(URL, json={"email": "  Reader@Example.com "})
    second = await client.post(URL, json={"email": "reader@example.com"})

    assert (first.status_code, first.json()) == (201, {"status": "joined"})
    assert (second.status_code, second.json()) == (201, {"status": "exists"})
    async with db_session() as db:
        emails = (await db.execute(select(WaitlistSignup.email))).scalars().all()
    assert emails == ["reader@example.com"]


async def test_rejects_invalid_email(client):
    assert (await client.post(URL, json={"email": "not-an-email"})).status_code == 422


async def test_sixth_attempt_from_same_ip_is_429_other_ip_unaffected(client):
    same_ip = {"X-Forwarded-For": "203.0.113.9"}
    codes = [
        (await client.post(URL, json={"email": f"u{i}@example.com"}, headers=same_ip)).status_code
        for i in range(6)
    ]
    other = await client.post(
        URL, json={"email": "other@example.com"}, headers={"X-Forwarded-For": "198.51.100.7"}
    )

    assert codes == [201] * 5 + [429]
    assert other.status_code == 201


async def test_limit_uses_last_forwarded_ip(client, container):
    await client.post(
        URL,
        json={"email": "ip@example.com"},
        headers={"X-Forwarded-For": "6.6.6.6, 203.0.113.9"},
    )
    assert "ratelimit:waitlist:203.0.113.9" in container.cache.store


async def test_fails_open_without_redis(client, container):
    container.cache = Cache("")  # no Redis: hit() returns None
    for i in range(7):
        response = await client.post(URL, json={"email": f"open{i}@example.com"})
        assert response.status_code == 201
