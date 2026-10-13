"""Re-summarize articles that have placeholder summaries."""

import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

PLACEHOLDER = "(LLM unavailable"


async def main() -> None:
    from sqlalchemy import select

    from app.database import async_session
    from app.ingestion.summarizer import SummarizerService
    from app.models.article import Article

    summarizer = SummarizerService()

    async with async_session() as db:
        # Find articles with placeholder summaries
        result = await db.execute(select(Article).where(Article.summary.like(f"{PLACEHOLDER}%")))
        articles = result.scalars().all()
        total = len(articles)
        logger.info(f"Found {total} articles to re-summarize")

        for i, article in enumerate(articles, 1):
            text = article.cleaned_content or article.raw_content
            if not text:
                logger.warning(f"[{i}/{total}] Skipping {article.title[:50]} — no content")
                continue

            try:
                summary = await summarizer.summarize(text)
                article.summary = summary
                logger.info(f"[{i}/{total}] {article.title[:60]}...")
            except Exception:
                logger.error(f"[{i}/{total}] Failed: {article.title[:50]}", exc_info=True)

            # Commit in batches of 10
            if i % 10 == 0:
                await db.commit()
                logger.info(f"  Committed batch ({i}/{total})")

        await db.commit()
        logger.info(f"Done. Re-summarized {total} articles.")


if __name__ == "__main__":
    asyncio.run(main())
