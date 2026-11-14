import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.dbtypes import GUID


class ExplanationRecord(Base):
    """One explanation Claude wrote, and exactly what it was written from.

    The cache holds explanations for a day; this keeps the provenance for good, so a
    reported or disputed explanation can be traced to the story and Wikipedia revision.
    """

    __tablename__ = "explanation_records"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    # Plain ids, not foreign keys: the record outlives entity merges and article clean-ups.
    entity_id: Mapped[uuid.UUID] = mapped_column(GUID, index=True)
    article_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    wikipedia_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    wikipedia_revision_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    text: Mapped[str] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
