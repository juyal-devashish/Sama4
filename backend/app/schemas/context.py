import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


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
    # Wikipedia only: a permalink to the exact revision the explanation used.
    revision_url: str | None = None


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


ReportReason = Literal["wrong_thing", "wrong_fact", "outdated", "other"]


class ReportRequest(BaseModel):
    """A reader saying an explanation is wrong."""

    reason: ReportReason
    article_id: uuid.UUID | None = None
    explanation_text: str = Field(default="", max_length=4000)
    note: str | None = Field(default=None, max_length=1000)


class ReportResponse(BaseModel):
    status: Literal["received"] = "received"


class ReportOut(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    entity_name: str
    article_id: uuid.UUID | None
    explanation_text: str
    reason: str
    note: str | None
    status: str
    created_at: datetime


class ExplainResponse(BaseModel):
    entity: EntityInfo
    explanation: str
    sources: list[ContextSource] = []
    confidence: float = 0.0
