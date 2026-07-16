"""Orchestrate the ingestion pipeline for a document.

PDF -> extract -> clean -> chunk -> embed -> store vectors.

Runs as a background task with its own DB session and records progress on the
Document's status/chunk_count/error fields.
"""

import uuid

from app.core import storage
from app.db.session import SessionLocal
from app.models.chunk import Chunk
from app.models.document import (
    STATUS_FAILED,
    STATUS_PROCESSING,
    STATUS_READY,
    Document,
)
from app.services.chunking import chunk_text
from app.services.embeddings import embed_texts
from app.services.extraction import clean_text, extract_text

# Embed in batches to stay within request limits.
EMBED_BATCH_SIZE = 64


def ingest_document(document_id: str) -> None:
    """Process a single document end-to-end. Safe to run in a background task."""
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == uuid.UUID(document_id)).first()
        if not doc:
            return

        doc.status = STATUS_PROCESSING
        doc.error = None
        db.commit()

        # 1-2. Extract + clean.
        path = storage.get_file_path(doc.stored_filename)
        raw = extract_text(path)
        cleaned = clean_text(raw)
        if not cleaned:
            raise ValueError(
                "No extractable text found (the PDF may be scanned images)."
            )

        # 3. Chunk.
        chunks = chunk_text(cleaned)
        if not chunks:
            raise ValueError("Document produced no chunks.")

        # 4. Embed (batched).
        embeddings: list[list[float]] = []
        for i in range(0, len(chunks), EMBED_BATCH_SIZE):
            batch = chunks[i : i + EMBED_BATCH_SIZE]
            embeddings.extend(embed_texts(batch))

        # 5. Store vectors. Replace any prior chunks for idempotent re-ingest.
        db.query(Chunk).filter(Chunk.document_id == doc.id).delete()
        for index, (content, vector) in enumerate(zip(chunks, embeddings)):
            db.add(
                Chunk(
                    document_id=doc.id,
                    user_id=doc.user_id,
                    chunk_index=index,
                    content=content,
                    embedding=vector,
                )
            )

        doc.chunk_count = len(chunks)
        doc.status = STATUS_READY
        doc.error = None
        db.commit()
    except Exception as exc:  # noqa: BLE001 - record failure on the document
        db.rollback()
        doc = db.query(Document).filter(Document.id == uuid.UUID(document_id)).first()
        if doc:
            # Keep status/chunks consistent: failed docs should not retain
            # orphan vectors that retrieval would still ignore.
            db.query(Chunk).filter(Chunk.document_id == doc.id).delete()
            doc.status = STATUS_FAILED
            doc.error = str(exc)[:1000]
            doc.chunk_count = 0
            db.commit()
    finally:
        db.close()
