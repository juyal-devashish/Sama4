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
from app.ingestion.blocklist import is_blocked, parse_domains
from app.ingestion.ner import is_aligned, locate_mention
from app.ingestion.pipeline import IngestionPipeline
from app.ingestion.summarizer import SummarizerService
from app.models.article import Article
from app.models.entity import ArticleEntity
from app.models.prediction import RUNNING_STATUSES, STATUS_FAILED, STATUS_QUEUED, Prediction
from app.repositories import articles as article_repo
from app.repositories import entities as entity_repo
from app.services.predictions import PredictionService

logger = logging.getLogger(__name__)

SUMMARY_CONCURRENCY = 5
AUTO_SIMULATIONS_PER_RUN = 5


async def run_ingestion(container: Container) -> int:
    """Fetch and process all news sources once; then auto-simulate if enabled."""
    try:
        s = container.settings
        count = await IngestionPipeline(
            container,
            async_session,
            max_stories=s.ingestion_max_stories,
            target_stories=s.ingestion_target_stories,
            window_hours=s.ingestion_window_hours,
        ).run()
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
class EnrichReport:
    total: int = 0
    updated: int = 0  # new excerpt, terms and summary (and image if missing)
    image_only: int = 0  # only the lead image changed
    unchanged: int = 0  # page unreachable, or nothing better on it
    failed: int = 0


# Fewer words than this means we only hold the feed's teaser, not the page's opening.
TEASER_WORDS = 120


def needs_enrichment(article: Article) -> bool:
    words = len((article.cleaned_content or "").split())
    return not article.image_url or words < TEASER_WORDS


async def enrich_articles(
    container: Container, limit: int = 100, *, only_unfinished: bool = False
) -> EnrichReport:
    """Backfill the newest `limit` articles from their pages (image, excerpt, terms,
    summary). Each article commits on its own, so one failure doesn't undo the rest.

    `only_unfinished` skips stories that already have an image and an excerpt (the
    startup backfill), so a redeploy doesn't redo finished work."""
    report = EnrichReport()
    pipeline = IngestionPipeline(container, async_session)
    try:
        async with async_session() as db:
            rows = await article_repo.list_recent_with_source(db, limit)
            if only_unfinished:
                rows = [(a, src) for a, src in rows if needs_enrichment(a)]
            report.total = len(rows)
            for article, source in rows:
                try:
                    outcome = await pipeline.enrich(article, source, db)
                    await db.commit()
                except Exception:
                    logger.error("Enrich failed for %s", article.url, exc_info=True)
                    await db.rollback()
                    report.failed += 1
                    continue
                if outcome == "updated":
                    report.updated += 1
                elif outcome == "image":
                    report.image_only += 1
                else:
                    report.unchanged += 1
    except Exception:
        logger.error("Article enrichment failed", exc_info=True)
    logger.info("Article enrichment done: %s", report)
    return report


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
                    if prediction.status == STATUS_QUEUED:
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


async def fail_interrupted_predictions() -> int:
    """At startup, fail every prediction left "running" by the previous process.

    Simulations run as in-process background tasks, so none can still be running
    when the API starts. Without this they stay "running" forever: the reader sees
    a spinner and "Run outlook" can't start a new one. Never raises.
    """
    try:
        async with async_session() as db:
            stuck = (
                (
                    await db.execute(
                        select(Prediction).where(Prediction.status.in_(RUNNING_STATUSES))
                    )
                )
                .scalars()
                .all()
            )
            for prediction in stuck:
                prediction.status = STATUS_FAILED
                prediction.error_message = "Interrupted by a server restart."
            await db.commit()
        if stuck:
            logger.warning("Marked %d interrupted prediction(s) as failed", len(stuck))
        return len(stuck)
    except Exception:
        logger.error("Could not clean up interrupted predictions", exc_info=True)
        return 0


@dataclass
class PurgeReport:
    domain: str
    matched: int = 0
    deleted: int = 0
    vectors_deleted: bool = False
    sample_titles: list[str] | None = None
    dry_run: bool = True


async def purge_publisher(
    container: Container, domain: str, *, dry_run: bool = True
) -> PurgeReport | None:
    """Delete every stored story from `domain` (and its subdomains), with its vectors.

    For publisher opt-outs: add the domain to BLOCKED_PUBLISHERS so nothing new comes in,
    then run this. Dry run by default (reports what would go). None on failure.
    """
    domains = parse_domains(domain)
    if len(domains) != 1:
        return None
    [clean] = domains
    report = PurgeReport(domain=clean, dry_run=dry_run)
    try:
        async with async_session() as db:
            candidates = await article_repo.list_with_url_containing(db, clean)
            matches = [a for a in candidates if is_blocked(a.url, domains)]
            report.matched = len(matches)
            report.sample_titles = [a.title for a in matches[:20]]
            if dry_run or not matches:
                return report
            ids = [a.id for a in matches]
            report.deleted = await article_repo.delete_many(db, ids)
            await db.commit()
        report.vectors_deleted = await container.vectors.delete_articles(ids)
        logger.info("Purged %d stories from %s", report.deleted, clean)
        return report
    except Exception:
        logger.error("Publisher purge failed for %s", clean, exc_info=True)
        return None
