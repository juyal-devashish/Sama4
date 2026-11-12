"""Background jobs. Called by the scheduler and the admin endpoints.

Each job opens its own DB sessions and never raises: failures are logged, so a
broken job can't take down the scheduler or an admin request.
"""

import asyncio
import logging
from dataclasses import dataclass

from sqlalchemy import func, select

from app.container import Container
from app.database import async_session
from app.ingestion.ner import is_aligned, locate_mention
from app.ingestion.pipeline import IngestionPipeline
from app.ingestion.summarizer import SummarizerService
from app.models.article import Article
from app.models.entity import ArticleEntity
from app.models.prediction import Prediction
from app.repositories import articles as article_repo
from app.repositories import entities as entity_repo
from app.services.predictions import PredictionService

logger = logging.getLogger(__name__)

SUMMARY_CONCURRENCY = 5
AUTO_SIMULATIONS_PER_RUN = 5


async def run_ingestion(container: Container) -> int:
    """Fetch and process all news sources once; then auto-simulate if enabled."""
    try:
        count = await IngestionPipeline(container, async_session).run()
    except Exception:
        logger.error("Ingestion job failed", exc_info=True)
        return 0
    s = container.settings
    if s.mirofish_enabled and s.mirofish_auto_simulate:
        await auto_simulate_high_impact(container)
    return count


async def regenerate_summaries(container: Container) -> tuple[int, int]:
    """Rewrite every Article.summary with the current prompt. Returns (updated, total).

    Only the summary column changes. Articles with no text, or where Claude
    returns nothing, keep their old summary.
    """
    summarizer = SummarizerService(container.llm)
    sem = asyncio.Semaphore(SUMMARY_CONCURRENCY)
    try:
        async with async_session() as db:
            articles = await article_repo.list_all(db)

            async def redo(article: Article) -> bool:
                text = article.cleaned_content or article.raw_content or ""
                if not text:
                    return False
                async with sem:
                    new = await summarizer.summarize(text, title=article.title)
                if not new:
                    return False
                article.summary = new
                return True

            done = await asyncio.gather(*(redo(a) for a in articles), return_exceptions=True)
            await db.commit()
    except Exception:
        logger.error("Summary regeneration failed", exc_info=True)
        return 0, 0

    updated = sum(1 for d in done if d is True)
    failed = sum(1 for d in done if isinstance(d, Exception))
    logger.info(
        "Summary regeneration done: %d/%d updated, %d errors", updated, len(articles), failed
    )
    return updated, len(articles)


@dataclass
class MentionRepairReport:
    total: int = 0
    aligned: int = 0  # already correct, untouched
    relocated: int = 0  # offsets rewritten to where the text really is
    unlocatable: int = 0  # text not in the article at all
    deleted: int = 0  # unlocatable rows removed (only with delete_unlocatable)
    dry_run: bool = True


async def repair_mention_offsets(
    *, dry_run: bool = True, delete_unlocatable: bool = False
) -> MentionRepairReport | None:
    """Re-point stored ArticleEntity offsets at their text in Article.cleaned_content.

    Fixes rows written before offsets were checked. Aligned rows are left alone;
    misaligned ones are moved to the first match of mention_text. Rows whose text
    isn't in the article are only counted, unless delete_unlocatable is set.
    With dry_run (the default) nothing is written; the report says what would change.
    Returns None if the job failed (nothing is committed in that case).
    """
    report = MentionRepairReport(dry_run=dry_run)
    try:
        async with async_session() as db:
            for mention, content in await entity_repo.list_mentions_with_content(db):
                report.total += 1
                text = mention.mention_text
                if is_aligned(content, text, mention.start_position, mention.end_position):
                    report.aligned += 1
                    continue
                span = locate_mention(content, text)
                if span is None:
                    report.unlocatable += 1
                    if delete_unlocatable and not dry_run:
                        await db.delete(mention)
                        report.deleted += 1
                    continue
                report.relocated += 1
                if not dry_run:
                    mention.start_position, mention.end_position = span
            if not dry_run:
                await db.commit()
    except Exception:
        logger.error("Mention offset repair failed", exc_info=True)
        return None
    logger.info("Mention offset repair: %s", report)
    return report


async def auto_simulate_high_impact(container: Container) -> None:
    """Start MiroFish simulations for recent entity-heavy articles without a prediction."""
    s = container.settings
    service = PredictionService(
        llm=container.llm, cache=container.cache, mirofish=container.mirofish, settings=s
    )
    try:
        async with async_session() as db:
            entity_count = (
                select(func.count(ArticleEntity.id))
                .where(ArticleEntity.article_id == Article.id)
                .correlate(Article)
                .scalar_subquery()
            )
            articles = (
                (
                    await db.execute(
                        select(Article)
                        .where(
                            Article.processing_status == article_repo.STATUS_COMPLETED,
                            entity_count >= s.mirofish_impact_threshold,
                            ~Article.id.in_(select(Prediction.article_id)),
                        )
                        .order_by(Article.published_at.desc())
                        .limit(AUTO_SIMULATIONS_PER_RUN)
                    )
                )
                .scalars()
                .all()
            )
            for article in articles:
                try:
                    prediction = await service.trigger_simulation(article, db)
                    await db.commit()
                    if prediction.status == "queued":
                        await service.run_simulation_pipeline(str(prediction.id), db)
                except Exception:
                    logger.error("Auto-simulation failed for article %s", article.id, exc_info=True)
            if articles:
                logger.info("Auto-simulated %d high-impact articles", len(articles))
    except Exception:
        logger.error("Auto-simulation job failed", exc_info=True)


async def run_simulation(container: Container, prediction_id: str) -> None:
    """Run one queued prediction to completion (used by POST /predictions/simulate)."""
    service = PredictionService(
        llm=container.llm,
        cache=container.cache,
        mirofish=container.mirofish,
        settings=container.settings,
    )
    try:
        async with async_session() as db:
            await service.run_simulation_pipeline(prediction_id, db)
    except Exception:
        logger.error("Simulation %s failed", prediction_id, exc_info=True)
