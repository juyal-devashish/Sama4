"""FastAPI entrypoint. `uvicorn app.main:app` serves `create_app()`."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routers import admin, articles, context, feed, predictions, search, sources, waitlist
from app.clients.usage import DailyBudgetExceeded
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


_IP_HEADERS = {
    "x-forwarded-for",
    "x-real-ip",
    "x-vercel-forwarded-for",
    "x-envoy-external-address",
    "forwarded",
    "cf-connecting-ip",
    "true-client-ip",
}


def scrub_sentry_event(event: dict[str, Any], hint: Any = None) -> dict[str, Any]:
    """Strip anything that identifies the reader's address before an event leaves.

    `send_default_pii=False` already keeps cookies, the user's IP and the socket address
    out, but proxies add the visitor's IP as forwarding headers; drop those too.
    """
    request = event.get("request")
    if isinstance(request, dict):
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {k: v for k, v in headers.items() if k.lower() not in _IP_HEADERS}
        request.pop("env", None)
        request.pop("cookies", None)
    user = event.get("user")
    if isinstance(user, dict):
        user.pop("ip_address", None)
    return event


def _init_sentry(s: Settings) -> None:
    if not s.sentry_dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=s.sentry_dsn,
            environment=s.environment,
            send_default_pii=False,
            before_send=scrub_sentry_event,
        )
    except Exception:
        logger.warning("Sentry initialization failed", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # No Alembic migrations yet: create_all is idempotent and bootstraps a fresh
    # Postgres or SQLite. Additive model changes only; see backend/CLAUDE.md.
    await create_tables()

    from app.ingestion.jobs import fail_interrupted_predictions

    await fail_interrupted_predictions()

    container = get_container()
    scheduler = None
    if container.settings.scheduler_enabled:
        from app.ingestion.scheduler import build_scheduler

        scheduler = build_scheduler(container)
        scheduler.start()
        logger.info("Scheduler started")

    # Backfill stories stored before the page reader existed. Runs in the background so
    # startup isn't delayed; finished stories are skipped, so redeploys are cheap.
    backfill = None
    if container.settings.startup_enrich_limit > 0:
        from app.ingestion.jobs import enrich_articles

        backfill = asyncio.create_task(
            enrich_articles(
                container, container.settings.startup_enrich_limit, only_unfinished=True
            )
        )

    yield

    if backfill is not None and not backfill.done():
        backfill.cancel()
    if scheduler is not None:
        scheduler.shutdown(wait=False)
    await container.aclose()


def create_app(s: Settings = settings) -> FastAPI:
    _configure_logging(s)
    _init_sentry(s)
    app = FastAPI(
        title="Samā4 API",
        description="AI-powered contextual news intelligence platform",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_origin_regex=s.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DailyBudgetExceeded)
    async def over_budget(request: Request, exc: DailyBudgetExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc) + " Please try again tomorrow."},
            headers={"Retry-After": str(exc.retry_after)},
        )

    app.include_router(admin.router, prefix=f"{API_PREFIX}/admin", tags=["admin"])
    app.include_router(feed.router, prefix=f"{API_PREFIX}/feed", tags=["feed"])
    app.include_router(articles.router, prefix=f"{API_PREFIX}/articles", tags=["articles"])
    app.include_router(context.router, prefix=f"{API_PREFIX}/context", tags=["context"])
    app.include_router(search.router, prefix=f"{API_PREFIX}/search", tags=["search"])
    app.include_router(predictions.router, prefix=f"{API_PREFIX}/predictions", tags=["predictions"])
    app.include_router(waitlist.router, prefix=f"{API_PREFIX}/waitlist", tags=["waitlist"])
    app.include_router(sources.router, prefix=f"{API_PREFIX}/sources", tags=["sources"])

    @app.get("/health")
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
