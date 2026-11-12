import logging

from app.services.vectors import embed_texts, get_index

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Pinecone vector store for semantic search (embeddings via Pinecone Inference)."""

    def __init__(self) -> None:
        self.index = get_index()

    async def upsert(self, id: str, text: str, metadata: dict) -> None:
        """Embed text and upsert it into Pinecone.

        Args:
            id: Unique vector ID.
            text: Text to embed.
            metadata: Metadata to store alongside the vector.
        """
        if not self.index:
            return

        [embedding] = await embed_texts([text], input_type="passage")
        if embedding is None:
            logger.warning("Skipping upsert for %s: embedding failed", id)
            return
        self.index.upsert(vectors=[(id, embedding, metadata)])

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Search for similar vectors.

        Args:
            query: Search query text.
            top_k: Number of results to return.

        Returns:
            List of matching results with metadata.
        """
        if not self.index:
            return []

        [embedding] = await embed_texts([query], input_type="query")
        if embedding is None:
            return []
        results = self.index.query(vector=embedding, top_k=top_k, include_metadata=True)

        return [
            {"id": match.id, "score": match.score, "metadata": match.metadata}
            for match in results.matches
        ]
