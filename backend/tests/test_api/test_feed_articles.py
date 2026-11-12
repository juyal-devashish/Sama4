import uuid
from datetime import UTC, datetime, timedelta

from tests.factories import make_article, make_entity, make_source


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_feed_lists_completed_articles_newest_first_with_entity_counts(client, db_session):
    now = datetime.now(UTC)
    async with db_session() as db:
        source = await make_source(db, "BBC")
        old = await make_article(db, source=source, title="Old", published_at=now - timedelta(1))
        new = await make_article(db, source=source, title="New", published_at=now)
        await make_article(db, title="Pending", status="processing")
        await make_entity(db, name="A", article=new)
        await make_entity(db, name="B", article=new, start=5)
        await db.commit()

    body = (await client.get("/api/v1/feed")).json()

    assert [a["title"] for a in body["articles"]] == ["New", "Old"]
    assert body["articles"][0]["entity_count"] == 2
    assert body["articles"][1]["entity_count"] == 0
    assert body["articles"][0]["source"]["name"] == "BBC"
    assert body["pagination"] == {"page": 1, "limit": 20, "total": 2, "has_next": False}
    assert str(old.id) == body["articles"][1]["id"]


async def test_feed_filters_by_category_and_paginates(client, db_session):
    async with db_session() as db:
        for i in range(3):
            await make_article(db, title=f"Tech {i}", categories=["tech"])
        await make_article(db, title="World", categories=["world"])
        await db.commit()

    body = (await client.get("/api/v1/feed", params={"category": "tech", "limit": 2})).json()

    assert len(body["articles"]) == 2
    assert all("Tech" in a["title"] for a in body["articles"])
    assert body["pagination"]["total"] == 3
    assert body["pagination"]["has_next"] is True


async def test_article_detail_includes_entities_in_text_order(client, db_session):
    async with db_session() as db:
        article = await make_article(db, content="Ada met Babbage.")
        await make_entity(db, name="Babbage", article=article, start=8)
        await make_entity(db, name="Ada", article=article, start=0)
        await db.commit()

    body = (await client.get(f"/api/v1/articles/{article.id}")).json()

    assert body["content"] == "Ada met Babbage."
    assert [e["text"] for e in body["entities"]] == ["Ada", "Babbage"]
    assert body["source"]["name"] == "Unknown"


async def test_article_404(client):
    response = await client.get(f"/api/v1/articles/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_reference_page_groups_entities(client, db_session):
    async with db_session() as db:
        article = await make_article(db)
        await make_entity(db, name="Ada", article=article, short_context="Mathematician.")
        await db.commit()

    body = (await client.get(f"/api/v1/articles/{article.id}/reference")).json()

    assert body["article"]["id"] == str(article.id)
    assert body["entities"][0]["context"] == "Mathematician."
    assert body["related_articles"] == []
