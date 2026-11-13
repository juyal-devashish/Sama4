from pydantic import BaseModel


class SourceFeed(BaseModel):
    url: str
    category: str
    region: str


class SourceOutlet(BaseModel):
    name: str
    feeds: list[SourceFeed]


class SourcesResponse(BaseModel):
    """Every outlet the nightly pipeline reads, with each of its RSS feeds."""

    outlets: list[SourceOutlet]
    feed_count: int
