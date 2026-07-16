import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Reuse reading question types for listening.
from app.models.reading import DIFFICULTIES, SUPPORTED_READING_QTYPES

SUPPORTED_LISTENING_QTYPES = SUPPORTED_READING_QTYPES


class ListeningExercise(Base):
    __tablename__ = "listening_exercises"

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
    audio_filename: Mapped[str] = mapped_column(String(255))
    audio_content_type: Mapped[str] = mapped_column(String(80))
    transcript: Mapped[str] = mapped_column(Text)
    vocabulary: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    topic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=10)
    # 0 = unlimited replays; 1 = once only; N = max N plays.
    replay_limit: Mapped[int] = mapped_column(Integer, default=2)
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

    questions: Mapped[list["ListeningQuestion"]] = relationship(
        "ListeningQuestion",
        back_populates="exercise",
        cascade="all, delete-orphan",
        order_by="ListeningQuestion.order_index",
    )


class ListeningQuestion(Base):
    __tablename__ = "listening_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listening_exercises.id", ondelete="CASCADE"),
        index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    question_type: Mapped[str] = mapped_column(String(40))
    question_text: Mapped[str] = mapped_column(Text)
    options: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[str] = mapped_column(String(500))
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    exercise: Mapped["ListeningExercise"] = relationship(
        "ListeningExercise", back_populates="questions"
    )


class ListeningAttempt(Base):
    __tablename__ = "listening_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listening_exercises.id", ondelete="SET NULL"),
        nullable=True,
    )
    exam: Mapped[str] = mapped_column(String(40))
    exercise_title: Mapped[str] = mapped_column(String(255))
    answers: Mapped[dict] = mapped_column(JSONB)
    results: Mapped[list] = mapped_column(JSONB)
    score: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    percentage: Mapped[float] = mapped_column(Float, default=0.0)
    replays_used: Mapped[int] = mapped_column(Integer, default=0)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
