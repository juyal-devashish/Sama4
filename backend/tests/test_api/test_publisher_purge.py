"""Publisher opt-out: purge a domain's stored stories."""

from sqlalchemy import select

from app.models.article import Article
from app.models.entity import ArticleEntity
from tests.factories import make_article, make_entity

URL = "/api/v1/admin/publishers/purge"
ADMIN = {"X-Admin-Secret": "test-secret"}


async def _story(db, url: str, title: str) -> Article:
    article = await make_article(db, title=title)
    article.url = url
    await make_entity(db, name=f"Person {title}", article=article)
    return article


async def test_dry_run_reports_without_deleting(client, db_session):
    async with db_session() as db:
        await _story(db, "https://www.ft.com/content/1", "FT one")
        await _story(db, "https://myft.com/content/2", "Look-alike")
        await db.commit()

    body = (await client.post(URL, params={"domain": "ft.com"}, headers=ADMIN)).json()

    assert (body["matched"], body["deleted"], body["dry_run"]) == (1, 0, True)
    assert body["sample_titles"] == ["FT one"]
    async with db_session() as db:
        assert len((await db.execute(select(Article))).scalars().all()) == 2


async def test_purge_deletes_stories_mentions_and_vectors(client, container, db_session):
    async with db_session() as db:
        ft = await _story(db, "https://www.ft.com/content/1", "FT one")
        bbc = await _story(db, "https://www.bbc.co.uk/news/2", "BBC two")
        await db.commit()

    body = (
        await client.post(URL, params={"domain": "ft.com", "dry_run": "false"}, headers=ADMIN)
    ).json()

    assert (body["matched"], body["deleted"], body["vectors_deleted"]) == (1, 1, True)
    assert container.vectors.deleted == [ft.id]
    async with db_session() as db:
        remaining = (await db.execute(select(Article.id))).scalars().all()
        mentions = (await db.execute(select(ArticleEntity.article_id))).scalars().all()
    assert remaining == [bbc.id]
    assert mentions == [bbc.id]


async def test_purge_needs_exactly_one_domain(client):
    assert (
        await client.post(URL, params={"domain": "a.com,b.com"}, headers=ADMIN)
    ).status_code == 400
    assert (await client.post(URL, params={"domain": " "}, headers=ADMIN)).status_code == 400
