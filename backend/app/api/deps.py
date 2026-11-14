"""FastAPI dependencies. Routers get everything they need from here.

Use the Annotated aliases in route signatures:

    async def handler(db: DbSession, service: ContextServiceDep) -> ...

Tests override `get_container` (and `get_db` if needed) via app.dependency_overrides.
"""

import logging
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.container import Container, get_container
from app.database import get_db
from app.services.context import ContextService
from app.services.predictions import PredictionService

logger = logging.getLogger(__name__)

DEFAULT_ADMIN_SECRET = "change-me-in-production"

DbSession = Annotated[AsyncSession, Depends(get_db)]
ContainerDep = Annotated[Container, Depends(get_container)]


def get_context_service(c: ContainerDep) -> ContextService:
    return ContextService(
        llm=c.llm,
        vectors=c.vectors,
        cache=c.cache,
        wikimedia=c.wikimedia,
        mirofish=c.mirofish,
        context_ttl=c.settings.entity_context_ttl,
    )


def get_prediction_service(c: ContainerDep) -> PredictionService:
    return PredictionService(llm=c.llm, cache=c.cache, mirofish=c.mirofish, settings=c.settings)


ContextServiceDep = Annotated[ContextService, Depends(get_context_service)]
PredictionServiceDep = Annotated[PredictionService, Depends(get_prediction_service)]


def require_admin(
    c: ContainerDep,
    x_admin_secret: Annotated[str, Header(alias="X-Admin-Secret")],
) -> None:
    """Reject the request unless X-Admin-Secret matches settings.admin_secret.

    In production the built-in default secret is never accepted.
    """
    expected = c.settings.admin_secret
    if c.settings.environment == "production" and expected == DEFAULT_ADMIN_SECRET:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin secret is not configured.")
    if not secrets.compare_digest(x_admin_secret.encode(), expected.encode()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid admin secret.")


AdminOnly = Depends(require_admin)


def client_ip(request: Request) -> str:
    """The caller's IP as seen by our edge proxy.

    Railway appends the real client address to X-Forwarded-For, so the last entry
    is the one a client can't forge. Locally there is no proxy: use request.client.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(
    c: Container, request: Request, *, bucket: str, limit: int, window: int, message: str
) -> None:
    """Allow `limit` requests per IP per `window` seconds, else 429.

    Fails open when Redis is down: the request goes through and a warning is logged.
    """
    count = await c.cache.hit(f"ratelimit:{bucket}:{client_ip(request)}", window)
    if count is None:
        logger.warning("Rate limit %s unavailable (no Redis); allowing request", bucket)
    elif count > limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, message, headers={"Retry-After": str(window)}
        )
