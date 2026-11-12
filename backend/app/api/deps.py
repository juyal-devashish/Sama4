"""FastAPI dependencies. Routers get everything they need from here.

Use the Annotated aliases in route signatures:

    async def handler(db: DbSession, service: ContextServiceDep) -> ...

Tests override `get_container` (and `get_db` if needed) via app.dependency_overrides.
"""

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.container import Container, get_container
from app.database import get_db
from app.services.context import ContextService
from app.services.predictions import PredictionService

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
