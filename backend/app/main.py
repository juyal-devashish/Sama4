import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, articles, context, feed, predictions, search, waitlist

logger = logging.getLogger(__name__)

try:
    if settings.sentry_dsn and settings.sentry_dsn != "xxx":
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            send_default_pii=True,
        )
except Exception as e:
    logger.warning(f"Sentry initialization failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown."""

    # Create any missing tables (idempotent). There are no Alembic migrations yet,
    # so this is what bootstraps a fresh Postgres as well as local SQLite.
    from app.database import create_tables

    await create_tables()

    # Start background ingestion scheduler
    from app.ingestion.scheduler import setup_scheduler

    setup_scheduler()

    yield

    # Shutdown
    from app.ingestion.scheduler import scheduler

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="samā4 API",
    description="AI-powered contextual news intelligence platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(feed.router, prefix="/api/v1/feed", tags=["feed"])
app.include_router(articles.router, prefix="/api/v1/articles", tags=["articles"])
app.include_router(context.router, prefix="/api/v1/context", tags=["context"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"])
app.include_router(waitlist.router, prefix="/api/v1/waitlist", tags=["waitlist"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
