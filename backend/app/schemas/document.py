from datetime import datetime

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: str
    original_name: str
    subject: str
    content_type: str
    size_bytes: int
    status: str
    chunk_count: int
    error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    """Rename a document and/or move it to a different subject.

    Both fields are optional; only the provided ones are changed.
    """

    original_name: str | None = Field(default=None, min_length=1, max_length=255)
    subject: str | None = Field(default=None, min_length=1, max_length=120)


class UploadResponse(BaseModel):
    uploaded: list[DocumentResponse]
    errors: list[str] = []
