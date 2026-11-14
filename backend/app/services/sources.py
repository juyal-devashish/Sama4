"""The outlets and feeds Samā4 reads, for the public Sources page.

Reads the pipeline's feed list (`ingestion/sources.py`, plain data) so the page can
never drift from what's actually ingested.
"""

from app.ingestion.blocklist import allowed_sources, parse_domains
from app.ingestion.sources import NEWS_SOURCES
from app.schemas.source import SourceFeed, SourceOutlet, SourcesResponse


def list_sources(sources: list[dict] | None = None, blocked: str = "") -> SourcesResponse:
    """Feeds grouped by outlet, outlets A–Z, feeds in pipeline order. Opted-out
    publishers' feeds are left out, as the pipeline skips them."""
    sources = allowed_sources(NEWS_SOURCES if sources is None else sources, parse_domains(blocked))
    by_outlet: dict[str, list[SourceFeed]] = {}
    for s in sources:
        by_outlet.setdefault(s["name"], []).append(
            SourceFeed(url=s["url"], category=s["category"], region=s["region"])
        )
    outlets = [
        SourceOutlet(name=name, feeds=feeds)
        for name, feeds in sorted(by_outlet.items(), key=lambda kv: kv[0].lower())
    ]
    return SourcesResponse(outlets=outlets, feed_count=len(sources))
