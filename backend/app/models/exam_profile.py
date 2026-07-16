import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Canonical exam keys used across prompts + profiles.
EXAM_IELTS_ACADEMIC = "ielts_academic"
EXAM_IELTS_GENERAL = "ielts_general"
EXAM_TOEFL_IBT = "toefl_ibt"
EXAM_PTE_ACADEMIC = "pte_academic"

SUPPORTED_EXAMS = (
    EXAM_IELTS_ACADEMIC,
    EXAM_IELTS_GENERAL,
    EXAM_TOEFL_IBT,
    EXAM_PTE_ACADEMIC,
)


class ExamProfile(Base):
    __tablename__ = "exam_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    target_exam: Mapped[str] = mapped_column(String(40))
    target_score: Mapped[str | None] = mapped_column(String(20), nullable=True)
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
