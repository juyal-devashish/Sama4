import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.dbtypes import GUID


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)

    canonical_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # External links
    wikidata_id: Mapped[str | None] = mapped_column(String(50))
    wikipedia_url: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)

    # Pre-generated context
    short_context: Mapped[str | None] = mapped_column(Text)
    context_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Metadata
    popularity_score: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    article_entities: Mapped[list["ArticleEntity"]] = relationship(
        back_populates="entity", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("canonical_name", "entity_type"),
        Index("idx_entities_wikidata", "wikidata_id"),
        Index("idx_entities_type", "entity_type"),
        Index("idx_entities_popularity", popularity_score.desc()),
    )


class ArticleEntity(Base):
    __tablename__ = "article_entities"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    article_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("articles.id", ondelete="CASCADE")
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("entities.id", ondelete="CASCADE")
    )

    # Position info for highlighting
    mention_text: Mapped[str] = mapped_column(String(255), nullable=False)
    start_position: Mapped[int] = mapped_column(Integer, nullable=False)
    end_position: Mapped[int] = mapped_column(Integer, nullable=False)

    # Priority
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    in_title: Mapped[bool] = mapped_column(Boolean, default=False)
    mention_count: Mapped[int] = mapped_column(Integer, default=1)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    article: Mapped["Article"] = relationship(back_populates="article_entities")  # noqa: F821
    entity: Mapped["Entity"] = relationship(back_populates="article_entities")

    __table_args__ = (
        UniqueConstraint("article_id", "entity_id", "start_position"),
        Index("idx_article_entities_article", "article_id"),
        Index("idx_article_entities_entity", "entity_id"),
        Index("idx_article_entities_priority", "priority"),
    )
