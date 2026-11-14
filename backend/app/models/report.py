import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.dbtypes import GUID


class ExplanationReport(Base):
    """A reader's "this explanation is wrong" report. Holds no IP or identity."""

    __tablename__ = "explanation_reports"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    # Plain ids, not foreign keys: a report outlives entity clean-ups and merges.
    entity_id: Mapped[uuid.UUID] = mapped_column(GUID, index=True)
    entity_name: Mapped[str] = mapped_column(String(500))
    article_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    # The explanation exactly as the reader saw it (it can change after regeneration).
    explanation_text: Mapped[str] = mapped_column(Text, default="")
    reason: Mapped[str] = mapped_column(String(40))
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
