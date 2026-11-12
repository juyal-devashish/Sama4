"""Prediction API — trigger simulations, get reports, chat, interview agents."""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.article import Article
from app.models.prediction import AgentPerspective, Prediction
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
from app.services.prediction_service import PredictionService

logger = logging.getLogger(__name__)
router = APIRouter()

prediction_service = PredictionService()


@router.post("/simulate", response_model=PredictionSummary)
async def trigger_simulation(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
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
    if prediction.status == "queued":
        background_tasks.add_task(_run_simulation_background, str(prediction.id))

    return PredictionSummary(
        id=prediction.id,
        status=prediction.status,
        prediction_summary=prediction.prediction_summary,
        confidence_score=prediction.confidence_score,
        impact_score=prediction.impact_score,
        agent_count=prediction.agent_count,
        completed_at=prediction.completed_at,
    )


async def _run_simulation_background(prediction_id: str) -> None:
    """Background task wrapper for running the simulation pipeline."""
    from app.database import async_session

    async with async_session() as db:
        service = PredictionService()
        await service.run_simulation_pipeline(prediction_id, db)


@router.get("/article/{article_id}", response_model=PredictionDetail | None)
async def get_article_prediction(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest prediction for an article."""
    prediction = await prediction_service.get_prediction_for_article(str(article_id), db)
    if not prediction:
        return None

    return PredictionDetail(
        id=prediction.id,
        article_id=prediction.article_id,
        status=prediction.status,
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
    db: AsyncSession = Depends(get_db),
):
    """Check the status of a prediction simulation."""
    prediction = await db.get(Prediction, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    status_messages = {
        "queued": "Waiting to start simulation...",
        "building_graph": "Building knowledge graph from article...",
        "simulating": f"Running simulation with {prediction.agent_count} agents...",
        "generating_report": "Analyzing simulation results...",
        "completed": "Prediction complete!",
        "failed": f"Simulation failed: {prediction.error_message or 'Unknown error'}",
    }

    return PredictionStatusOut(
        id=prediction.id,
        status=prediction.status,
        progress_message=status_messages.get(prediction.status, prediction.status),
    )


@router.post("/chat", response_model=PredictionChatResponse)
async def chat_with_prediction(
    request: PredictionChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Chat with a prediction report to ask follow-up questions."""
    prediction = await db.get(Prediction, request.prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    if prediction.status != "completed":
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
    db: AsyncSession = Depends(get_db),
):
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
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get trending predictions ranked by impact score."""
    results = await prediction_service.get_trending_predictions(db, limit=limit)
    return [TrendingPrediction(**r) for r in results]
