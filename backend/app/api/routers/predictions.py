"""Prediction API — trigger simulations, get reports, chat, interview agents."""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import ContainerDep, DbSession, PredictionServiceDep
from app.ingestion import jobs
from app.models.article import Article
from app.models.prediction import (
    STATUS_BUILDING_GRAPH,
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_GENERATING_REPORT,
    STATUS_QUEUED,
    STATUS_SIMULATING,
    AgentPerspective,
    Prediction,
)
from app.schemas.prediction import (
    AgentInterviewRequest,
    AgentInterviewResponse,
    AgentPerspectiveOut,
    PredictionChatRequest,
    PredictionChatResponse,
    PredictionDetail,
    PredictionRequest,
    PredictionStatusOut,
    PredictionSummary,
    TrendingPrediction,
)
from app.services.predictions import CANCELLED_MESSAGE

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/simulate", response_model=PredictionSummary)
async def trigger_simulation(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    db: DbSession,
    prediction_service: PredictionServiceDep,
    c: ContainerDep,
) -> PredictionSummary:
    """Trigger a MiroFish simulation for an article."""
    # Verify article exists
    article = await db.get(Article, request.article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    prediction = await prediction_service.trigger_simulation(
        article=article,
        db=db,
        agent_count=request.agent_count,
        simulation_rounds=request.simulation_rounds,
        platforms=request.platforms,
        prediction_focus=request.prediction_focus,
    )
    await db.commit()

    # Only kick off background simulation if newly queued
    if prediction.status == STATUS_QUEUED:
        background_tasks.add_task(jobs.run_simulation, c, str(prediction.id))

    return PredictionSummary(
        id=prediction.id,
        status=prediction.status,
        prediction_summary=prediction.prediction_summary,
        confidence_score=prediction.confidence_score,
        impact_score=prediction.impact_score,
        agent_count=prediction.agent_count,
        completed_at=prediction.completed_at,
    )


@router.get("/article/{article_id}", response_model=PredictionDetail | None)
async def get_article_prediction(
    article_id: uuid.UUID,
    db: DbSession,
    prediction_service: PredictionServiceDep,
) -> PredictionDetail | None:
    """Get the latest prediction for an article."""
    prediction = await prediction_service.get_prediction_for_article(str(article_id), db)
    if not prediction:
        return None
    await prediction_service.expire_if_stale(prediction, db)

    return PredictionDetail(
        id=prediction.id,
        article_id=prediction.article_id,
        status=prediction.status,
        method=prediction.method,
        agent_count=prediction.agent_count,
        simulation_rounds=prediction.simulation_rounds,
        platforms=prediction.platforms or [],
        prediction_summary=prediction.prediction_summary,
        key_findings=prediction.key_findings or [],
        sentiment_distribution=prediction.sentiment_distribution,
        predicted_outcomes=prediction.predicted_outcomes or [],
        confidence_score=prediction.confidence_score,
        impact_score=prediction.impact_score,
        agent_perspectives=[
            AgentPerspectiveOut(
                id=ap.id,
                agent_name=ap.agent_name,
                agent_role=ap.agent_role,
                agent_persona=ap.agent_persona,
                stance=ap.stance,
                perspective_text=ap.perspective_text,
                key_argument=ap.key_argument,
                influence_score=ap.influence_score,
                sentiment_score=ap.sentiment_score,
            )
            for ap in prediction.agent_perspectives
        ],
        created_at=prediction.created_at,
        completed_at=prediction.completed_at,
    )


@router.get("/{prediction_id}/status", response_model=PredictionStatusOut)
async def get_prediction_status(
    prediction_id: uuid.UUID,
    db: DbSession,
    prediction_service: PredictionServiceDep,
) -> PredictionStatusOut:
    """Check the status of a prediction simulation."""
    prediction = await db.get(Prediction, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    await prediction_service.expire_if_stale(prediction, db)

    status_messages = {
        STATUS_QUEUED: "Waiting to start simulation...",
        STATUS_BUILDING_GRAPH: "Building knowledge graph from article...",
        STATUS_SIMULATING: f"Running simulation with {prediction.agent_count} agents...",
        STATUS_GENERATING_REPORT: "Analyzing simulation results...",
        STATUS_COMPLETED: "Prediction complete!",
        STATUS_FAILED: f"Simulation failed: {prediction.error_message or 'Unknown error'}",
    }

    return PredictionStatusOut(
        id=prediction.id,
        status=prediction.status,
        progress_message=status_messages.get(prediction.status, prediction.status),
    )


@router.post("/{prediction_id}/cancel", response_model=PredictionStatusOut)
async def cancel_prediction(
    prediction_id: uuid.UUID,
    db: DbSession,
    prediction_service: PredictionServiceDep,
) -> PredictionStatusOut:
    """Stop a running prediction (the reader pressed Cancel). 409 if it isn't running."""
    prediction = await db.get(Prediction, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    if not await prediction_service.cancel(prediction, db):
        raise HTTPException(status_code=409, detail=f"Prediction is {prediction.status}")
    return PredictionStatusOut(
        id=prediction.id, status=prediction.status, progress_message=CANCELLED_MESSAGE
    )


@router.post("/chat", response_model=PredictionChatResponse)
async def chat_with_prediction(
    request: PredictionChatRequest,
    db: DbSession,
    prediction_service: PredictionServiceDep,
) -> PredictionChatResponse:
    """Chat with a prediction report to ask follow-up questions."""
    prediction = await db.get(Prediction, request.prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    if prediction.status != STATUS_COMPLETED:
        raise HTTPException(status_code=400, detail="Prediction is not yet complete")

    response = await prediction_service.chat_with_prediction(
        prediction, request.message, request.history
    )

    return PredictionChatResponse(
        prediction_id=prediction.id,
        response=response,
    )


@router.post("/interview", response_model=AgentInterviewResponse)
async def interview_agent(
    request: AgentInterviewRequest,
    db: DbSession,
    prediction_service: PredictionServiceDep,
) -> AgentInterviewResponse:
    """Interview a specific agent from the simulation."""
    prediction = await db.execute(
        select(Prediction)
        .where(Prediction.id == request.prediction_id)
        .options(selectinload(Prediction.agent_perspectives))
    )
    prediction = prediction.scalar_one_or_none()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    perspective = await db.get(AgentPerspective, request.agent_perspective_id)
    if not perspective or perspective.prediction_id != prediction.id:
        raise HTTPException(status_code=404, detail="Agent perspective not found")

    response = await prediction_service.interview_agent(prediction, perspective, request.question)

    return AgentInterviewResponse(
        agent_name=perspective.agent_name,
        agent_role=perspective.agent_role,
        response=response,
        stance=perspective.stance,
    )


@router.get("/trending", response_model=list[TrendingPrediction])
async def get_trending_predictions(
    db: DbSession,
    prediction_service: PredictionServiceDep,
    limit: int = 20,
) -> list[TrendingPrediction]:
    """Get trending predictions ranked by impact score."""
    results = await prediction_service.get_trending_predictions(db, limit=limit)
    return [TrendingPrediction(**r) for r in results]
