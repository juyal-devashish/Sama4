"""APScheduler wiring. Started from the app lifespan when settings.scheduler_enabled."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.container import Container
from app.ingestion import jobs

logger = logging.getLogger(__name__)

INGESTION_INTERVAL_MINUTES = 30


def build_scheduler(container: Container) -> AsyncIOScheduler:
    """Create (not start) the scheduler with all recurring jobs."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        jobs.run_ingestion,
        trigger=IntervalTrigger(minutes=INGESTION_INTERVAL_MINUTES),
        args=[container],
        id="news_ingestion",
        name="Fetch and process news articles",
        replace_existing=True,
    )
    return scheduler
