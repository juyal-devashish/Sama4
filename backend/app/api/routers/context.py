import uuid

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import ContainerDep, ContextServiceDep, DbSession, rate_limit
from app.repositories import articles as article_repo
from app.repositories import entities as entity_repo
from app.repositories import reports as report_repo
from app.schemas.context import (
    ContextResponse,
    ExplainRequest,
    ExplainResponse,
    ReportRequest,
    ReportResponse,
)

REPORTS_PER_IP = 20
REPORT_WINDOW_SECONDS = 3600

router = APIRouter()


@router.get("/{entity_id}", response_model=ContextResponse)
async def get_entity_context(
    entity_id: uuid.UUID, db: DbSession, service: ContextServiceDep
) -> ContextResponse:
    """Explanation of an entity (shown when a reader taps a highlighted term)."""
    entity = await entity_repo.get(db, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return await service.get_context(entity, db)


@router.post("/explain", response_model=ExplainResponse)
async def explain_entity(
    request: ExplainRequest, db: DbSession, service: ContextServiceDep
) -> ExplainResponse:
    """Answer a follow-up question about an entity in the context of an article."""
    entity = await entity_repo.get(db, request.entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    article = await article_repo.get(db, request.article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return await service.answer_followup(entity, article, request.question, db)


@router.post(
    "/{entity_id}/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED
)
async def report_explanation(
    entity_id: uuid.UUID, body: ReportRequest, request: Request, db: DbSession, c: ContainerDep
) -> ReportResponse:
    """A reader reports an explanation as wrong. Stored for review; no IP is kept."""
    await rate_limit(
        c,
        request,
        bucket="reports",
        limit=REPORTS_PER_IP,
        window=REPORT_WINDOW_SECONDS,
        message="Too many reports from this address. Try again later.",
    )
    entity = await entity_repo.get(db, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    await report_repo.add(
        db,
        entity_id=entity.id,
        entity_name=entity.canonical_name,
        article_id=body.article_id,
        explanation_text=body.explanation_text,
        reason=body.reason,
        note=(body.note or "").strip() or None,
    )
    return ReportResponse()
