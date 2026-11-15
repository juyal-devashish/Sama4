"""Anonymous daily usage totals: counted per event, never per person."""

from datetime import UTC, datetime

from app.clients.cache import Cache
from tests.factories import make_article, make_entity

ADMIN = {"X-Admin-Secret": "test-secret"}
TODAY = datetime.now(UTC).date().isoformat()
FROM = {"X-Forwarded-For": "203.0.113.77", "User-Agent": "TestBrowser/1.0", "Cookie": "id=abc"}


async def test_successful_requests_are_counted_by_event(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines", content="Ada wrote it.")
        ada = await make_entity(db, name="Ada", article=article)
        await db.commit()
    container.llm.default = "An answer."

    await client.get(f"/api/v1/articles/{article.id}")
    await client.get(f"/api/v1/articles/{article.id}")
    await client.get(f"/api/v1/context/{ada.id}")
    await client.post(
        "/api/v1/context/explain",
        json={"entity_id": str(ada.id), "article_id": str(article.id), "question": "Why?"},
    )

    store = container.cache.store
    assert store[f"usage:{TODAY}:story_opened"] == 2
    assert store[f"usage:{TODAY}:term_explained"] == 1
    assert store[f"usage:{TODAY}:followup_asked"] == 1
    assert f"usage:{TODAY}:outlook_started" not in store


async def test_failed_and_unrelated_requests_are_not_counted(client, container):
    import uuid

    await client.get(f"/api/v1/articles/{uuid.uuid4()}")  # 404
    await client.get("/api/v1/feed")  # not one of the counted events
    await client.get("/health")

    assert [k for k in container.cache.store if k.startswith("usage:")] == []


async def test_nothing_that_identifies_a_reader_is_stored(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        await db.commit()

    await client.get(f"/api/v1/articles/{article.id}", headers=FROM)

    usage = {k: v for k, v in container.cache.store.items() if k.startswith("usage:")}
    assert usage == {f"usage:{TODAY}:story_opened": 1}  # a day, an event, a number
    everything = repr(container.cache.store)
    for fragment in ("203.0.113.77", "TestBrowser", "abc"):
        assert fragment not in everything


async def test_admin_lists_the_totals_newest_day_first(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        await db.commit()
    await client.get(f"/api/v1/articles/{article.id}")

    days = (await client.get("/api/v1/admin/usage?days=3", headers=ADMIN)).json()

    assert [d["day"] for d in days][0] == TODAY and len(days) == 3
    assert days[0]["events"]["story_opened"] == 1
    assert days[1]["events"]["story_opened"] == 0
    wrong = await client.get("/api/v1/admin/usage", headers={"X-Admin-Secret": "nope"})
    assert wrong.status_code == 403


async def test_without_redis_nothing_is_counted_and_nothing_breaks(client, container, db_session):
    container.cache = Cache("")
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        await db.commit()

    response = await client.get(f"/api/v1/articles/{article.id}")

    assert response.status_code == 200
    days = (await client.get("/api/v1/admin/usage?days=1", headers=ADMIN)).json()
    assert days[0]["events"]["story_opened"] is None  # unknown, not zero
