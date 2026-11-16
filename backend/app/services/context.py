"""Entity context (the core feature): explain an entity, answer follow-up questions.

Pipeline for GET /context/{entity_id}:
    cache -> Wikipedia extract + MiroFish graph (if enabled) -> Claude -> cache
plus related entities (SQL) and related articles (Pinecone search).
"""

import asyncio
import hashlib
import json
import logging
import uuid
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.cache import Cache
from app.clients.llm import LLMClient, StreamEnd
from app.clients.mirofish import MirofishClient
from app.clients.usage import DailyBudgetExceeded
from app.clients.vectors import VectorStore, article_id_from_vector_id
from app.clients.wikimedia import WikimediaClient
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.prompts.templates import entity_context_prompt, followup_prompt, selection_prompt
from app.repositories import entities as entity_repo
from app.repositories import explanations as explanation_repo
from app.repositories import predictions as prediction_repo
from app.schemas.context import (
    ContextData,
    ContextResponse,
    ContextSource,
    EntityInfo,
    ExplainResponse,
    MoreDetailResponse,
    RelatedArticleBrief,
    RelatedEntity,
    SelectionResponse,
)
from app.text import cap_words as _cap_words

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


class SelectionNotInArticleError(ValueError):
    """The selected text isn't in the story it was sent with."""


SELECTION_EXCERPT_RADIUS = 450


def squash(text: str) -> str:
    """Collapse all whitespace runs to single spaces."""
    return " ".join(text.split())


BRIEF_MAX_WORDS = 60  # the explanation shown beside the story
MORE_MAX_WORDS = 170  # the fuller one behind "More detail"


def cap_words(text: str, max_words: int) -> str:
    """Shorten text to at most `max_words`, ending at a sentence if one fits, else with …

    The prompts ask for this length; this makes it a guarantee. A sentence end counts only
    in the second half of the cut, and abbreviations such as "U.S." are not sentence ends.
    """
    return _cap_words(text, max_words, min_ratio=0.5)


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
    def cache_key(entity: Entity, article_id: uuid.UUID | None = None) -> str:
        """One explanation per term and story (the story decides *why it matters*); with no
        story, one per term."""
        base = f"context:entity:{entity.id}"
        return f"{base}:article:{article_id}" if article_id else base

    async def _story_for(
        self, entity: Entity, db: AsyncSession, article_id: uuid.UUID | None
    ) -> uuid.UUID | None:
        """`article_id` if the term really appears in that story, else None (the term-level
        explanation). Stops arbitrary ids from minting cache entries."""
        if article_id is None:
            return None
        return article_id if await entity_repo.mention_in_article(db, entity, article_id) else None

    async def stream_context(
        self, entity: Entity, db: AsyncSession, article_id: uuid.UUID | None = None
    ) -> AsyncIterator[tuple[str, str | ContextResponse]]:
        """`get_context`, but the explanation's text arrives as it is written.

        Yields ("delta", text) for each piece Claude writes, then one ("done",
        ContextResponse): the same response `get_context` returns, with the final, capped
        text. A cached explanation yields only "done". Everything else (caching, recording,
        the Wikipedia fallback, the daily cap) is `get_context` itself, so the two can't drift.
        """
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        task = asyncio.ensure_future(
            self.get_context(entity, db, article_id, on_delta=queue.put_nowait)
        )
        task.add_done_callback(lambda _t: queue.put_nowait(None))
        try:
            while (chunk := await queue.get()) is not None:
                yield "delta", chunk
            yield "done", task.result()
        finally:
            if not task.done():  # the reader went away: stop paying for the answer
                task.cancel()

    async def get_context(
        self,
        entity: Entity,
        db: AsyncSession,
        article_id: uuid.UUID | None = None,
        on_delta: Callable[[str], None] | None = None,
    ) -> ContextResponse:
        """Explain an entity, written for the story it was opened from when one is given.

        `on_delta` receives the text as Claude writes it (see `stream_context`).

        Only Claude's explanation is cached. Related entities (one SQL query) and related
        articles (one vector search) are looked up on every request, so a cache hit returns
        the same shape as a miss and "Also in the news" stays current.
        """
        article_id = await self._story_for(entity, db, article_id)
        key = self.cache_key(entity, article_id)
        cached = await self.cache.get(key)
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
                try:
                    text, sources = await self._generate_context(entity, db, article_id, on_delta)
                except DailyBudgetExceeded:
                    pass  # over today's budget: fall back to the Wikipedia extract below
            now = datetime.now(UTC)
            if text:
                await self.cache.set(
                    key,
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
        self,
        entity: Entity,
        db: AsyncSession,
        article_id: uuid.UUID | None = None,
        on_delta: Callable[[str], None] | None = None,
    ) -> tuple[str, list[ContextSource]]:
        """Claude's explanation, and the sources it was given (only those that had content).

        Each explanation written is also recorded with the story and Wikipedia revision used.
        """
        sources: list[ContextSource] = []
        wiki_page = await self.wikimedia.get_wikipedia_page(entity.wikipedia_url or "")
        wikipedia_extract = wiki_page.extract if wiki_page else None
        if wiki_page and (wiki := wikipedia_source(entity)):
            wiki.revision_url = wiki_page.revision_url
            sources.append(wiki)
        graph_context = await self._mirofish_graph_context(entity)
        if graph_context:
            sources.append(ContextSource(type="graph", title="Samā4's knowledge graph"))
        article_title, excerpt, written_for = None, None, None
        mention = (
            await entity_repo.mention_in_article(db, entity, article_id)
            if article_id
            else await entity_repo.latest_mention(db, entity)
        )
        if mention is not None:
            article, ae = mention
            written_for = article.id
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
        if on_delta is None:
            raw = await self.llm.generate(prompt, effort="low", system=system)
        else:
            raw = ""
            async for item in self.llm.stream(prompt, effort="low", system=system):
                if isinstance(item, StreamEnd):
                    raw = item.text
                else:
                    on_delta(item)
        text = cap_words(raw, BRIEF_MAX_WORDS)
        if text:
            await explanation_repo.add(
                db,
                entity_id=entity.id,
                article_id=written_for,
                wikipedia_title=wiki_page.title if wiki_page else None,
                wikipedia_revision_id=wiki_page.revision_id if wiki_page else None,
                text=text,
                model=getattr(self.llm, "model", None),
            )
        return text, sources

    async def answer_followup(
        self, entity: Entity, article: Article, question: str, db: AsyncSession
    ) -> ExplainResponse:
        """Answer a reader's question, grounded in what they can see.

        The prompt gets the article text and the explanation shown in the margin (the
        cached one, i.e. exactly what the reader read), plus Wikipedia and the outlook.
        The answer tags each fact with its source; `sources` lists the ones provided.
        """
        # What the reader read: the explanation written for this story, else the term-level one.
        cached = await self.cache.get(self.cache_key(entity, article.id)) or await self.cache.get(
            self.cache_key(entity)
        )
        explanation = (cached or {}).get("text") or entity.short_context or ""
        article_text = (article.cleaned_content or article.raw_content or article.summary or "")[
            :FOLLOWUP_ARTICLE_CHARS
        ]
        wikipedia_extract = await self.wikimedia.get_wikipedia_extract(entity.wikipedia_url or "")

        outlook_text = ""
        prediction = await prediction_repo.latest_completed_for_article(db, article.id)
        if prediction and prediction.prediction_summary:
            outlook_text = prediction.prediction_summary

        system, prompt = followup_prompt(
            article_title=article.title,
            article_text=article_text or "(no text)",
            entity_name=entity.canonical_name,
            explanation=explanation or "(none)",
            wikipedia=wikipedia_extract or "(none)",
            outlook=outlook_text,
            question=question,
        )
        answer = await self.llm.generate(prompt, effort="medium", system=system)

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
        if outlook_text:
            sources.append(ContextSource(type="outlook", title="Samā4's AI outlook"))

        return ExplainResponse(
            entity=entity_info(entity),
            explanation=answer,
            sources=sources,
            confidence=0.85,
        )

    async def get_more_detail(
        self, entity: Entity, db: AsyncSession, article_id: uuid.UUID | None = None
    ) -> MoreDetailResponse:
        """A fuller explanation (about 150 words) for readers who want depth.

        Built from the same story passage and a longer Wikipedia intro. Cached per entity;
        "" when Claude is unavailable, so the panel can offer a retry.
        """
        article_id = await self._story_for(entity, db, article_id)
        key = self.cache_key(entity, article_id).replace("context:entity:", "context:entity-more:")
        cached = await self.cache.get(key)
        if cached:
            return MoreDetailResponse(**cached, cached=True)
        text = ""
        if self.llm.available:
            wiki_page = await self.wikimedia.get_wikipedia_page(
                entity.wikipedia_url or "", sentences=6
            )
            article_title, excerpt = None, None
            mention = (
                await entity_repo.mention_in_article(db, entity, article_id)
                if article_id
                else await entity_repo.latest_mention(db, entity)
            )
            if mention is not None:
                article, ae = mention
                article_title = article.title
                excerpt = mention_excerpt(article.cleaned_content or article.raw_content or "", ae)
            system, prompt = entity_context_prompt(
                name=entity.canonical_name,
                entity_type=entity.entity_type,
                article_title=article_title,
                article_excerpt=excerpt,
                background=wiki_page.extract if wiki_page else None,
                more=True,
            )
            text = cap_words(
                await self.llm.generate(prompt, effort="low", system=system), MORE_MAX_WORDS
            )
        result = MoreDetailResponse(text=text, generated_at=datetime.now(UTC))
        if text:
            await self.cache.set(
                key, result.model_dump(mode="json", exclude={"cached"}), ttl=self.context_ttl
            )
        return result

    async def explain_selection(self, article: Article, raw_text: str) -> SelectionResponse:
        """Explain text a reader selected in a story.

        The text must really be in the story (so this can't be used as a general question
        box). Claude gets the passage around it and, if Wikipedia has a likely match, that
        extract as background it may ignore. If nothing reliable can be said, the answer is
        `reliable=False` with no text, never a guess. Results are cached per story and text.
        """
        text = squash(raw_text)
        story = squash(
            " ".join(
                filter(
                    None,
                    [
                        article.title,
                        article.summary,
                        article.cleaned_content or article.raw_content,
                    ],
                )
            )
        )
        at = story.lower().find(text.lower())
        if at == -1:
            raise SelectionNotInArticleError(text)

        key = (
            "context:selection:" + hashlib.sha1(f"{article.id}:{text.lower()}".encode()).hexdigest()
        )
        cached = await self.cache.get(key)
        if cached:
            return SelectionResponse(**cached, cached=True)

        start, end = (
            max(0, at - SELECTION_EXCERPT_RADIUS),
            at + len(text) + SELECTION_EXCERPT_RADIUS,
        )
        excerpt = story[start:end]
        background, wiki_url = None, None
        try:
            wikidata_id = await self.wikimedia.search_wikidata(text)
            wiki_url = await self.wikimedia.get_wikipedia_url(wikidata_id) if wikidata_id else None
            background = await self.wikimedia.get_wikipedia_extract(wiki_url or "")
        except Exception:
            logger.warning("Wikipedia lookup failed for a selection", exc_info=True)
        system, prompt = selection_prompt(
            text=text,
            article_title=article.title,
            article_excerpt=("…" if start else "") + excerpt + ("…" if end < len(story) else ""),
            background=background,
        )
        raw = await self.llm.generate(prompt, effort="low", system=system)
        explanation, reliable, used_background = "", False, False
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
            verdict = json.loads(cleaned.strip())
            explanation = str(verdict.get("explanation") or "").strip()
            reliable = verdict.get("reliable") is True and bool(explanation)
            used_background = verdict.get("used_background") is True
        except Exception:
            logger.warning("Unreadable selection answer; treating it as unreliable", exc_info=True)
        if not reliable:
            explanation = ""

        sources = [ContextSource(type="article", title=article.title, url=article.url)]
        if reliable and used_background and wiki_url:
            sources.append(ContextSource(type="wikipedia", title="Wikipedia", url=wiki_url))
        result = SelectionResponse(
            text=text,
            explanation=explanation,
            reliable=reliable,
            generated_at=datetime.now(UTC),
            sources=sources,
        )
        await self.cache.set(
            key, result.model_dump(mode="json", exclude={"cached"}), ttl=self.context_ttl
        )
        return result

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
