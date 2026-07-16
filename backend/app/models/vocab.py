import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

VOCAB_TOPICS = (
    "education",
    "environment",
    "technology",
    "health",
    "work",
    "travel",
    "culture",
    "science",
    "general",
)

SRS_STATUS_NEW = "new"
SRS_STATUS_LEARNING = "learning"
SRS_STATUS_REVIEW = "review"
SRS_STATUS_MASTERED = "mastered"

SRS_STATUSES = (SRS_STATUS_NEW, SRS_STATUS_LEARNING, SRS_STATUS_REVIEW, SRS_STATUS_MASTERED)


class VocabCard(Base):
    __tablename__ = "vocab_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    exam: Mapped[str] = mapped_column(String(40), index=True)
    topic: Mapped[str] = mapped_column(String(60), index=True, default="general")
    word: Mapped[str] = mapped_column(String(120))
    definition: Mapped[str] = mapped_column(Text)
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    collocations: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class VocabUserProgress(Base):
    __tablename__ = "vocab_user_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "card_id", name="uq_vocab_user_card"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vocab_cards.id", ondelete="CASCADE"),
        index=True,
    )
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default=SRS_STATUS_NEW)
    next_review_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
