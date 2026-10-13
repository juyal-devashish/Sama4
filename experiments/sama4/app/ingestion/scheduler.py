import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.ingestion.pipeline import IngestionPipeline

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_ingestion_pipeline() -> None:
    """Run the news ingestion pipeline."""
    logger.info("Scheduled ingestion pipeline starting")
    pipeline = IngestionPipeline()
    count = await pipeline.run()
    logger.info(f"Scheduled ingestion complete: {count} articles processed")

    # Auto-trigger predictions for high-impact articles
    if settings.mirofish_enabled and settings.mirofish_auto_simulate:
        await _auto_simulate_high_impact()


async def _auto_simulate_high_impact() -> None:
    """Trigger MiroFish simulations for high-impact articles that don't have predictions yet."""
    from sqlalchemy import func, select

    from app.database import async_session
    from app.models.article import Article
    from app.models.entity import ArticleEntity
    from app.models.prediction import Prediction
    from app.services.prediction_service import PredictionService

    try:
        async with async_session() as db:
            # Find completed articles with many entities but no prediction
            entity_count = (
                select(func.count(ArticleEntity.id))
                .where(ArticleEntity.article_id == Article.id)
                .correlate(Article)
                .scalar_subquery()
            )

            articles_q = (
                select(Article)
                .where(
                    Article.processing_status == "completed",
                    entity_count >= settings.mirofish_impact_threshold,
                    ~Article.id.in_(
                        select(Prediction.article_id)
                    ),
                )
                .order_by(Article.published_at.desc())
                .limit(5)  # max 5 auto-simulations per cycle
            )

            result = await db.execute(articles_q)
            articles = result.scalars().all()

            if not articles:
                return

            service = PredictionService()
            for article in articles:
                try:
                    prediction = await service.trigger_simulation(article, db)
                    await db.commit()
                    if prediction.status == "queued":
                        await service.run_simulation_pipeline(str(prediction.id), db)
                except Exception:
                    logger.error("Auto-simulation failed for article %s", article.id, exc_info=True)

            logger.info("Auto-simulated %d high-impact articles", len(articles))

    except Exception:
        logger.error("Auto-simulation job failed", exc_info=True)


async def cleanup_old_articles() -> None:
    """Remove articles older than 30 days."""
    # TODO: Implement cleanup logic
    logger.info("Running article cleanup job")


def setup_scheduler() -> None:
    """Configure and start the scheduler."""
    # Main ingestion job - every 30 minutes
    scheduler.add_job(
        run_ingestion_pipeline,
        trigger=IntervalTrigger(minutes=30),
        id="news_ingestion",
        name="Fetch and process news articles",
        replace_existing=True,
    )

    # Cleanup job - daily at 3 AM
    scheduler.add_job(
        cleanup_old_articles,
        trigger=CronTrigger(hour=3, minute=0),
        id="cleanup",
        name="Remove articles older than 30 days",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started")
