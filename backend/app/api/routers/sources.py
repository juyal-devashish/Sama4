from fastapi import APIRouter

from app.api.deps import ContainerDep
from app.schemas.source import SourcesResponse
from app.services.sources import list_sources

router = APIRouter()


@router.get("", response_model=SourcesResponse)
async def get_sources(c: ContainerDep) -> SourcesResponse:
    """Every outlet and RSS feed the nightly pipeline reads."""
    return list_sources(blocked=c.settings.blocked_publishers)
