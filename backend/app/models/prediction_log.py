import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.dbtypes import GUID


class PredictionLogEntry(Base):
    """A permanent, timestamped record of one published projection.

    It is a snapshot: ids are plain columns (no foreign keys) and the story's title and
    URL are copied, so the record survives a re-run, a story purge or a publisher
    opt-out. `resolve_by` is when someone should check the projection against what
    happened; `resolution` is filled in by hand then.
    """

    __tablename__ = "prediction_log"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    prediction_id: Mapped[uuid.UUID] = mapped_column(GUID, unique=True)
    article_id: Mapped[uuid.UUID] = mapped_column(GUID, index=True)
    article_title: Mapped[str] = mapped_column(String(1000), default="")
    article_url: Mapped[str] = mapped_column(String(2000), default="")
    method: Mapped[str] = mapped_column(String(40))  # "simulation" | "language_model"
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    outcomes: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of strings
    predicted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolve_by: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # "pending" until someone checks it: then "happened", "partly", "did_not_happen", "unclear".
    resolution: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
