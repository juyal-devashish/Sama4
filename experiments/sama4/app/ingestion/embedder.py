import logging

from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class ArticleEmbedder:
    """Generates and stores article embeddings in Pinecone."""

    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()

    async def embed_article(
        self,
        article_id: str,
        title: str,
        summary: str,
        categories: list[str],
        source: str,
        published_at: str | None,
    ) -> None:
        """Generate embedding for an article and store in Pinecone.

        Args:
            article_id: Article UUID string.
            title: Article title.
            summary: Article summary.
            categories: Article categories.
            source: Source name.
            published_at: Publication timestamp ISO string.
        """
        text_to_embed = f"{title}. {summary}"

        await self.embedding_service.upsert(
            id=f"article_{article_id}",
            text=text_to_embed,
            metadata={
                "title": title,
                "source": source,
                "categories": categories,
                "published_at": published_at or "",
                "summary": summary,
            },
        )

        logger.info(f"Embedded article: {article_id}")
