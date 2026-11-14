import uuid

from app.clients.vectors import vector_id_for_article
from app.repositories import explanations as explanation_repo
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
    # Claude gets the Wikipedia extract and the story the entity appears in
    call = container.llm.calls[0]
    assert "A short Wikipedia extract." in call["prompt"]
    assert "<headline>Related story</headline>" in call["prompt"]
    assert call["system"] and call["effort"] == "low"


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


async def test_cache_hit_still_returns_related_entities_and_articles(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Related story")
        ada = await make_entity(db, name="Ada Lovelace", article=article)
        await make_entity(db, name="Charles Babbage", article=article, start=10)
        await db.commit()
    container.vectors.matches = [
        {"id": vector_id_for_article(article.id), "score": 0.9, "metadata": {"title": "Related"}}
    ]

    first = (await client.get(f"/api/v1/context/{ada.id}")).json()
    second = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert second["context"]["cached"] is True
    assert second["related_entities"] == first["related_entities"] != []
    assert second["related_articles"] == first["related_articles"] != []


async def test_empty_reply_from_claude_is_not_cached(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada", short_context="Stored context.")
        await db.commit()
    container.llm.default = ""  # Claude declined

    first = (await client.get(f"/api/v1/context/{ada.id}")).json()
    container.llm.default = "Ada was a mathematician."
    second = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert first["context"]["text"] == "Stored context."
    assert second["context"] == {**second["context"], "text": "Ada was a mathematician."}
    assert second["context"]["cached"] is False


async def test_fallback_text_is_not_cached_while_claude_is_down(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada", short_context="Stored context.")
        await db.commit()
    container.llm.available = False
    await client.get(f"/api/v1/context/{ada.id}")

    container.llm.available = True
    container.llm.default = "Ada was a mathematician."
    body = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert body["context"]["text"] == "Ada was a mathematician."


WIKI = "https://en.wikipedia.org/wiki/Ada_Lovelace"


async def test_context_lists_the_sources_it_was_written_from(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        ada = await make_entity(db, name="Ada", article=article, wikipedia_url=WIKI)
        await db.commit()

    first = (await client.get(f"/api/v1/context/{ada.id}")).json()["context"]
    second = (await client.get(f"/api/v1/context/{ada.id}")).json()["context"]

    assert first["sources"] == [
        {"type": "article", "title": "Engines", "url": article.url, "revision_url": None},
        {
            "type": "wikipedia",
            "title": "Wikipedia",
            "url": WIKI,
            "revision_url": "https://en.wikipedia.org/w/index.php?oldid=123456",
        },
    ]
    assert second["cached"] is True
    assert second["sources"] == first["sources"]


async def test_each_written_explanation_is_recorded_with_its_provenance(
    client, container, db_session
):
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        ada = await make_entity(db, name="Ada", article=article, wikipedia_url=WIKI)
        await db.commit()
    container.llm.default = "Ada was a mathematician."

    await client.get(f"/api/v1/context/{ada.id}")
    await client.get(f"/api/v1/context/{ada.id}")  # cache hit: nothing new to record

    async with db_session() as db:
        records = await explanation_repo.list_for_entity(db, ada.id)
    assert len(records) == 1
    assert records[0].text == "Ada was a mathematician."
    assert records[0].article_id == article.id
    assert (records[0].wikipedia_title, records[0].wikipedia_revision_id) == (
        "Ada_Lovelace",
        123456,
    )


async def test_declined_explanation_is_not_recorded(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada")
        await db.commit()
    container.llm.default = ""

    await client.get(f"/api/v1/context/{ada.id}")

    async with db_session() as db:
        assert await explanation_repo.list_for_entity(db, ada.id) == []


async def test_context_omits_wikipedia_when_no_extract_was_used(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada", wikipedia_url=WIKI)
        await db.commit()
    container.wikimedia.extract = None

    body = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert body["context"]["sources"] == []


async def test_old_cache_entries_fall_back_to_the_wikipedia_link(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada", wikipedia_url=WIKI)
        await db.commit()
    await container.cache.set(
        f"context:entity:{ada.id}",
        {"text": "Old text.", "generated_at": "2026-11-01T00:00:00+00:00"},
        ttl=60,
    )

    body = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert body["context"]["sources"] == [
        {"type": "wikipedia", "title": "Wikipedia", "url": WIKI, "revision_url": None}
    ]


async def test_stored_fallback_text_is_sourced_to_wikipedia(client, container, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada", short_context="Stored.", wikipedia_url=WIKI)
        await db.commit()
    container.llm.available = False

    body = (await client.get(f"/api/v1/context/{ada.id}")).json()

    assert body["context"]["sources"] == [
        {"type": "wikipedia", "title": "Wikipedia", "url": WIKI, "revision_url": None}
    ]
    # It's Wikipedia's text, dated when it was stored, not "written now by AI".
    assert body["context"]["source"] == "wikipedia_extract"
    assert body["context"]["generated_at"][:10] == ada.created_at.isoformat()[:10]


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


async def test_followup_is_grounded_in_the_article_and_the_shown_explanation(
    client, container, db_session
):
    async with db_session() as db:
        article = await make_article(
            db, title="Nvidia earnings", content="Jensen Huang said Nvidia's chips sold out."
        )
        huang = await make_entity(db, name="Jensen Huang", article=article)
        await db.commit()
    container.llm.default = "Jensen Huang leads Nvidia, which makes graphics chips."
    # The reader opens the term first: this is the explanation they see.
    shown = (await client.get(f"/api/v1/context/{huang.id}")).json()["context"]["text"]
    container.llm.default = "It makes graphics chips [explanation]."

    body = (
        await client.post(
            "/api/v1/context/explain",
            json={
                "entity_id": str(huang.id),
                "article_id": str(article.id),
                "question": "What does Nvidia make?",
            },
        )
    ).json()

    prompt = container.llm.calls[-1]["prompt"]
    assert shown in prompt  # the margin's explanation, verbatim
    assert "Jensen Huang said Nvidia's chips sold out." in prompt  # the article text
    assert "[explanation]" in prompt and "[article]" in prompt
    assert body["explanation"] == "It makes graphics chips [explanation]."
    assert [s["type"] for s in body["sources"]] == ["article", "explanation", "wikipedia"]
    assert body["sources"][0]["url"] == article.url


async def test_explain_unknown_article_404(client, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada")
        await db.commit()

    response = await client.post(
        "/api/v1/context/explain",
        json={"entity_id": str(ada.id), "article_id": str(uuid.uuid4()), "question": "?"},
    )

    assert response.status_code == 404
