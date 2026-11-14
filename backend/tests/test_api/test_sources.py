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
