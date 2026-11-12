"""Entity context (the core feature): explain an entity, answer follow-up questions.

Pipeline for GET /context/{entity_id}:
    cache -> Wikipedia extract + MiroFish graph (if enabled) -> Claude -> cache
plus related entities (SQL) and related articles (Pinecone search).
"""

import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.cache import Cache
from app.clients.llm import LLMClient
from app.clients.mirofish import MirofishClient
from app.clients.vectors import VectorStore, article_id_from_vector_id
from app.clients.wikimedia import WikimediaClient
from app.models.article import Article
from app.models.entity import Entity
from app.prompts.templates import PROMPTS
from app.repositories import entities as entity_repo
from app.repositories import predictions as prediction_repo
from app.schemas.context import (
    ContextData,
    ContextResponse,
    ContextSource,
    EntityInfo,
    ExplainResponse,
    RelatedArticleBrief,
    RelatedEntity,
)

logger = logging.getLogger(__name__)


def entity_info(entity: Entity) -> EntityInfo:
    return EntityInfo(
        id=entity.id,
        name=entity.canonical_name,
        type=entity.entity_type,
        wikidata_id=entity.wikidata_id,
        wikipedia_url=entity.wikipedia_url,
    )


def related_article_briefs(matches: list[dict]) -> list[RelatedArticleBrief]:
    """Map Pinecone matches to briefs, skipping ids that aren't article vectors."""
    briefs: list[RelatedArticleBrief] = []
    for m in matches:
        article_id = article_id_from_vector_id(m.get("id", ""))
        if article_id is not None:
            title = (m.get("metadata") or {}).get("title", "")
            briefs.append(RelatedArticleBrief(id=article_id, title=title))
    return briefs


class ContextService:
    """Generates entity explanations and follow-up answers."""

    def __init__(
        self,
        *,
        llm: LLMClient,
        vectors: VectorStore,
        cache: Cache,
        wikimedia: WikimediaClient,
        mirofish: MirofishClient,
        context_ttl: int,
    ) -> None:
        self.llm = llm
        self.vectors = vectors
        self.cache = cache
        self.wikimedia = wikimedia
        self.mirofish = mirofish
        self.context_ttl = context_ttl

    @staticmethod
    def cache_key(entity: Entity) -> str:
        return f"context:entity:{entity.id}"

    async def get_context(self, entity: Entity, db: AsyncSession) -> ContextResponse:
        """Explain an entity. Cached responses omit related entities/articles."""
        cached = await self.cache.get(self.cache_key(entity))
        if cached:
            return ContextResponse(
                entity=entity_info(entity),
                context=ContextData(
                    text=cached["text"], generated_at=cached["generated_at"], cached=True
                ),
            )

        if entity.short_context and not self.llm.available:
            context_text = entity.short_context
        else:
            context_text = await self._generate_context(entity)

        now = datetime.now(UTC)
        await self.cache.set(
            self.cache_key(entity),
            {"text": context_text, "generated_at": now.isoformat()},
            ttl=self.context_ttl,
        )

        related_entities = [
            RelatedEntity(id=e.id, name=e.canonical_name, type=e.entity_type)
            for e in await entity_repo.list_co_occurring(db, entity)
        ]
        related_articles = related_article_briefs(
            await self.vectors.search(entity.canonical_name, top_k=3)
        )

        return ContextResponse(
            entity=entity_info(entity),
            context=ContextData(text=context_text, generated_at=now, cached=False),
            related_entities=related_entities,
            related_articles=related_articles,
        )

    async def _generate_context(self, entity: Entity) -> str:
        wikipedia_extract = await self.wikimedia.get_wikipedia_extract(entity.wikipedia_url or "")
        graph_context = await self._mirofish_graph_context(entity)
        prompt = PROMPTS["entity_context"]["v1"]["template"].format(
            entity_name=entity.canonical_name,
            entity_type=entity.entity_type,
            article_excerpt="",
            wikidata_facts="",
            wikipedia_excerpt=wikipedia_extract or "No Wikipedia information available.",
            related_articles_summaries=graph_context,
        )
        return await self.llm.generate(prompt, effort="low")

    async def answer_followup(
        self, entity: Entity, article: Article, question: str, db: AsyncSession
    ) -> ExplainResponse:
        """Answer a reader's question about an entity, in the context of an article."""
        wikipedia_extract = await self.wikimedia.get_wikipedia_extract(entity.wikipedia_url or "")

        prediction_context = ""
        prediction = await prediction_repo.latest_completed_for_article(db, article.id)
        if prediction and prediction.prediction_summary:
            prediction_context = (
                "\n\nPREDICTION ANALYSIS (from multi-agent simulation):\n"
                f"{prediction.prediction_summary}\n"
                f"Key findings: {', '.join(prediction.key_findings or [])}"
            )

        prompt = PROMPTS["followup_question"]["v1"]["template"].format(
            article_title=article.title,
            article_summary=article.summary or "",
            entity_name=entity.canonical_name,
            entity_context=entity.short_context or "",
            user_question=question,
            retrieved_knowledge=(wikipedia_extract or "") + prediction_context,
        )
        answer = await self.llm.generate(prompt, effort="medium")

        return ExplainResponse(
            entity=entity_info(entity),
            explanation=answer,
            sources=[
                ContextSource(type="article", title=article.title),
                ContextSource(type="wikipedia", url=entity.wikipedia_url),
            ],
            confidence=0.85,
        )

    async def _mirofish_graph_context(self, entity: Entity) -> str:
        """Relationship context from MiroFish's knowledge graph; "" if disabled/unreachable."""
        if not await self.mirofish.health_check():
            return ""
        try:
            result = await self.mirofish.query_graph(
                project_id="global",
                query=(
                    "What are the key relationships and recent developments involving "
                    f"{entity.canonical_name}?"
                ),
            )
            return result.get("context", result.get("answer", ""))
        except Exception:
            logger.warning("MiroFish graph query failed", exc_info=True)
            return ""
