"""Pinecone index + hosted embeddings, shared by every embedding code path.

Embeddings used to come from OpenAI text-embedding-3-small (1536-d). Claude has
no embeddings endpoint, so we use Pinecone Inference instead. It needs only the
Pinecone key we already have, and the model is set by settings.pinecone_embed_model
(llama-text-embed-v2, 1024-d). The dimension differs from the old index, so a
new index name is used, and it is created automatically on first use if missing.
"""

import asyncio
import logging
from functools import lru_cache

from app.config import settings

logger = logging.getLogger(__name__)

# Pinecone Inference accepts up to 96 inputs per embed call.
EMBED_BATCH_SIZE = 96


@lru_cache(maxsize=1)
def _client():
    if not settings.pinecone_api_key:
        return None
    from pinecone import Pinecone

    return Pinecone(api_key=settings.pinecone_api_key)


@lru_cache(maxsize=1)
def get_index():
    """Return the Pinecone index, creating it if it does not exist. None if unavailable."""
    pc = _client()
    if pc is None:
        return None
    try:
        name = settings.pinecone_index
        if not pc.has_index(name):
            from pinecone import ServerlessSpec

            logger.info("Creating Pinecone index %s (%d-d)", name, settings.pinecone_embed_dim)
            pc.create_index(
                name=name,
                dimension=settings.pinecone_embed_dim,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region=settings.pinecone_environment),
            )
        return pc.Index(name)
    except Exception:
        logger.warning("Pinecone index unavailable, vector features disabled", exc_info=True)
        return None


def _embed_sync(texts: list[str], input_type: str) -> list[list[float] | None]:
    pc = _client()
    out: list[list[float] | None] = [None] * len(texts)
    if pc is None:
        return out
    for start in range(0, len(texts), EMBED_BATCH_SIZE):
        chunk = texts[start : start + EMBED_BATCH_SIZE]
        try:
            res = pc.inference.embed(
                model=settings.pinecone_embed_model,
                inputs=chunk,
                parameters={"input_type": input_type, "truncate": "END"},
            )
            for i, item in enumerate(res.data):
                out[start + i] = list(item.values)
        except Exception:
            logger.error(
                "Pinecone embed batch failed (offset %d, size %d)", start, len(chunk), exc_info=True
            )
    return out


async def embed_texts(texts: list[str], input_type: str = "passage") -> list[list[float] | None]:
    """Embed texts; input_type is "passage" for documents, "query" for searches.

    Returns one vector per input (None where embedding failed).
    """
    if not texts:
        return []
    return await asyncio.to_thread(_embed_sync, texts, input_type)
