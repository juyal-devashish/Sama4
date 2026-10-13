from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.prompts.templates import PROMPTS
from app.schemas.context import (
    ContextData,
    ContextResponse,
    ContextSource,
    EntityInfo,
    ExplainResponse,
    RelatedArticleBrief,
    RelatedEntity,
)
from app.services.cache_service import CacheService
from app.services.embedding_service import EmbeddingService
from app.services.entity_service import EntityService
from app.services.llm_service import LLMService
from app.services.mirofish_service import MirofishClient


class ContextService:
    """RAG pipeline orchestrator for generating entity context."""

    def __init__(self) -> None:
        self.cache = CacheService()
        self.llm = LLMService()
        self.entity_service = EntityService()
        self.embedding_service = EmbeddingService()
        self.mirofish = MirofishClient()

    async def get_context(self, entity: Entity, db: AsyncSession) -> ContextResponse:
        """Generate contextual explanation for an entity.

        Pipeline: Cache check -> Retrieve knowledge -> LLM generate -> Cache result.

        Args:
            entity: The entity to explain.
            db: Database session.

        Returns:
            ContextResponse with explanation and related items.
        """
        # 1. Check cache
        cache_key = f"context:entity:{entity.id}"
        cached = await self.cache.get(cache_key)
        if cached:
            return ContextResponse(
                entity=EntityInfo(
                    id=entity.id,
                    name=entity.canonical_name,
                    type=entity.entity_type,
                    wikidata_id=entity.wikidata_id,
                    wikipedia_url=entity.wikipedia_url,
                ),
                context=ContextData(
                    text=cached["text"],
                    generated_at=cached["generated_at"],
                    cached=True,
                ),
            )

        # 2. If entity already has pre-stored context and LLM is unavailable, use it
        if entity.short_context and not self.llm.client:
            context_text = entity.short_context
        else:
            # Retrieve knowledge from multiple sources
            wikipedia_extract = await self.entity_service.get_wikipedia_extract(
                entity.wikipedia_url or ""
            )

            # Search for related articles via embeddings
            await self.embedding_service.search(entity.canonical_name, top_k=3)

            # Try to enrich context from MiroFish GraphRAG
            mirofish_context = await self._get_mirofish_graph_context(entity)

            # Build prompt and call LLM
            prompt = PROMPTS["entity_context"]["v1"]["template"].format(
                entity_name=entity.canonical_name,
                entity_type=entity.entity_type,
                article_excerpt="",
                wikidata_facts="",
                wikipedia_excerpt=wikipedia_extract or "No Wikipedia information available.",
                related_articles_summaries=mirofish_context,
            )

            context_text = await self.llm.generate(prompt, model="gpt-4o-mini", max_tokens=300)

        # 5. Cache result
        now = datetime.now(UTC)
        await self.cache.set(
            cache_key,
            {"text": context_text, "generated_at": now.isoformat()},
            ttl=settings.entity_context_ttl,
        )

        # 6. Get related entities from same articles
        related_entities = await self._get_related_entities(entity, db)

        # 7. Get related articles via embeddings (if available)
        related_results = await self.embedding_service.search(entity.canonical_name, top_k=3)

        return ContextResponse(
            entity=EntityInfo(
                id=entity.id,
                name=entity.canonical_name,
                type=entity.entity_type,
                wikidata_id=entity.wikidata_id,
                wikipedia_url=entity.wikipedia_url,
            ),
            context=ContextData(
                text=context_text,
                generated_at=now,
                cached=False,
            ),
            related_entities=related_entities,
            related_articles=[
                RelatedArticleBrief(
                    id=r["metadata"].get("id", ""),
                    title=r["metadata"].get("title", ""),
                )
                for r in related_results
                if r.get("metadata")
            ],
        )

    async def answer_followup(
        self, entity: Entity, article: Article, question: str, db: AsyncSession
    ) -> ExplainResponse:
        """Answer a follow-up question about an entity.

        Enhanced with MiroFish prediction data when available.
        """
        # Retrieve knowledge
        wikipedia_extract = await self.entity_service.get_wikipedia_extract(
            entity.wikipedia_url or ""
        )

        # Check if there's a prediction for this article to enrich the answer
        prediction_context = ""
        try:
            from app.models.prediction import Prediction
            pred_result = await db.execute(
                select(Prediction).where(
                    Prediction.article_id == article.id,
                    Prediction.status == "completed",
                ).limit(1)
            )
            prediction = pred_result.scalar_one_or_none()
            if prediction and prediction.prediction_summary:
                prediction_context = (
                    f"\n\nPREDICTION ANALYSIS (from multi-agent simulation):\n"
                    f"{prediction.prediction_summary}\n"
                    f"Key findings: {', '.join(prediction.key_findings or [])}"
                )
        except Exception:
            pass

        prompt = PROMPTS["followup_question"]["v1"]["template"].format(
            article_title=article.title,
            article_summary=article.summary or "",
            entity_name=entity.canonical_name,
            entity_context=entity.short_context or "",
            user_question=question,
            retrieved_knowledge=(wikipedia_extract or "") + prediction_context,
        )

        answer = await self.llm.generate(
            prompt, model="gpt-4o-mini", max_tokens=500, temperature=0.4
        )

        return ExplainResponse(
            entity=EntityInfo(
                id=entity.id,
                name=entity.canonical_name,
                type=entity.entity_type,
                wikidata_id=entity.wikidata_id,
                wikipedia_url=entity.wikipedia_url,
            ),
            explanation=answer,
            sources=[
                ContextSource(type="article", title=article.title),
                ContextSource(type="wikipedia", url=entity.wikipedia_url),
            ],
            confidence=0.85,
        )

    async def _get_mirofish_graph_context(self, entity: Entity) -> str:
        """Query MiroFish's knowledge graph for richer entity context."""
        try:
            is_healthy = await self.mirofish.health_check()
            if not is_healthy:
                return ""

            # Query the graph for entity relationships and context
            result = await self.mirofish.query_graph(
                project_id="global",
                query=f"What are the key relationships and recent developments involving {entity.canonical_name}?",
            )
            return result.get("context", result.get("answer", ""))
        except Exception:
            return ""

    async def _get_related_entities(self, entity: Entity, db: AsyncSession) -> list[RelatedEntity]:
        """Find other entities that appear in the same articles."""
        # Get articles containing this entity
        article_ids_q = select(ArticleEntity.article_id).where(ArticleEntity.entity_id == entity.id)

        # Get other entities from those articles
        related_q = (
            select(Entity)
            .join(ArticleEntity, ArticleEntity.entity_id == Entity.id)
            .where(
                ArticleEntity.article_id.in_(article_ids_q),
                Entity.id != entity.id,
            )
            .distinct()
            .limit(5)
        )

        results = await db.execute(related_q)
        return [
            RelatedEntity(id=e.id, name=e.canonical_name, type=e.entity_type)
            for e in results.scalars().all()
        ]
