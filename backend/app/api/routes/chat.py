import json
import uuid
from collections.abc import Iterator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import SessionLocal, get_db
from app.models.conversation import (
    ROLE_ASSISTANT,
    ROLE_USER,
    Conversation,
    Message,
)
from app.models.user import User
from app.schemas.chat import ChatQueryRequest
from app.services.embeddings import EmbeddingError, embed_query
from app.services.llm import LLMError, stream_answer
from app.services.retrieval import RetrievedChunk, similarity_search

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


def _source_payload(chunks: list[RetrievedChunk]) -> list[dict]:
    return [
        {
            "document_id": c.document_id,
            "document_name": c.document_name,
            "subject": c.subject,
            "chunk_index": c.chunk_index,
            "score": round(c.score, 4),
            "preview": c.content[:240] + ("…" if len(c.content) > 240 else ""),
        }
        for c in chunks
    ]


def _title_from(question: str) -> str:
    title = " ".join(question.strip().split())
    return (title[:60] + "…") if len(title) > 60 else title or "New chat"


@router.post("/query")
def chat_query(
    payload: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve relevant chunks, stream an answer, and persist the exchange.

    Event stream:
      data: {"type":"meta","conversation_id":...,"title":...}
      data: {"type":"sources","sources":[...]}
      data: {"type":"token","text":"..."}   (repeated)
      data: {"type":"done"}
      data: {"type":"error","message":"..."}
    """
    # Resolve or create the conversation up front (request session).
    if payload.conversation_id:
        try:
            conv = (
                db.query(Conversation)
                .filter(
                    Conversation.id == uuid.UUID(payload.conversation_id),
                    Conversation.user_id == current_user.id,
                )
                .first()
            )
        except ValueError:
            conv = None
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
            )
    else:
        conv = Conversation(user_id=current_user.id, title=_title_from(payload.question))
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # Persist the user's message immediately.
    db.add(Message(conversation_id=conv.id, role=ROLE_USER, content=payload.question))
    db.commit()

    conversation_id = str(conv.id)
    conversation_title = conv.title

    # Embed + retrieve before streaming so config errors surface as clean HTTP.
    try:
        query_embedding = embed_query(payload.question)
    except EmbeddingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    chunks = similarity_search(
        db,
        user_id=current_user.id,
        query_embedding=query_embedding,
        document_ids=payload.document_ids,
    )
    sources = _source_payload(chunks)

    def _persist_assistant(content: str) -> None:
        # Use a fresh session: this runs while/after the response streams.
        save_db = SessionLocal()
        try:
            save_db.add(
                Message(
                    conversation_id=uuid.UUID(conversation_id),
                    role=ROLE_ASSISTANT,
                    content=content,
                    sources=sources,
                )
            )
            conv_row = (
                save_db.query(Conversation)
                .filter(Conversation.id == uuid.UUID(conversation_id))
                .first()
            )
            if conv_row:
                # Bump updated_at so recent chats sort to the top.
                conv_row.updated_at = datetime.now(timezone.utc)
            save_db.commit()
        finally:
            save_db.close()

    def event_stream() -> Iterator[str]:
        yield _sse({
            "type": "meta",
            "conversation_id": conversation_id,
            "title": conversation_title,
        })
        yield _sse({"type": "sources", "sources": sources})

        answer = ""
        try:
            for token in stream_answer(payload.question, chunks):
                answer += token
                yield _sse({"type": "token", "text": token})
            _persist_assistant(answer)
            yield _sse({"type": "done"})
        except LLMError as exc:
            if answer:
                _persist_assistant(answer)
            yield _sse({"type": "error", "message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
