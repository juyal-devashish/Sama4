from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.repositories import articles as article_repo
from app.schemas.common import PaginationMeta
from app.schemas.feed import ArticleCard, ArticleCardSource, FeedResponse

router = APIRouter()


@router.get("", response_model=FeedResponse)
async def get_feed(
    db: DbSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
) -> FeedResponse:
    """Paginated feed of processed articles, newest first."""
    rows, total = await article_repo.list_feed(db, page=page, limit=limit, category=category)
    return FeedResponse(
        articles=[
            ArticleCard(
                id=r.article.id,
                title=r.article.title,
                summary=r.article.summary,
                image_url=r.article.image_url,
                source=ArticleCardSource(name=r.source.name if r.source else "Unknown"),
                published_at=r.article.published_at,
                reading_time_minutes=r.article.reading_time_minutes,
                categories=r.article.categories or [],
                entity_count=r.entity_count,
            )
            for r in rows
        ],
        pagination=PaginationMeta(
            page=page, limit=limit, total=total, has_next=(page * limit) < total
        ),
    )
