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
from app.models.entity import ArticleEntity, Entity
from app.prompts.templates import PROMPTS, entity_context_prompt
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


EXCERPT_RADIUS = 300  # characters of article text kept on each side of a mention


def mention_excerpt(text: str, mention: ArticleEntity, radius: int = EXCERPT_RADIUS) -> str | None:
    """Article text around a mention, snapped to word boundaries, with ellipses when cut."""
    if not text:
        return None
    start = max(0, mention.start_position - radius)
    end = min(len(text), mention.end_position + radius)
    if start > 0:  # move forward to the next word start, but never into the mention
        space = text.find(" ", start, mention.start_position)
        start = space + 1 if space != -1 else start
    if end < len(text):  # move back to the previous word end, but never into the mention
        space = text.rfind(" ", mention.end_position, end)
        end = space if space != -1 else end
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return prefix + text[start:end].strip() + suffix


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
        """Explain an entity.

        Only Claude's explanation is cached. Related entities (one SQL query) and related
        articles (one vector search) are looked up on every request, so a cache hit returns
        the same shape as a miss and "Also in the news" stays current.
        """
        cached = await self.cache.get(self.cache_key(entity))
        if cached:
            context = ContextData(
                text=cached["text"], generated_at=cached["generated_at"], cached=True
            )
        else:
            text = await self._generate_context(entity, db) if self.llm.available else ""
            now = datetime.now(UTC)
            if text:
                await self.cache.set(
                    self.cache_key(entity),
                    {"text": text, "generated_at": now.isoformat()},
                    ttl=self.context_ttl,
                )
            # Claude unavailable or declined: fall back to the linker's short description,
            # uncached, so the real explanation appears as soon as Claude is back.
            context = ContextData(text=text or entity.short_context or "", generated_at=now)

        related_entities = [
            RelatedEntity(id=e.id, name=e.canonical_name, type=e.entity_type)
            for e in await entity_repo.list_co_occurring(db, entity)
        ]
        related_articles = related_article_briefs(
            await self.vectors.search(entity.canonical_name, top_k=3)
        )

        return ContextResponse(
            entity=entity_info(entity),
            context=context,
            related_entities=related_entities,
            related_articles=related_articles,
        )

    async def _generate_context(self, entity: Entity, db: AsyncSession) -> str:
        wikipedia_extract = await self.wikimedia.get_wikipedia_extract(entity.wikipedia_url or "")
        graph_context = await self._mirofish_graph_context(entity)
        article_title, excerpt = None, None
        mention = await entity_repo.latest_mention(db, entity)
        if mention is not None:
            article, ae = mention
            article_title = article.title
            excerpt = mention_excerpt(article.cleaned_content or article.raw_content or "", ae)
        system, prompt = entity_context_prompt(
            name=entity.canonical_name,
            entity_type=entity.entity_type,
            article_title=article_title,
            article_excerpt=excerpt,
            background=wikipedia_extract,
            related_news=graph_context,
        )
        return await self.llm.generate(prompt, effort="low", system=system)

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
