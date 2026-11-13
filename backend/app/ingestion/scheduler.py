"""APScheduler wiring. Started from the app lifespan when settings.scheduler_enabled."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.container import Container
from app.ingestion import jobs

logger = logging.getLogger(__name__)


def build_scheduler(container: Container) -> AsyncIOScheduler:
    """Create (not start) the scheduler with all recurring jobs."""
    s = container.settings
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        jobs.run_ingestion,
        # Once a day, at night: the app has no readers yet, so keep Claude/Pinecone spend low.
        trigger=CronTrigger(
            hour=s.ingestion_hour, minute=s.ingestion_minute, timezone=s.ingestion_timezone
        ),
        args=[container],
        id="news_ingestion",
        name="Fetch and process news articles",
        replace_existing=True,
    )
    return scheduler
