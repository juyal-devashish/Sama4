import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base
from app.dbtypes import GUID, StringArray


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))

    # Preferences
    preferred_categories: Mapped[list[str]] = mapped_column(StringArray, default=list)
    reading_level: Mapped[str] = mapped_column(String(20), default="general")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class UserReadingHistory(Base):
    __tablename__ = "user_reading_history"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE")
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("articles.id", ondelete="CASCADE")
    )

    # Engagement signals
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_duration_seconds: Mapped[int | None] = mapped_column(Integer)
    scrolled_percentage: Mapped[float | None] = mapped_column(Numeric(3, 2))
    entities_clicked: Mapped[list[uuid.UUID]] = mapped_column(JSON, default=list)

    __table_args__ = (
        UniqueConstraint("user_id", "article_id"),
        Index("idx_user_history_user", "user_id"),
        Index("idx_user_history_article", "article_id"),
    )
