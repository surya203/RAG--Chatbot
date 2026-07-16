import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

MOCK_MODE_FULL = "full"
MOCK_MODE_SECTION = "section"
MOCK_MODES = (MOCK_MODE_FULL, MOCK_MODE_SECTION)


class MockExam(Base):
    """Timed mock that bundles published reading / listening / writing content."""

    __tablename__ = "mock_exams"

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
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mode: Mapped[str] = mapped_column(String(20), default=MOCK_MODE_FULL)
    total_time_minutes: Mapped[int] = mapped_column(Integer, default=60)
    reading_passage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reading_passages.id", ondelete="SET NULL"),
        nullable=True,
    )
    listening_exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listening_exercises.id", ondelete="SET NULL"),
        nullable=True,
    )
    writing_prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_prompts.id", ondelete="SET NULL"),
        nullable=True,
    )
    speaking_prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_prompts.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class MockAttempt(Base):
    __tablename__ = "mock_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    mock_exam_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mock_exams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    exam: Mapped[str] = mapped_column(String(40), index=True)
    mock_title: Mapped[str] = mapped_column(String(255))

    # Student submissions
    reading_answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    listening_answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    writing_essay: Mapped[str | None] = mapped_column(Text, nullable=True)
    speaking_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Per-skill results
    reading_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    listening_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    listening_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    listening_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    writing_band: Mapped[float | None] = mapped_column(Float, nullable=True)
    speaking_band: Mapped[float | None] = mapped_column(Float, nullable=True)

    section_results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    weak_topics: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    overall_band: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
