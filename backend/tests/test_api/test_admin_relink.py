"""POST /admin/entities/relink: re-choose stored terms' Wikipedia pages using their story."""

import json

from sqlalchemy import select

from app.ingestion.relink import explanation_cache_keys
from app.models.entity import Entity
from app.services.context import ContextService
from tests.factories import make_article, make_entity
from tests.test_ingestion.test_disambiguation import AGENCY, ICE_HITS, TRAIN, Wikidata

ADMIN = {"X-Admin-Secret": "test-secret"}
URL = "/api/v1/admin/entities/relink"
TEXT = "Passengers filmed ICE officers detaining a father at the airport."


async def _seed(db_session):
    async with db_session() as db:
        article = await make_article(db, title="Father detained by ICE", content=TEXT)
        ice = await make_entity(
            db, name="ICE", entity_type="ORG", article=article, start=TEXT.index("ICE"),
            wikipedia_url=TRAIN, short_context="Intercity Express is a German train.",
        )  # fmt: skip
        await db.commit()
        return article, ice


async def _ice(db_session) -> Entity:
    async with db_session() as db:
        return (await db.execute(select(Entity).where(Entity.canonical_name == "ICE"))).scalar_one()


async def test_dry_run_lists_the_change_without_writing(client, container, db_session):
    _article, ice = await _seed(db_session)
    container.wikimedia = Wikidata(ICE_HITS)
    container.llm.default = json.dumps({str(ice.id): "Q943091"})

    response = await client.post(URL, headers=ADMIN)

    assert response.status_code == 200
    body = response.json()
    assert (body["changed"], body["unchanged"], body["dry_run"]) == (1, 0, True)
    assert body["changes"] == [
        "ICE (ORG): Intercity Express -> U.S. Immigration and Customs Enforcement"
    ]
    assert "detaining a father" in container.llm.calls[0]["prompt"]
    assert (await _ice(db_session)).wikipedia_url == TRAIN


async def test_writing_relinks_and_clears_cached_explanations(client, container, db_session):
    article, ice = await _seed(db_session)
    container.wikimedia = Wikidata(ICE_HITS)
    container.llm.default = json.dumps({str(ice.id): "Q943091"})
    stale = [
        ContextService.cache_key(ice),
        ContextService.cache_key(ice, article.id),
        ContextService.cache_key(ice, article.id).replace(
            "context:entity:", "context:entity-more:"
        ),
    ]
    for key in [*stale, "context:entity:someone-else"]:
        await container.cache.set(key, {"text": "cached", "sources": [{"url": TRAIN}]})

    response = await client.post(URL, headers=ADMIN, params={"dry_run": "false"})

    assert response.json()["changed"] == 1
    ice = await _ice(db_session)
    assert (ice.wikidata_id, ice.wikipedia_url) == ("Q943091", AGENCY)
    assert ice.short_context == "ICE is a US federal law enforcement agency."
    assert [await container.cache.get(k) for k in stale] == [None, None, None]
    assert await container.cache.get("context:entity:someone-else") is not None


async def test_a_term_claude_does_not_answer_keeps_its_link(client, container, db_session):
    await _seed(db_session)
    container.wikimedia = Wikidata(ICE_HITS)
    container.llm.default = "Sorry, I can't tell."

    response = await client.post(URL, headers=ADMIN, params={"dry_run": "false"})

    body = response.json()
    assert (body["changed"], body["unanswered"]) == (0, 1)
    assert (await _ice(db_session)).wikipedia_url == TRAIN


async def test_needs_claude(client, container, db_session):
    await _seed(db_session)
    container.llm.available = False

    response = await client.post(URL, headers=ADMIN)

    assert response.status_code == 503


def test_cache_keys_match_the_context_service():
    class E:
        id = "e1"

    keys = explanation_cache_keys("e1", ["a1"])  # type: ignore[arg-type]

    assert ContextService.cache_key(E()) in keys  # type: ignore[arg-type]
    assert ContextService.cache_key(E(), "a1") in keys  # type: ignore[arg-type]
    more = ContextService.cache_key(E(), "a1").replace("context:entity:", "context:entity-more:")  # type: ignore[arg-type]
    assert more in keys
