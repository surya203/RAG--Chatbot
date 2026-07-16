import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_student
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.user import User
from app.models.vocab import VOCAB_TOPICS, VocabCard, VocabUserProgress
from app.schemas.vocab import (
    VocabCardAdmin,
    VocabCardInput,
    VocabCardPatch,
    VocabCardSummary,
    VocabEnrollRequest,
    VocabEnrollResponse,
    VocabEnrollRequest,
    VocabEnrollResponse,
    VocabReviewCard,
    VocabReviewRequest,
    VocabReviewResponse,
    VocabStats,
)
from app.services import progress as progress_service
from app.services.vocab_srs import VALID_RATINGS, apply_review, new_progress_defaults

router = APIRouter(tags=["vocab"])


def _get_card(card_id: str, db: Session) -> VocabCard:
    try:
        parsed = uuid.UUID(card_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Card not found")
    card = db.query(VocabCard).filter(VocabCard.id == parsed).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _progress_map(user_id, db: Session) -> dict[uuid.UUID, VocabUserProgress]:
    rows = (
        db.query(VocabUserProgress)
        .filter(VocabUserProgress.user_id == user_id)
        .all()
    )
    return {r.card_id: r for r in rows}


# ---- Admin ----


@router.get("/admin/vocab-cards", response_model=list[VocabCardAdmin])
def admin_list_cards(
    exam: str | None = None,
    topic: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(VocabCard).order_by(VocabCard.topic, VocabCard.word)
    if exam:
        q = q.filter(VocabCard.exam == exam)
    if topic:
        q = q.filter(VocabCard.topic == topic)
    return q.all()


@router.post(
    "/admin/vocab-cards",
    response_model=VocabCardAdmin,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_card(
    payload: VocabCardInput,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.exam not in SUPPORTED_EXAMS:
        raise HTTPException(
            status_code=422,
            detail=f"exam must be one of: {', '.join(SUPPORTED_EXAMS)}",
        )
    if payload.topic not in VOCAB_TOPICS:
        raise HTTPException(
            status_code=422,
            detail=f"topic must be one of: {', '.join(VOCAB_TOPICS)}",
        )
    card = VocabCard(
        created_by=current_user.id,
        exam=payload.exam,
        topic=payload.topic,
        word=payload.word.strip(),
        definition=payload.definition.strip(),
        example_sentence=(payload.example_sentence or "").strip() or None,
        collocations=payload.collocations or None,
        is_published=payload.is_published,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.patch("/admin/vocab-cards/{card_id}", response_model=VocabCardAdmin)
def admin_update_card(
    card_id: str,
    payload: VocabCardPatch,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    card = _get_card(card_id, db)
    if payload.is_published is not None:
        card.is_published = payload.is_published
    if payload.definition is not None:
        card.definition = payload.definition.strip()
    if payload.example_sentence is not None:
        card.example_sentence = payload.example_sentence.strip() or None
    db.commit()
    db.refresh(card)
    return card


@router.delete("/admin/vocab-cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_card(
    card_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    card = _get_card(card_id, db)
    db.delete(card)
    db.commit()
    return None


# ---- Student ----


@router.get("/vocab/cards", response_model=list[VocabCardSummary])
def list_published_cards(
    exam: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    q = (
        db.query(VocabCard)
        .filter(VocabCard.is_published.is_(True))
        .order_by(VocabCard.topic, VocabCard.word)
    )
    if exam:
        q = q.filter(VocabCard.exam == exam)
    if topic:
        q = q.filter(VocabCard.topic == topic)
    progress = _progress_map(current_user.id, db)
    return [
        VocabCardSummary(
            id=c.id,
            exam=c.exam,
            topic=c.topic,
            word=c.word,
            definition=c.definition,
            example_sentence=c.example_sentence,
            is_published=c.is_published,
            in_my_deck=c.id in progress,
            status=progress[c.id].status if c.id in progress else None,
            next_review_at=progress[c.id].next_review_at if c.id in progress else None,
        )
        for c in q.all()
    ]


@router.get("/vocab/due", response_model=list[VocabReviewCard])
def list_due_cards(
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    rows = (
        db.query(VocabUserProgress, VocabCard)
        .join(VocabCard, VocabCard.id == VocabUserProgress.card_id)
        .filter(
            VocabUserProgress.user_id == current_user.id,
            VocabUserProgress.next_review_at <= now,
            VocabUserProgress.status != "mastered",
        )
        .order_by(VocabUserProgress.next_review_at)
        .limit(limit)
        .all()
    )
    return [
        VocabReviewCard(
            progress_id=p.id,
            card_id=c.id,
            word=c.word,
            definition=c.definition,
            example_sentence=c.example_sentence,
            collocations=c.collocations,
            topic=c.topic,
            status=p.status,
            repetitions=p.repetitions,
            due=True,
        )
        for p, c in rows
    ]


@router.get("/vocab/stats", response_model=VocabStats)
def get_vocab_stats(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    learning = (
        db.query(VocabUserProgress)
        .filter(VocabUserProgress.user_id == current_user.id)
        .count()
    )
    due = (
        db.query(VocabUserProgress)
        .filter(
            VocabUserProgress.user_id == current_user.id,
            VocabUserProgress.next_review_at <= now,
            VocabUserProgress.status != "mastered",
        )
        .count()
    )
    mastered = (
        db.query(VocabUserProgress)
        .filter(
            VocabUserProgress.user_id == current_user.id,
            VocabUserProgress.status == "mastered",
        )
        .count()
    )
    today = datetime.now(timezone.utc).date()
    reviews_today = sum(
        1
        for (ts,) in db.query(VocabUserProgress.last_reviewed_at)
        .filter(
            VocabUserProgress.user_id == current_user.id,
            VocabUserProgress.last_reviewed_at.isnot(None),
        )
        .all()
        if ts and ts.date() == today
    )
    streak = progress_service.compute_streak(db, current_user.id)
    return VocabStats(
        learning=learning,
        due=due,
        mastered=mastered,
        reviews_today=reviews_today,
        streak_days=streak,
    )


@router.post("/vocab/enroll", response_model=VocabEnrollResponse)
def enroll_cards(
    payload: VocabEnrollRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    if payload.card_ids:
        cards = (
            db.query(VocabCard)
            .filter(
                VocabCard.id.in_(payload.card_ids),
                VocabCard.is_published.is_(True),
            )
            .all()
        )
    elif payload.topic:
        if payload.topic not in VOCAB_TOPICS:
            raise HTTPException(status_code=422, detail="Invalid topic")
        cards = (
            db.query(VocabCard)
            .filter(
                VocabCard.is_published.is_(True),
                VocabCard.topic == payload.topic,
            )
            .all()
        )
    else:
        raise HTTPException(
            status_code=422,
            detail="Provide card_ids or topic to enroll",
        )

    existing = {
        r.card_id
        for r in db.query(VocabUserProgress.card_id)
        .filter(VocabUserProgress.user_id == current_user.id)
        .all()
    }
    enrolled = 0
    skipped = 0
    defaults = new_progress_defaults()
    for card in cards:
        if card.id in existing:
            skipped += 1
            continue
        db.add(
            VocabUserProgress(
                user_id=current_user.id,
                card_id=card.id,
                **defaults,
            )
        )
        enrolled += 1
    db.commit()
    return VocabEnrollResponse(enrolled=enrolled, skipped=skipped)


@router.post("/vocab/cards/{card_id}/enroll", status_code=status.HTTP_201_CREATED)
def enroll_single_card(
    card_id: str,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    card = _get_card(card_id, db)
    if not card.is_published:
        raise HTTPException(status_code=404, detail="Card not found")
    exists = (
        db.query(VocabUserProgress)
        .filter(
            VocabUserProgress.user_id == current_user.id,
            VocabUserProgress.card_id == card.id,
        )
        .first()
    )
    if exists:
        return {"message": "Already in your deck"}
    progress = VocabUserProgress(
        user_id=current_user.id,
        card_id=card.id,
        **new_progress_defaults(),
    )
    db.add(progress)
    db.commit()
    return {"message": "Added to your deck"}


@router.post("/vocab/review", response_model=VocabReviewResponse)
def review_card(
    payload: VocabReviewRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    if payload.rating not in VALID_RATINGS:
        raise HTTPException(
            status_code=422,
            detail=f"rating must be one of: {', '.join(VALID_RATINGS)}",
        )
    progress = (
        db.query(VocabUserProgress)
        .filter(
            VocabUserProgress.id == payload.progress_id,
            VocabUserProgress.user_id == current_user.id,
        )
        .first()
    )
    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")

    apply_review(progress, payload.rating)
    db.commit()
    db.refresh(progress)
    return VocabReviewResponse(
        progress_id=progress.id,
        card_id=progress.card_id,
        status=progress.status,
        interval_days=progress.interval_days,
        next_review_at=progress.next_review_at,
        repetitions=progress.repetitions,
    )
