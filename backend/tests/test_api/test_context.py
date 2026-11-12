import uuid

from app.clients.vectors import vector_id_for_article
from tests.factories import make_article, make_entity


async def test_context_generates_with_claude_and_returns_related(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Related story")
        ada = await make_entity(db, name="Ada Lovelace", article=article)
        await make_entity(db, name="Charles Babbage", article=article, start=10)
        await db.commit()
    container.llm.default = "Ada Lovelace was a mathematician."
    container.vectors.matches = [
        {"id": vector_id_for_article(article.id), "score": 0.9, "metadata": {"title": "Related"}},
        {"id": "not-an-article", "score": 0.5, "metadata": {"title": "junk"}},
    ]

    response = await client.get(f"/api/v1/context/{ada.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["context"]["text"] == "Ada Lovelace was a mathematician."
    assert body["context"]["cached"] is False
    assert [e["name"] for e in body["related_entities"]] == ["Charles Babbage"]
    assert body["related_articles"] == [{"id": str(article.id), "title": "Related"}]
    # Wikipedia extract is passed to Claude
    assert "A short Wikipedia extract." in container.llm.calls[0]["prompt"]


async def test_context_second_call_is_served_from_cache(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada")
        await db.commit()

    first = (await client.get(f"/api/v1/context/{ada.id}")).json()
    second = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert first["context"]["cached"] is False
    assert second["context"]["cached"] is True
    assert second["context"]["text"] == first["context"]["text"]
    assert len(container.llm.calls) == 1


async def test_context_uses_stored_context_when_llm_unavailable(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada", short_context="Stored context.")
        await db.commit()
    container.llm.available = False

    body = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert body["context"]["text"] == "Stored context."
    assert container.llm.calls == []


async def test_context_unknown_entity_404(client):
    response = await client.get(f"/api/v1/context/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_explain_answers_followup(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        ada = await make_entity(db, name="Ada", article=article)
        await db.commit()
    container.llm.default = "Because of the Analytical Engine."

    response = await client.post(
        "/api/v1/context/explain",
        json={"entity_id": str(ada.id), "article_id": str(article.id), "question": "Why?"},
    )

    assert response.status_code == 200
    assert response.json()["explanation"] == "Because of the Analytical Engine."
    assert container.llm.calls[0]["effort"] == "medium"
    assert '"Why?"' in container.llm.calls[0]["prompt"]


async def test_explain_unknown_article_404(client, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada")
        await db.commit()

    response = await client.post(
        "/api/v1/context/explain",
        json={"entity_id": str(ada.id), "article_id": str(uuid.uuid4()), "question": "?"},
    )

    assert response.status_code == 404
