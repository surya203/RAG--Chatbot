"""Similarity search over stored chunks (pipeline step 6).

pgvector is unavailable, so vectors are loaded from Postgres and ranked in
Python with cosine similarity. Fine for the modest scale here (hundreds of
chunks per user).
"""

import math
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chunk import Chunk
from app.models.document import STATUS_READY, Document


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    document_name: str
    subject: str
    chunk_index: int
    content: str
    score: float


def _cosine(a: list[float], b: list[float]) -> float:
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def similarity_search(
    db: Session,
    user_id: uuid.UUID,
    query_embedding: list[float],
    top_k: int | None = None,
    document_ids: list[str] | None = None,
) -> list[RetrievedChunk]:
    """Return the top_k most similar chunks owned by the user.

    Optionally restrict to specific documents. Only chunks from documents in
    the READY state are searched.
    """
    top_k = top_k or settings.RETRIEVAL_TOP_K

    query = (
        db.query(Chunk, Document)
        .join(Document, Chunk.document_id == Document.id)
        .filter(Chunk.user_id == user_id, Document.status == STATUS_READY)
    )
    if document_ids:
        parsed = [uuid.UUID(d) for d in document_ids]
        query = query.filter(Chunk.document_id.in_(parsed))

    rows = query.all()
    if not rows:
        return []

    scored: list[RetrievedChunk] = []
    for chunk, doc in rows:
        score = _cosine(query_embedding, chunk.embedding)
        scored.append(
            RetrievedChunk(
                chunk_id=str(chunk.id),
                document_id=str(doc.id),
                document_name=doc.original_name,
                subject=doc.subject,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                score=score,
            )
        )

    scored.sort(key=lambda c: c.score, reverse=True)
    return scored[:top_k]
