import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.dbtypes import GUID, StringArray


class Prediction(Base):
    """Stores MiroFish simulation results for an article."""

    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    article_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("articles.id", ondelete="CASCADE")
    )

    # MiroFish references
    mirofish_project_id: Mapped[str | None] = mapped_column(String(255))
    mirofish_simulation_id: Mapped[str | None] = mapped_column(String(255))

    # Simulation config
    agent_count: Mapped[int] = mapped_column(Integer, default=500)
    simulation_rounds: Mapped[int] = mapped_column(Integer, default=30)
    platforms: Mapped[list[str]] = mapped_column(StringArray, default=lambda: ["twitter", "reddit"])

    # Status: queued, building_graph, simulating, generating_report, completed, failed
    status: Mapped[str] = mapped_column(String(50), default="queued")
    error_message: Mapped[str | None] = mapped_column(Text)

    # Results
    prediction_summary: Mapped[str | None] = mapped_column(Text)
    key_findings: Mapped[list[str]] = mapped_column(StringArray, default=list)
    sentiment_distribution: Mapped[str | None] = mapped_column(Text)  # JSON string
    predicted_outcomes: Mapped[list[str]] = mapped_column(StringArray, default=list)
    confidence_score: Mapped[float | None] = mapped_column(default=None)

    # Impact scoring (used for trending)
    impact_score: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    article: Mapped["Article"] = relationship()  # noqa: F821
    agent_perspectives: Mapped[list["AgentPerspective"]] = relationship(
        back_populates="prediction", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_predictions_article", "article_id"),
        Index("idx_predictions_status", "status"),
        Index("idx_predictions_impact", impact_score.desc()),
        Index("idx_predictions_created", created_at.desc()),
    )


class AgentPerspective(Base):
    """Stores notable agent viewpoints from a MiroFish simulation."""

    __tablename__ = "agent_perspectives"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    prediction_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("predictions.id", ondelete="CASCADE")
    )

    # Agent identity
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_role: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. "economist", "policy analyst"
    agent_persona: Mapped[str | None] = mapped_column(Text)  # full persona description

    # Perspective content
    stance: Mapped[str] = mapped_column(String(50))  # positive, negative, neutral, mixed
    perspective_text: Mapped[str] = mapped_column(Text, nullable=False)
    key_argument: Mapped[str | None] = mapped_column(Text)

    # Metadata
    influence_score: Mapped[int] = mapped_column(Integer, default=50)  # 0-100
    sentiment_score: Mapped[float | None] = mapped_column(default=None)  # -1.0 to 1.0

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    prediction: Mapped["Prediction"] = relationship(back_populates="agent_perspectives")

    __table_args__ = (
        Index("idx_agent_persp_prediction", "prediction_id"),
        Index("idx_agent_persp_influence", influence_score.desc()),
    )
