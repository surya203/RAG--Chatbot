import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.schemas.conversation import (
    ConversationDetail,
    ConversationResponse,
    ConversationUpdate,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _get_owned_conversation(conv_id: str, user: User, db: Session) -> Conversation:
    try:
        parsed = uuid.UUID(conv_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == parsed, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


@router.get("", response_model=list[ConversationResponse])
def list_conversations(
    q: str | None = Query(default=None, description="Search by title or message text"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Conversation).filter(Conversation.user_id == current_user.id)

    if q:
        term = f"%{q.strip()}%"
        # Match the title or any message content within the conversation.
        message_match = (
            db.query(Message.conversation_id)
            .filter(Message.content.ilike(term))
            .subquery()
        )
        query = query.filter(
            or_(
                Conversation.title.ilike(term),
                Conversation.id.in_(message_match),
            )
        )

    conversations = query.order_by(
        Conversation.is_pinned.desc(),
        Conversation.updated_at.desc(),
    ).all()
    return conversations


@router.get("/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_owned_conversation(conv_id, current_user, db)


@router.patch("/{conv_id}", response_model=ConversationResponse)
def update_conversation(
    conv_id: str,
    payload: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_owned_conversation(conv_id, current_user, db)
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Conversation title cannot be empty",
            )
        conv.title = title[:255]
    if payload.is_pinned is not None:
        conv.is_pinned = payload.is_pinned
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_owned_conversation(conv_id, current_user, db)
    db.delete(conv)
    db.commit()
    return None
