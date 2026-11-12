from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import PaginationMeta
from app.schemas.feed import FeedResponse

router = APIRouter()


@router.get("", response_model=FeedResponse)
async def search_articles(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
    """Semantic search across articles."""
    # TODO: Implement Pinecone vector search
    # 1. Generate embedding for query (Pinecone Inference, see services/vectors.py)
    # 2. Search Pinecone for similar article embeddings
    # 3. Fetch matching articles from PostgreSQL
    return FeedResponse(
        articles=[],
        pagination=PaginationMeta(
            page=page,
            limit=limit,
            total=0,
            has_next=False,
        ),
    )
