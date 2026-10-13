import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.dbtypes import GUID, StringArray


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("sources.id", ondelete="SET NULL")
    )

    # Original content
    url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    raw_content: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    author: Mapped[str | None] = mapped_column(String(255))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Processed content
    summary: Mapped[str | None] = mapped_column(Text)
    cleaned_content: Mapped[str | None] = mapped_column(Text)
    reading_time_minutes: Mapped[int | None] = mapped_column(Integer)
    complexity_score: Mapped[float | None] = mapped_column(Numeric(3, 2))

    # Metadata
    categories: Mapped[list[str]] = mapped_column(StringArray, default=list)
    content_hash: Mapped[str | None] = mapped_column(String(64))

    # Processing status
    processing_status: Mapped[str] = mapped_column(String(50), default="pending")
    processing_error: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    source: Mapped["Source"] = relationship(back_populates="articles")  # noqa: F821
    article_entities: Mapped[list["ArticleEntity"]] = relationship(  # noqa: F821
        back_populates="article", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_articles_published_at", published_at.desc()),
        Index("idx_articles_source_id", source_id),
        Index("idx_articles_status", processing_status),
        Index("idx_articles_content_hash", content_hash),
    )
