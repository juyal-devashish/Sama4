"""Public list of the outlets and feeds the pipeline reads."""

from app.ingestion.sources import NEWS_SOURCES
from app.services.sources import list_sources

URL = "/api/v1/sources"


async def test_lists_every_feed_once_grouped_by_outlet(client):
    res = await client.get(URL)

    assert res.status_code == 200
    body = res.json()
    urls = [f["url"] for o in body["outlets"] for f in o["feeds"]]
    assert sorted(urls) == sorted(s["url"] for s in NEWS_SOURCES)
    assert body["feed_count"] == len(NEWS_SOURCES)
    names = [o["name"] for o in body["outlets"]]
    assert names == sorted(set(names), key=str.lower)


def test_groups_feeds_in_pipeline_order():
    feeds = [
        {"name": "b", "url": "https://b/1", "category": "tech", "region": "tech"},
        {"name": "A", "url": "https://a/1", "category": "general", "region": "us"},
        {"name": "b", "url": "https://b/2", "category": "world", "region": "world"},
    ]

    res = list_sources(feeds)

    assert [o.name for o in res.outlets] == ["A", "b"]
    assert [f.url for f in res.outlets[1].feeds] == ["https://b/1", "https://b/2"]
    assert res.feed_count == 3


def test_blocked_publishers_are_not_listed():
    feeds = [
        {
            "name": "FT",
            "url": "https://www.ft.com/rss/home",
            "category": "business",
            "region": "world",
        },
        {
            "name": "BBC",
            "url": "https://feeds.bbci.co.uk/x",
            "category": "world",
            "region": "world",
        },
    ]

    res = list_sources(feeds, blocked="ft.com")

    assert [o.name for o in res.outlets] == ["BBC"]
    assert res.feed_count == 1


def test_every_feed_has_a_distinct_label_within_its_outlet():
    by_outlet: dict[str, list[str]] = {}
    for s in NEWS_SOURCES:
        assert s.get("label"), s["url"]
        by_outlet.setdefault(s["name"], []).append(s["label"])
    for name, labels in by_outlet.items():
        assert len(labels) == len(set(labels)), name
    assert "NYT" not in by_outlet  # outlets go by their full name


async def test_labels_are_in_the_response(client):
    body = (await client.get(URL)).json()
    labels = {f["url"]: f["label"] for o in body["outlets"] for f in o["feeds"]}
    assert labels["https://feeds.bloomberg.com/markets/news.rss"] == "Markets"


async def test_ensure_renames_an_outlet_whose_name_changed(db_session):
    from app.repositories import sources as source_repo

    cfg = {"name": "NYT", "url": "https://rss.example/nyt", "category": "general"}
    async with db_session() as db:
        await source_repo.ensure(db, [cfg])
        await source_repo.ensure(db, [{**cfg, "name": "The New York Times"}])
        row = await source_repo.get_by_feed_url(db, cfg["url"])
    assert row is not None and row.name == "The New York Times"


def test_every_outlet_has_one_home_page():
    sites: dict[str, set[str]] = {}
    for s in NEWS_SOURCES:
        sites.setdefault(s["name"], set()).add(s.get("site", ""))
    for name, found in sites.items():
        assert len(found) == 1 and next(iter(found)).startswith("https://"), name


async def test_the_outlet_home_page_is_in_the_response(client):
    body = (await client.get(URL)).json()
    sites = {o["name"]: o["site"] for o in body["outlets"]}
    assert sites["The New York Times"] == "https://www.nytimes.com"
