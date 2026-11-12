"""POST /admin/entities/canonicalize: fold possessives and fix spaCy's types in stored data."""

import json

from sqlalchemy import select

from app.models.entity import ArticleEntity, Entity
from tests.factories import make_article, make_entity

ADMIN = {"X-Admin-Secret": "test-secret"}
URL = "/api/v1/admin/entities/canonicalize"
TEXT = "Jensen Huang's company Nvidia beat forecasts. Jensen Huang said demand was strong."


async def _seed(db_session):
    async with db_session() as db:
        article = await make_article(db, title="Nvidia earnings", content=TEXT)
        await make_entity(db, name="Jensen Huang", article=article, start=46)
        await make_entity(db, name="Jensen Huang's", article=article, start=0)
        await make_entity(db, name="Nvidia", entity_type="LOCATION", article=article, start=23)
        await db.commit()
        return article


async def _state(db_session):
    async with db_session() as db:
        entities = sorted(
            (e.canonical_name, e.entity_type) for e in (await db.execute(select(Entity))).scalars()
        )
        mentions = sorted(
            (m.mention_text, m.start_position, m.end_position)
            for m in (await db.execute(select(ArticleEntity))).scalars()
        )
    return entities, mentions


async def test_dry_run_reports_without_writing(client, container, db_session):
    await _seed(db_session)
    container.llm.default = json.dumps({"Jensen Huang": "PERSON", "Nvidia": "ORG"})
    before = await _state(db_session)

    body = (await client.post(URL, headers=ADMIN)).json()

    assert body["dry_run"] is True
    assert (body["merged"], body["retyped"], body["mentions_fixed"]) == (1, 1, 1)
    assert "Jensen Huang's (PERSON) -> merge into Jensen Huang (PERSON)" in body["changes"]
    assert "Nvidia (LOCATION) -> rename to Nvidia (ORG)" in body["changes"]
    assert await _state(db_session) == before


async def test_apply_merges_possessives_retypes_and_fixes_offsets(client, container, db_session):
    await _seed(db_session)
    container.llm.default = json.dumps({"Jensen Huang": "PERSON", "Nvidia": "ORG"})

    res = await client.post(f"{URL}?dry_run=false", headers=ADMIN)

    assert res.status_code == 200
    entities, mentions = await _state(db_session)
    assert entities == [("Jensen Huang", "PERSON"), ("Nvidia", "ORG")]
    # Every mention still points at its own text, and the possessive one lost its "'s".
    assert mentions == [("Jensen Huang", 0, 12), ("Jensen Huang", 46, 58), ("Nvidia", 23, 29)]
    for text, start, end in mentions:
        assert TEXT[start:end] == text


async def test_without_claude_only_possessives_are_fixed(client, container, db_session):
    await _seed(db_session)
    container.llm.available = False

    body = (await client.post(f"{URL}?dry_run=false", headers=ADMIN)).json()

    assert body["typed_by_claude"] is False
    entities, _ = await _state(db_session)
    assert entities == [("Jensen Huang", "PERSON"), ("Nvidia", "LOCATION")]


async def test_requires_admin_secret(client):
    assert (await client.post(URL)).status_code == 422  # header missing
    assert (await client.post(URL, headers={"X-Admin-Secret": "nope"})).status_code == 403
