import uuid
from datetime import datetime

from pydantic import BaseModel

# ============ Agent Perspectives ============


class AgentPerspectiveOut(BaseModel):
    id: uuid.UUID
    agent_name: str
    agent_role: str
    agent_persona: str | None = None
    stance: str
    perspective_text: str
    key_argument: str | None = None
    influence_score: int = 50
    sentiment_score: float | None = None


# ============ Prediction ============


class PredictionSummary(BaseModel):
    """Lightweight prediction info for feed cards."""

    id: uuid.UUID
    status: str
    prediction_summary: str | None = None
    confidence_score: float | None = None
    impact_score: int = 0
    agent_count: int = 500
    completed_at: datetime | None = None


class PredictionDetail(BaseModel):
    """Full prediction with agent perspectives."""

    id: uuid.UUID
    article_id: uuid.UUID
    status: str
    agent_count: int
    simulation_rounds: int
    platforms: list[str]
    prediction_summary: str | None = None
    key_findings: list[str] = []
    sentiment_distribution: str | None = (
        None  # JSON string of {positive: %, negative: %, neutral: %}
    )
    predicted_outcomes: list[str] = []
    confidence_score: float | None = None
    impact_score: int = 0
    agent_perspectives: list[AgentPerspectiveOut] = []
    created_at: datetime
    completed_at: datetime | None = None


class PredictionRequest(BaseModel):
    """Request to trigger a simulation for an article."""

    article_id: uuid.UUID
    agent_count: int = 500
    simulation_rounds: int = 30
    platforms: list[str] = ["twitter", "reddit"]
    prediction_focus: str | None = None  # optional focus prompt


class PredictionStatusOut(BaseModel):
    id: uuid.UUID
    status: str
    progress_message: str = ""


# ============ Chat with Report ============


class PredictionChatRequest(BaseModel):
    prediction_id: uuid.UUID
    message: str
    history: list[dict] = []  # [{role: "user"/"assistant", content: "..."}]


class PredictionChatResponse(BaseModel):
    prediction_id: uuid.UUID
    response: str
    sources: list[str] = []


# ============ Agent Interview ============


class AgentInterviewRequest(BaseModel):
    prediction_id: uuid.UUID
    agent_perspective_id: uuid.UUID
    question: str


class AgentInterviewResponse(BaseModel):
    agent_name: str
    agent_role: str
    response: str
    stance: str


# ============ Trending ============


class TrendingPrediction(BaseModel):
    """Prediction with article info for trending tab."""

    id: uuid.UUID
    article_id: uuid.UUID
    article_title: str
    article_image_url: str | None = None
    article_source: str
    prediction_summary: str | None = None
    key_findings: list[str] = []
    impact_score: int = 0
    confidence_score: float | None = None
    agent_count: int
    completed_at: datetime | None = None
