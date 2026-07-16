import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

TASK_IELTS_TASK1 = "ielts_task1"
TASK_IELTS_TASK2 = "ielts_task2"
TASK_TOEFL_INDEPENDENT = "toefl_independent"
TASK_TOEFL_INTEGRATED = "toefl_integrated"
TASK_PTE_ESSAY = "pte_essay"
TASK_PTE_SUMMARY = "pte_summarize_written_text"

SUPPORTED_TASK_TYPES = (
    TASK_IELTS_TASK1,
    TASK_IELTS_TASK2,
    TASK_TOEFL_INDEPENDENT,
    TASK_TOEFL_INTEGRATED,
    TASK_PTE_ESSAY,
    TASK_PTE_SUMMARY,
)


class WritingPrompt(Base):
    __tablename__ = "writing_prompts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    exam: Mapped[str] = mapped_column(String(40), index=True)
    task_type: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(255))
    prompt_text: Mapped[str] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=40)
    min_words: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class WritingAttempt(Base):
    __tablename__ = "writing_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_prompts.id", ondelete="SET NULL"),
        nullable=True,
    )
    exam: Mapped[str] = mapped_column(String(40))
    task_type: Mapped[str] = mapped_column(String(60))
    prompt_text: Mapped[str] = mapped_column(Text)
    essay_text: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overall_band: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
