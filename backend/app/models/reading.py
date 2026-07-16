import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

Q_TFNG = "true_false_not_given"
Q_YNNR = "yes_no_not_given"
Q_MCQ = "multiple_choice"
Q_MATCHING = "matching_headings"
Q_SHORT = "short_answer"
Q_FILL = "fill_blank"

SUPPORTED_READING_QTYPES = (
    Q_TFNG,
    Q_YNNR,
    Q_MCQ,
    Q_MATCHING,
    Q_SHORT,
    Q_FILL,
)

DIFFICULTIES = ("easy", "medium", "hard")


class ReadingPassage(Base):
    __tablename__ = "reading_passages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    exam: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(255))
    passage_text: Mapped[str] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=20)
    strategy_tip: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    questions: Mapped[list["ReadingQuestion"]] = relationship(
        "ReadingQuestion",
        back_populates="passage",
        cascade="all, delete-orphan",
        order_by="ReadingQuestion.order_index",
    )


class ReadingQuestion(Base):
    __tablename__ = "reading_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    passage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reading_passages.id", ondelete="CASCADE"),
        index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    question_type: Mapped[str] = mapped_column(String(40))
    question_text: Mapped[str] = mapped_column(Text)
    options: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[str] = mapped_column(String(500))
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    passage: Mapped["ReadingPassage"] = relationship(
        "ReadingPassage", back_populates="questions"
    )


class ReadingAttempt(Base):
    __tablename__ = "reading_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    passage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reading_passages.id", ondelete="SET NULL"),
        nullable=True,
    )
    exam: Mapped[str] = mapped_column(String(40))
    passage_title: Mapped[str] = mapped_column(String(255))
    answers: Mapped[dict] = mapped_column(JSONB)
    results: Mapped[list] = mapped_column(JSONB)
    score: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    percentage: Mapped[float] = mapped_column(Float, default=0.0)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
