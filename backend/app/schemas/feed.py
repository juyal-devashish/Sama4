import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PaginationMeta


class ArticleCardSource(BaseModel):
    name: str
    logo_url: str | None = None


class ArticleCard(BaseModel):
    id: uuid.UUID
    title: str
    summary: str | None = None
    image_url: str | None = None
    source: ArticleCardSource
    published_at: datetime | None = None
    reading_time_minutes: int | None = None
    categories: list[str] = []
    entity_count: int = 0
    # Names of the terms in the story (people, places, organisations), for search.
    entity_names: list[str] = []


class FeedResponse(BaseModel):
    articles: list[ArticleCard]
    pagination: PaginationMeta
