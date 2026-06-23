from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    # Typed as UUID so SQLAlchemy values validate; serialized as a string.
    id: UUID
    role: str
    content: str
    sources: list | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: UUID
    title: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationResponse):
    messages: list[MessageResponse] = []


class ConversationUpdate(BaseModel):
    """Rename and/or pin a conversation. Only provided fields change."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    is_pinned: bool | None = None
