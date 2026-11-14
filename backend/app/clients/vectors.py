"""Pinecone: vector index + hosted embeddings (Pinecone Inference).

Claude has no embeddings endpoint, so embeddings come from Pinecone Inference
(`embed_model`, default llama-text-embed-v2, 1024-d) using the same Pinecone key.
The index is created on first use if it does not exist.

Vector ids are "article_<uuid>". The article uuid is NOT stored in metadata;
use `article_id_from_vector_id` to recover it.
"""

import asyncio
import logging
import uuid
from typing import Any, Literal

logger = logging.getLogger(__name__)

InputType = Literal["passage", "query"]

# Pinecone Inference accepts up to 96 inputs per embed call.
EMBED_BATCH_SIZE = 96
VECTOR_ID_PREFIX = "article_"


def vector_id_for_article(article_id: uuid.UUID | str) -> str:
    return f"{VECTOR_ID_PREFIX}{article_id}"


def article_id_from_vector_id(vector_id: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(vector_id).removeprefix(VECTOR_ID_PREFIX))
    except ValueError:
        return None


class VectorStore:
    """Embeds text and reads/writes the article vector index."""

    def __init__(
        self,
        api_key: str,
        index_name: str,
        region: str,
        embed_model: str,
        dimension: int,
    ) -> None:
        self.index_name = index_name
        self.region = region
        self.embed_model = embed_model
        self.dimension = dimension
        self._pc = None
        self._index = None
        self._index_failed = False
        if api_key:
            from pinecone import Pinecone

            self._pc = Pinecone(api_key=api_key)

    @property
    def available(self) -> bool:
        return self._pc is not None

    # -- index -----------------------------------------------------------------

    def _get_index(self) -> Any | None:
        """Return the index, creating it if missing. None if unavailable."""
        if self._pc is None or self._index_failed:
            return None
        if self._index is not None:
            return self._index
        try:
            if not self._pc.has_index(self.index_name):
                from pinecone import ServerlessSpec

                logger.info("Creating Pinecone index %s (%d-d)", self.index_name, self.dimension)
                self._pc.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region=self.region),
                )
            self._index = self._pc.Index(self.index_name)
        except Exception:
            self._index_failed = True
            logger.warning("Pinecone index unavailable, vector features disabled", exc_info=True)
        return self._index

    # -- embeddings ------------------------------------------------------------

    def _embed_sync(self, texts: list[str], input_type: InputType) -> list[list[float] | None]:
        out: list[list[float] | None] = [None] * len(texts)
        if self._pc is None:
            return out
        for start in range(0, len(texts), EMBED_BATCH_SIZE):
            chunk = texts[start : start + EMBED_BATCH_SIZE]
            try:
                res = self._pc.inference.embed(
                    model=self.embed_model,
                    inputs=chunk,
                    parameters={"input_type": input_type, "truncate": "END"},
                )
                for i, item in enumerate(res.data):
                    out[start + i] = list(item.values)
            except Exception:
                logger.error(
                    "Pinecone embed batch failed (offset %d, size %d)",
                    start,
                    len(chunk),
                    exc_info=True,
                )
        return out

    async def embed(
        self, texts: list[str], input_type: InputType = "passage"
    ) -> list[list[float] | None]:
        """Embed texts ("passage" for documents, "query" for searches).

        Returns one vector per input, None where embedding failed.
        """
        if not texts:
            return []
        return await asyncio.to_thread(self._embed_sync, texts, input_type)

    # -- articles --------------------------------------------------------------

    async def upsert_article(
        self,
        article_id: uuid.UUID | str,
        title: str,
        summary: str,
        source: str,
        categories: list[str],
        published_at: str | None,
    ) -> bool:
        """Embed "title. summary" and upsert it. Returns True on success."""
        index = await asyncio.to_thread(self._get_index)
        if index is None:
            return False
        [vector] = await self.embed([f"{title}. {summary}"], input_type="passage")
        if vector is None:
            logger.warning("Skipping upsert for article %s: embedding failed", article_id)
            return False
        metadata = {
            "title": title,
            "summary": summary,
            "source": source,
            "categories": categories,
            "published_at": published_at or "",
        }
        await asyncio.to_thread(
            index.upsert, vectors=[(vector_id_for_article(article_id), vector, metadata)]
        )
        return True

    async def delete_articles(self, article_ids: list[uuid.UUID]) -> bool:
        """Remove articles' vectors. Returns False if Pinecone is unavailable or fails."""
        if not article_ids:
            return True
        index = await asyncio.to_thread(self._get_index)
        if index is None:
            return False
        try:
            await asyncio.to_thread(
                index.delete, ids=[vector_id_for_article(a) for a in article_ids]
            )
        except Exception:
            logger.error("Pinecone delete failed for %d articles", len(article_ids), exc_info=True)
            return False
        return True

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Semantic search. Returns [{"id", "score", "metadata"}, ...]; [] if unavailable."""
        index = await asyncio.to_thread(self._get_index)
        if index is None:
            return []
        [vector] = await self.embed([query], input_type="query")
        if vector is None:
            return []
        results = await asyncio.to_thread(
            index.query, vector=vector, top_k=top_k, include_metadata=True
        )
        return [{"id": m.id, "score": m.score, "metadata": m.metadata} for m in results.matches]
