import uuid

from fastapi import APIRouter, HTTPException

from app.api.deps import ContextServiceDep, DbSession
from app.repositories import articles as article_repo
from app.repositories import entities as entity_repo
from app.schemas.context import ContextResponse, ExplainRequest, ExplainResponse

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
