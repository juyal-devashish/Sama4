"""Endpoints that can spend Claude tokens are limited per IP (429 after the limit)."""

import uuid

from app.api.routers import context as context_router
from app.api.routers import predictions as predictions_router
from app.clients.cache import Cache
from tests.factories import make_article, make_entity

IP_A = {"X-Forwarded-For": "203.0.113.9"}
IP_B = {"X-Forwarded-For": "198.51.100.7"}


async def test_followups_are_limited_per_ip(client, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        ada = await make_entity(db, name="Ada", article=article)
        await db.commit()
    body = {"entity_id": str(ada.id), "article_id": str(article.id), "question": "Why?"}

    codes = [
        (await client.post("/api/v1/context/explain", json=body, headers=IP_A)).status_code
        for _ in range(context_router.FOLLOWUPS_PER_IP + 1)
    ]
    other = await client.post("/api/v1/context/explain", json=body, headers=IP_B)

    assert codes == [200] * context_router.FOLLOWUPS_PER_IP + [429]
    assert other.status_code == 200


async def test_explanations_are_limited_per_ip(client, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada")
        await db.commit()
    url = f"/api/v1/context/{ada.id}"

    codes = [
        (await client.get(url, headers=IP_A)).status_code
        for _ in range(context_router.EXPLANATIONS_PER_IP + 1)
    ]

    assert codes == [200] * context_router.EXPLANATIONS_PER_IP + [429]
    assert (await client.get(url, headers=IP_B)).status_code == 200


async def test_starting_an_outlook_is_limited_per_ip(client):
    codes = [
        (
            await client.post(
                "/api/v1/predictions/simulate",
                json={"article_id": str(uuid.uuid4())},
                headers=IP_A,
            )
        ).status_code
        for _ in range(predictions_router.OUTLOOKS_PER_IP + 1)
    ]

    # The article doesn't exist (404) until the limit trips; the 11th call never gets that far.
    assert codes == [404] * predictions_router.OUTLOOKS_PER_IP + [429]


async def test_outlook_questions_are_limited_per_ip(client):
    for path in ("chat", "interview"):
        codes = [
            (
                await client.post(
                    f"/api/v1/predictions/{path}",
                    json={},
                    headers=IP_A,
                )
            ).status_code
            for _ in range(predictions_router.OUTLOOK_QUESTIONS_PER_IP + 1)
        ]
        # Invalid bodies are 422 until the limiter answers first with 429.
        assert codes[-1] == 429, path


async def test_limits_fail_open_without_redis(client, container, db_session):
    container.cache = Cache("")
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        ada = await make_entity(db, name="Ada", article=article)
        await db.commit()
    body = {"entity_id": str(ada.id), "article_id": str(article.id), "question": "Why?"}

    codes = {
        (await client.post("/api/v1/context/explain", json=body)).status_code for _ in range(45)
    }

    assert codes == {200}
