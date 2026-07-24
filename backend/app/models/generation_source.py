"""Admin PDF sources used for PDF → Generate."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GenerationSource(Base):
    """Persisted admin PDF that was used to generate exam practice content.

    Not part of the student document library / RAG chat.
    """

    __tablename__ = "generation_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    original_name: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/pdf")
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    exam: Mapped[str] = mapped_column(String(40), index=True)
    # e.g. ["writing", "reading", "listening"]
    features: Mapped[list] = mapped_column(JSONB, default=list)
    # e.g. {"writing": ["uuid"], "vocab": ["uuid", ...]}
    created_items: Mapped[dict] = mapped_column(JSONB, default=dict)
    source_chars: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
