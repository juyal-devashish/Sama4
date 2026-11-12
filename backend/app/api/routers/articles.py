import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.repositories import articles as article_repo
from app.schemas.article import (
    ArticleDetail,
    EntityInArticle,
    ReferenceEntityContext,
    ReferenceResponse,
    RelatedArticle,
    SourceInfo,
)

router = APIRouter()


async def _article_detail(db: AsyncSession, article_id: uuid.UUID) -> ArticleDetail:
    found = await article_repo.get_with_source(db, article_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Article not found")
    article, source = found
    mentions = await article_repo.list_mentions(db, article_id)
    return ArticleDetail(
        id=article.id,
        title=article.title,
        content=article.cleaned_content or article.raw_content,
        summary=article.summary,
        image_url=article.image_url,
        source=SourceInfo(
            name=source.name if source else "Unknown",
            url=article.url,
            credibility_score=float(source.credibility_score) if source else None,
        ),
        published_at=article.published_at,
        reading_time_minutes=article.reading_time_minutes,
        categories=article.categories or [],
        entities=[
            EntityInArticle(
                id=entity.id,
                text=ae.mention_text,
                type=entity.entity_type,
                start=ae.start_position,
                end=ae.end_position,
                priority=ae.priority,
            )
            for ae, entity in mentions
        ],
    )


@router.get("/{article_id}", response_model=ArticleDetail)
async def get_article(article_id: uuid.UUID, db: DbSession) -> ArticleDetail:
    """Article with entity mentions (positions, types, priorities) for highlighting."""
    return await _article_detail(db, article_id)


@router.get("/{article_id}/reference", response_model=ReferenceResponse)
async def get_reference_page(article_id: uuid.UUID, db: DbSession) -> ReferenceResponse:
    """Article plus every entity's stored context, most popular first."""
    detail = await _article_detail(db, article_id)
    entities = [
        ReferenceEntityContext(
            id=e.id,
            name=e.canonical_name,
            type=e.entity_type,
            context=e.short_context,
            wikipedia_url=e.wikipedia_url,
            image_url=e.image_url,
        )
        for e in await article_repo.list_entities_by_popularity(db, article_id)
    ]
    # Related articles are not implemented yet (would use VectorStore.search).
    related: list[RelatedArticle] = []
    return ReferenceResponse(article=detail, entities=entities, related_articles=related)
