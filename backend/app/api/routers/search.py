from fastapi import APIRouter, Query

from app.schemas.common import PaginationMeta
from app.schemas.feed import FeedResponse

router = APIRouter()


@router.get("", response_model=FeedResponse)
async def search_articles(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> FeedResponse:
    """Semantic search across articles. NOT IMPLEMENTED: always returns no results.

    To implement: VectorStore.search(q) -> article ids (article_id_from_vector_id)
    -> load rows via repositories.articles -> map to ArticleCard like routers/feed.py.
    """
    return FeedResponse(
        articles=[],
        pagination=PaginationMeta(page=page, limit=limit, total=0, has_next=False),
    )
