from pydantic import BaseModel, Field


class ChatQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    # Existing conversation to append to; a new one is created if omitted.
    conversation_id: str | None = None
    # Optional: restrict retrieval to specific documents.
    document_ids: list[str] | None = None


class SourceChunk(BaseModel):
    document_id: str
    document_name: str
    subject: str
    chunk_index: int
    score: float
    preview: str
