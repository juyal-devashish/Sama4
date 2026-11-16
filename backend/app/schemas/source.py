from pydantic import BaseModel


class SourceFeed(BaseModel):
    url: str
    label: str = ""  # which of the outlet's feeds this is: "Markets", "Explained"
    category: str
    region: str


class SourceOutlet(BaseModel):
    name: str
    site: str = ""  # the outlet's home page
    feeds: list[SourceFeed]


class SourcesResponse(BaseModel):
    """Every outlet the nightly pipeline reads, with each of its RSS feeds."""

    outlets: list[SourceOutlet]
    feed_count: int
