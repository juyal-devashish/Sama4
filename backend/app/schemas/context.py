import uuid
from datetime import datetime

from pydantic import BaseModel


class EntityInfo(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    wikidata_id: str | None = None
    wikipedia_url: str | None = None


class ContextSource(BaseModel):
    type: str  # "article" | "wikipedia" | "graph" | "explanation" | "outlook"
    title: str | None = None
    url: str | None = None


class ContextData(BaseModel):
    text: str
    generated_at: datetime
    source: str = "rag_pipeline"
    cached: bool = False
    # What the explanation was written from, so the reader can check it.
    sources: list[ContextSource] = []


class RelatedEntity(BaseModel):
    id: uuid.UUID
    name: str
    type: str


class RelatedArticleBrief(BaseModel):
    id: uuid.UUID
    title: str


class ContextResponse(BaseModel):
    entity: EntityInfo
    context: ContextData
    related_entities: list[RelatedEntity] = []
    related_articles: list[RelatedArticleBrief] = []


class ExplainRequest(BaseModel):
    entity_id: uuid.UUID
    article_id: uuid.UUID
    question: str


class ExplainResponse(BaseModel):
    entity: EntityInfo
    explanation: str
    sources: list[ContextSource] = []
    confidence: float = 0.0
