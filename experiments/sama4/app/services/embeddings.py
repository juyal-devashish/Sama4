"""Batch embedding service — efficient article embedding via OpenAI + Pinecone.

Processes articles in batches to minimize API calls:
 - OpenAI embeddings: up to EMBED_BATCH_SIZE texts per call
 - Pinecone upserts: up to UPSERT_BATCH_SIZE vectors per call
"""

import logging
import uuid
from dataclasses import dataclass

from app.config import settings

logger = logging.getLogger(__name__)

# OpenAI allows up to 2048 inputs per embedding call; we use a safe default.
EMBED_BATCH_SIZE = 100
# Pinecone recommends upsert batches of 100 vectors.
UPSERT_BATCH_SIZE = 100


@dataclass
class ArticleEmbedInput:
    """Input for embedding a single article."""

    article_id: uuid.UUID
    title: str
    summary: str
    source: str
    categories: list[str]
    published_at: str | None = None


@dataclass
class EmbedResult:
    """Result of embedding one article."""

    article_id: uuid.UUID
    vector_id: str
    success: bool
    error: str | None = None


class BatchEmbeddingService:
    """Embeds articles in batches and upserts to Pinecone."""

    def __init__(
        self,
        openai_client=None,
        pinecone_index=None,
        embed_batch_size: int = EMBED_BATCH_SIZE,
        upsert_batch_size: int = UPSERT_BATCH_SIZE,
    ) -> None:
        self._client = openai_client
        self._index = pinecone_index
        self._embed_batch_size = embed_batch_size
        self._upsert_batch_size = upsert_batch_size
        self._init_clients()

    def _init_clients(self) -> None:
        """Lazy-init OpenAI and Pinecone if not injected."""
        if self._client is None and settings.openai_api_key:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=settings.openai_api_key)

        if self._index is None and settings.pinecone_api_key:
            try:
                from pinecone import Pinecone

                pc = Pinecone(api_key=settings.pinecone_api_key)
                self._index = pc.Index(settings.pinecone_index)
            except Exception:
                logger.warning("Pinecone init failed, upserts will be skipped")

    @property
    def available(self) -> bool:
        """True if both OpenAI and Pinecone are configured."""
        return self._client is not None and self._index is not None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    async def embed_articles(
        self, articles: list[ArticleEmbedInput]
    ) -> list[EmbedResult]:
        """Embed a list of articles and upsert vectors to Pinecone.

        Args:
            articles: Articles to embed.

        Returns:
            List of EmbedResult per article (success or error).
        """
        if not articles:
            return []

        if not self._client:
            return [
                EmbedResult(a.article_id, f"article_{a.article_id}", False, "OpenAI not configured")
                for a in articles
            ]

        # 1. Build texts to embed
        texts = [self._build_text(a) for a in articles]

        # 2. Batch embed via OpenAI
        embeddings = await self._batch_embed(texts)

        # 3. Build vectors with metadata
        vectors = []
        results: list[EmbedResult] = []

        for article, embedding in zip(articles, embeddings):
            vector_id = f"article_{article.article_id}"

            if embedding is None:
                results.append(EmbedResult(article.article_id, vector_id, False, "embedding failed"))
                continue

            metadata = {
                "title": article.title,
                "summary": article.summary,
                "source": article.source,
                "categories": article.categories,
                "published_at": article.published_at or "",
            }
            vectors.append((vector_id, embedding, metadata))
            results.append(EmbedResult(article.article_id, vector_id, True))

        # 4. Batch upsert to Pinecone
        failed_ids = await self._batch_upsert(vectors)
        for result in results:
            if result.vector_id in failed_ids:
                result.success = False
                result.error = "Pinecone upsert failed"

        logger.info(
            "Embedded %d/%d articles successfully",
            sum(1 for r in results if r.success),
            len(articles),
        )
        return results

    async def embed_single(self, article: ArticleEmbedInput) -> EmbedResult:
        """Convenience wrapper for embedding a single article."""
        results = await self.embed_articles([article])
        return results[0]

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Semantic search over embedded articles.

        Args:
            query: Search query text.
            top_k: Number of results.

        Returns:
            List of matches with id, score, and metadata.
        """
        if not self._client or not self._index:
            return []

        embeddings = await self._batch_embed([query])
        if not embeddings or embeddings[0] is None:
            return []

        results = self._index.query(
            vector=embeddings[0], top_k=top_k, include_metadata=True
        )

        return [
            {"id": m.id, "score": m.score, "metadata": m.metadata}
            for m in results.matches
        ]

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    @staticmethod
    def _build_text(article: ArticleEmbedInput) -> str:
        """Combine title + summary into embeddable text."""
        return f"{article.title}. {article.summary}"

    async def _batch_embed(self, texts: list[str]) -> list[list[float] | None]:
        """Generate embeddings in batches via OpenAI API.

        Returns one embedding per input text (or None on error).
        """
        all_embeddings: list[list[float] | None] = [None] * len(texts)

        for start in range(0, len(texts), self._embed_batch_size):
            chunk = texts[start : start + self._embed_batch_size]
            try:
                response = await self._client.embeddings.create(
                    model="text-embedding-3-small",
                    input=chunk,
                )
                for item in response.data:
                    all_embeddings[start + item.index] = item.embedding
            except Exception:
                logger.error(
                    "OpenAI embedding batch failed (offset %d, size %d)",
                    start, len(chunk), exc_info=True,
                )
                # Leave these as None — they'll be marked as failed

        return all_embeddings

    async def _batch_upsert(
        self, vectors: list[tuple[str, list[float], dict]]
    ) -> set[str]:
        """Upsert vectors to Pinecone in batches.

        Returns set of vector IDs that failed to upsert.
        """
        if not self._index or not vectors:
            return set()

        failed: set[str] = set()

        for start in range(0, len(vectors), self._upsert_batch_size):
            chunk = vectors[start : start + self._upsert_batch_size]
            try:
                self._index.upsert(vectors=chunk)
            except Exception:
                logger.error(
                    "Pinecone upsert batch failed (offset %d, size %d)",
                    start, len(chunk), exc_info=True,
                )
                failed.update(vid for vid, _, _ in chunk)

        return failed
