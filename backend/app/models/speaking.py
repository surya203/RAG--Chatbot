import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

TASK_IELTS_PART1 = "ielts_part1"
TASK_IELTS_PART2 = "ielts_part2"
TASK_IELTS_PART3 = "ielts_part3"
TASK_TOEFL_INDEPENDENT = "toefl_independent_speaking"
TASK_TOEFL_INTEGRATED = "toefl_integrated_speaking"
TASK_PTE_DESCRIBE = "pte_describe_image"
TASK_PTE_RETELL = "pte_retell_lecture"

SUPPORTED_SPEAKING_TASKS = (
    TASK_IELTS_PART1,
    TASK_IELTS_PART2,
    TASK_IELTS_PART3,
    TASK_TOEFL_INDEPENDENT,
    TASK_TOEFL_INTEGRATED,
    TASK_PTE_DESCRIBE,
    TASK_PTE_RETELL,
)


class SpeakingPrompt(Base):
    __tablename__ = "speaking_prompts"

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
    cue_points: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    prep_seconds: Mapped[int] = mapped_column(Integer, default=0)
    speak_seconds: Mapped[int] = mapped_column(Integer, default=120)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class SpeakingAttempt(Base):
    __tablename__ = "speaking_attempts"

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
        ForeignKey("speaking_prompts.id", ondelete="SET NULL"),
        nullable=True,
    )
    exam: Mapped[str] = mapped_column(String(40))
    task_type: Mapped[str] = mapped_column(String(60))
    prompt_text: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str] = mapped_column(Text)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overall_band: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
