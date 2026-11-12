"""FastAPI entrypoint. `uvicorn app.main:app` serves `create_app()`."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import admin, articles, context, feed, predictions, search
from app.config import Settings, settings
from app.container import get_container
from app.database import create_tables

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


def _configure_logging(s: Settings) -> None:
    """Send app loggers (pipeline, scheduler, clients) to stderr at LOG_LEVEL.

    Uvicorn configures only its own loggers; without this, app INFO logs are dropped.
    """
    logging.basicConfig(
        level=s.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _init_sentry(s: Settings) -> None:
    if not s.sentry_dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=s.sentry_dsn, environment=s.environment, send_default_pii=True)
    except Exception:
        logger.warning("Sentry initialization failed", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # No Alembic migrations yet: create_all is idempotent and bootstraps a fresh
    # Postgres or SQLite. Additive model changes only; see backend/CLAUDE.md.
    await create_tables()

    container = get_container()
    scheduler = None
    if container.settings.scheduler_enabled:
        from app.ingestion.scheduler import build_scheduler

        scheduler = build_scheduler(container)
        scheduler.start()
        logger.info("Scheduler started")

    yield

    if scheduler is not None:
        scheduler.shutdown(wait=False)
    await container.aclose()


def create_app(s: Settings = settings) -> FastAPI:
    _configure_logging(s)
    _init_sentry(s)
    app = FastAPI(
        title="samā4 API",
        description="AI-powered contextual news intelligence platform",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(admin.router, prefix=f"{API_PREFIX}/admin", tags=["admin"])
    app.include_router(feed.router, prefix=f"{API_PREFIX}/feed", tags=["feed"])
    app.include_router(articles.router, prefix=f"{API_PREFIX}/articles", tags=["articles"])
    app.include_router(context.router, prefix=f"{API_PREFIX}/context", tags=["context"])
    app.include_router(search.router, prefix=f"{API_PREFIX}/search", tags=["search"])
    app.include_router(predictions.router, prefix=f"{API_PREFIX}/predictions", tags=["predictions"])

    @app.get("/health")
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
