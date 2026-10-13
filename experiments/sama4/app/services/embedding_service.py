import logging

from app.config import settings
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Pinecone vector store for semantic search."""

    def __init__(self) -> None:
        self.llm = LLMService()
        self.pc = None
        self.index = None
        if settings.pinecone_api_key:
            try:
                from pinecone import Pinecone

                self.pc = Pinecone(api_key=settings.pinecone_api_key)
                self.index = self.pc.Index(settings.pinecone_index)
            except Exception:
                logger.warning("Pinecone not available, embedding search disabled")

    async def upsert(self, id: str, text: str, metadata: dict) -> None:
        """Generate embedding and upsert into Pinecone.

        Args:
            id: Unique vector ID.
            text: Text to embed.
            metadata: Metadata to store alongside the vector.
        """
        if not self.index:
            return

        embedding = await self.llm.generate_embedding(text)
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

        embedding = await self.llm.generate_embedding(query)
        results = self.index.query(vector=embedding, top_k=top_k, include_metadata=True)

        return [
            {"id": match.id, "score": match.score, "metadata": match.metadata}
            for match in results.matches
        ]
