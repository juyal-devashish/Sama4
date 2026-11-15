import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.api.deps import ContainerDep, ContextServiceDep, DbSession, per_ip_limit, rate_limit
from app.clients.usage import DailyBudgetExceeded
from app.database import async_session
from app.repositories import articles as article_repo
from app.repositories import entities as entity_repo
from app.repositories import reports as report_repo
from app.schemas.context import (
    ContextResponse,
    ExplainRequest,
    ExplainResponse,
    MoreDetailResponse,
    ReportRequest,
    ReportResponse,
    SelectionRequest,
    SelectionResponse,
)
from app.services.context import SelectionNotInArticleError

REPORTS_PER_IP = 20
REPORT_WINDOW_SECONDS = 3600

logger = logging.getLogger(__name__)
router = APIRouter()


# Per IP per hour. A reader opening terms hits the cache most of the time, so the explanation
# limit is generous; follow-ups always call Claude, so theirs is tighter.
EXPLANATIONS_PER_IP = 300
FOLLOWUPS_PER_IP = 40
SELECTIONS_PER_IP = 120
MORE_DETAIL_PER_IP = 120


@router.post(
    "/selection",
    response_model=SelectionResponse,
    dependencies=[per_ip_limit("selection", SELECTIONS_PER_IP)],
)
async def explain_selection(
    request: SelectionRequest, db: DbSession, service: ContextServiceDep
) -> SelectionResponse:
    """Explain text a reader selected in a story (anything that isn't a highlighted term)."""
    article = await article_repo.get(db, request.article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    try:
        return await service.explain_selection(article, request.text)
    except SelectionNotInArticleError:
        raise HTTPException(status_code=422, detail="That text isn't in this story.") from None


@router.get(
    "/{entity_id}",
    response_model=ContextResponse,
    dependencies=[per_ip_limit("context", EXPLANATIONS_PER_IP)],
)
async def get_entity_context(
    entity_id: uuid.UUID,
    db: DbSession,
    service: ContextServiceDep,
    article_id: uuid.UUID | None = None,
) -> ContextResponse:
    """Explanation of an entity (shown when a reader taps a highlighted term).

    With `article_id` the explanation is written for, and cached per, that story.
    """
    entity = await entity_repo.get(db, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return await service.get_context(entity, db, article_id)


def sse(event: str, data: str) -> str:
    """One Server-Sent Event. `data` must be a single line (JSON)."""
    return f"event: {event}\ndata: {data}\n\n"


@router.get(
    "/{entity_id}/stream",
    dependencies=[per_ip_limit("context", EXPLANATIONS_PER_IP)],
)
async def stream_entity_context(
    entity_id: uuid.UUID,
    service: ContextServiceDep,
    article_id: uuid.UUID | None = None,
) -> StreamingResponse:
    """`GET /{entity_id}` as a stream of Server-Sent Events.

    `delta` events carry `{"text": ...}` as Claude writes; one `done` event carries the full
    ContextResponse (the same JSON the plain GET returns), with the final text. A cached
    explanation sends only `done`. Anything that goes wrong ends with an `error` event; the
    client then falls back to the plain GET.
    """
    # Own session: the request's is closed before a streamed body is produced.
    async with async_session() as db:
        entity = await entity_repo.get(db, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")

    async def events() -> AsyncIterator[str]:
        try:
            async with async_session() as db:
                entity_here = await entity_repo.get(db, entity_id)
                assert entity_here is not None
                async for kind, payload in service.stream_context(entity_here, db, article_id):
                    if kind == "delta":
                        yield sse("delta", json.dumps({"text": payload}))
                    else:
                        yield sse("done", payload.model_dump_json())  # type: ignore[union-attr]
                await db.commit()
        except DailyBudgetExceeded as e:
            yield sse("error", json.dumps({"detail": str(e)}))
        except Exception:
            logger.error("Streaming an explanation failed", exc_info=True)
            yield sse("error", json.dumps({"detail": "The explanation could not be written."}))

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get(
    "/{entity_id}/more",
    response_model=MoreDetailResponse,
    dependencies=[per_ip_limit("more-detail", MORE_DETAIL_PER_IP)],
)
async def get_more_detail(
    entity_id: uuid.UUID,
    db: DbSession,
    service: ContextServiceDep,
    article_id: uuid.UUID | None = None,
) -> MoreDetailResponse:
    """A fuller explanation of an entity, for the "More detail" button."""
    entity = await entity_repo.get(db, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return await service.get_more_detail(entity, db, article_id)


@router.post(
    "/explain",
    response_model=ExplainResponse,
    dependencies=[per_ip_limit("followup", FOLLOWUPS_PER_IP)],
)
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
