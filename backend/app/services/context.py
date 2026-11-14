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


def wikipedia_source(entity: Entity) -> ContextSource | None:
    if not entity.wikipedia_url:
        return None
    return ContextSource(type="wikipedia", title="Wikipedia", url=entity.wikipedia_url)


EXCERPT_RADIUS = 300  # characters of article text kept on each side of a mention
FOLLOWUP_ARTICLE_CHARS = 6000  # article text given to follow-up answers


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
            if "sources" in cached:
                sources = [ContextSource(**s) for s in cached["sources"]]
            else:  # cached before sources were recorded: Wikipedia is the best we know
                sources = [s for s in [wikipedia_source(entity)] if s]
            context = ContextData(
                text=cached["text"],
                generated_at=cached["generated_at"],
                cached=True,
                sources=sources,
            )
        else:
            text, sources = "", []
            if self.llm.available:
                text, sources = await self._generate_context(entity, db)
            now = datetime.now(UTC)
            if text:
                await self.cache.set(
                    self.cache_key(entity),
                    {
                        "text": text,
                        "generated_at": now.isoformat(),
                        "sources": [s.model_dump() for s in sources],
                    },
                    ttl=self.context_ttl,
                )
                context = ContextData(text=text, generated_at=now, sources=sources)
            else:
                # Claude unavailable or declined: fall back to the linker's short description
                # (a Wikipedia extract), uncached, so the real explanation appears as soon as
                # Claude is back.
                fallback = entity.short_context or ""
                context = ContextData(
                    text=fallback,
                    # Stored when the entity was linked, so that's the date it's as of.
                    generated_at=entity.created_at or now,
                    source="wikipedia_extract",
                    sources=[s for s in [wikipedia_source(entity)] if s and fallback],
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
            context=context,
            related_entities=related_entities,
            related_articles=related_articles,
        )

    async def _generate_context(
        self, entity: Entity, db: AsyncSession
    ) -> tuple[str, list[ContextSource]]:
        """Claude's explanation, and the sources it was given (only those that had content)."""
        sources: list[ContextSource] = []
        wikipedia_extract = await self.wikimedia.get_wikipedia_extract(entity.wikipedia_url or "")
        if wikipedia_extract and (wiki := wikipedia_source(entity)):
            sources.append(wiki)
        graph_context = await self._mirofish_graph_context(entity)
        if graph_context:
            sources.append(ContextSource(type="graph", title="Samā4's knowledge graph"))
        article_title, excerpt = None, None
        mention = await entity_repo.latest_mention(db, entity)
        if mention is not None:
            article, ae = mention
            article_title = article.title
            excerpt = mention_excerpt(article.cleaned_content or article.raw_content or "", ae)
            sources.insert(0, ContextSource(type="article", title=article.title, url=article.url))
        system, prompt = entity_context_prompt(
            name=entity.canonical_name,
            entity_type=entity.entity_type,
            article_title=article_title,
            article_excerpt=excerpt,
            background=wikipedia_extract,
            related_news=graph_context,
        )
        text = await self.llm.generate(prompt, effort="low", system=system)
        return text, sources

    async def answer_followup(
        self, entity: Entity, article: Article, question: str, db: AsyncSession
    ) -> ExplainResponse:
        """Answer a reader's question, grounded in what they can see.

        The prompt gets the article text and the explanation shown in the margin (the
        cached one, i.e. exactly what the reader read), plus Wikipedia and the outlook.
        The answer tags each fact with its source; `sources` lists the ones provided.
        """
        cached = await self.cache.get(self.cache_key(entity))
        explanation = (cached or {}).get("text") or entity.short_context or ""
        article_text = (article.cleaned_content or article.raw_content or article.summary or "")[
            :FOLLOWUP_ARTICLE_CHARS
        ]
        wikipedia_extract = await self.wikimedia.get_wikipedia_extract(entity.wikipedia_url or "")

        outlook_block = ""
        prediction = await prediction_repo.latest_completed_for_article(db, article.id)
        if prediction and prediction.prediction_summary:
            outlook_block = (
                "\n[outlook] Samā4's AI-GENERATED OUTLOOK (a projection, not fact):\n"
                f"{prediction.prediction_summary}\n"
            )

        prompt = PROMPTS["followup_question"]["v2"]["template"].format(
            article_title=article.title,
            article_text=article_text or "(no text)",
            entity_name=entity.canonical_name,
            explanation=explanation or "(none)",
            wikipedia=wikipedia_extract or "(none)",
            outlook_block=outlook_block,
            user_question=question,
        )
        answer = await self.llm.generate(prompt, effort="medium")

        sources = [ContextSource(type="article", title=article.title, url=article.url)]
        if explanation:
            sources.append(
                ContextSource(
                    type="explanation", title=f"Samā4's explanation of {entity.canonical_name}"
                )
            )
        if wikipedia_extract:
            sources.append(
                ContextSource(type="wikipedia", title="Wikipedia", url=entity.wikipedia_url)
            )
        if outlook_block:
            sources.append(ContextSource(type="outlook", title="Samā4's AI outlook"))

        return ExplainResponse(
            entity=entity_info(entity),
            explanation=answer,
            sources=sources,
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
