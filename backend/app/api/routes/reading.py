import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_admin, require_student
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.reading import (
    DIFFICULTIES,
    SUPPORTED_READING_QTYPES,
    ReadingAttempt,
    ReadingPassage,
    ReadingQuestion,
)
from app.models.user import User
from app.schemas.reading import (
    ReadingAttemptCreate,
    ReadingAttemptResponse,
    ReadingAttemptSummary,
    ReadingPassageAdmin,
    ReadingPassageCreate,
    ReadingPassageStudent,
    ReadingPassageSummary,
    ReadingPassageUpdate,
    ReadingQuestionAdmin,
    ReadingQuestionPublic,
    ReadingResultItem,
)
from app.services.question_options import normalize_answer, normalize_options
from app.services import reading as reading_service

router = APIRouter(tags=["reading"])


def _validate_meta(exam: str, difficulty: str, questions: list) -> None:
    if exam not in SUPPORTED_EXAMS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"exam must be one of: {', '.join(SUPPORTED_EXAMS)}",
        )
    if difficulty not in DIFFICULTIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"difficulty must be one of: {', '.join(DIFFICULTIES)}",
        )
    for q in questions:
        qtype = q.question_type if hasattr(q, "question_type") else q["question_type"]
        if qtype not in SUPPORTED_READING_QTYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"question_type must be one of: {', '.join(SUPPORTED_READING_QTYPES)}",
            )


def _get_passage(passage_id: str, db: Session) -> ReadingPassage:
    try:
        parsed = uuid.UUID(passage_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Passage not found")
    passage = (
        db.query(ReadingPassage)
        .options(joinedload(ReadingPassage.questions))
        .filter(ReadingPassage.id == parsed)
        .first()
    )
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")
    return passage


def _admin_payload(passage: ReadingPassage) -> ReadingPassageAdmin:
    return ReadingPassageAdmin(
        id=passage.id,
        exam=passage.exam,
        title=passage.title,
        passage_text=passage.passage_text,
        topic=passage.topic,
        difficulty=passage.difficulty,
        time_limit_minutes=passage.time_limit_minutes,
        strategy_tip=passage.strategy_tip,
        is_published=passage.is_published,
        questions=[
            ReadingQuestionAdmin(
                id=q.id,
                order_index=q.order_index,
                question_type=q.question_type,
                question_text=q.question_text,
                options=normalize_options(q.options),
                correct_answer=normalize_answer(q.correct_answer),
                explanation=q.explanation,
            )
            for q in sorted(passage.questions, key=lambda x: x.order_index)
        ],
        created_at=passage.created_at,
        updated_at=passage.updated_at,
    )


def _student_payload(passage: ReadingPassage) -> ReadingPassageStudent:
    return ReadingPassageStudent(
        id=passage.id,
        exam=passage.exam,
        title=passage.title,
        passage_text=passage.passage_text,
        topic=passage.topic,
        difficulty=passage.difficulty,
        time_limit_minutes=passage.time_limit_minutes,
        strategy_tip=passage.strategy_tip,
        questions=[
            ReadingQuestionPublic(
                id=q.id,
                order_index=q.order_index,
                question_type=q.question_type,
                question_text=q.question_text,
                options=normalize_options(q.options),
            )
            for q in sorted(passage.questions, key=lambda x: x.order_index)
        ],
        created_at=passage.created_at,
    )


def _replace_questions(
    passage: ReadingPassage, questions: list, db: Session
) -> None:
    db.query(ReadingQuestion).filter(ReadingQuestion.passage_id == passage.id).delete()
    for i, q in enumerate(questions):
        db.add(
            ReadingQuestion(
                passage_id=passage.id,
                order_index=q.order_index if q.order_index else i,
                question_type=q.question_type,
                question_text=q.question_text.strip(),
                options=q.options or None,
                correct_answer=q.correct_answer.strip(),
                explanation=(q.explanation or "").strip() or None,
            )
        )


# ---- Admin ----


@router.get("/admin/reading-passages", response_model=list[ReadingPassageSummary])
def admin_list_passages(
    exam: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(ReadingPassage).order_by(ReadingPassage.created_at.desc())
    if exam:
        q = q.filter(ReadingPassage.exam == exam)
    rows = q.all()
    return [
        ReadingPassageSummary(
            id=p.id,
            exam=p.exam,
            title=p.title,
            topic=p.topic,
            difficulty=p.difficulty,
            time_limit_minutes=p.time_limit_minutes,
            is_published=p.is_published,
            question_count=len(p.questions),
            created_at=p.created_at,
        )
        for p in rows
    ]


@router.get("/admin/reading-passages/{passage_id}", response_model=ReadingPassageAdmin)
def admin_get_passage(
    passage_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _admin_payload(_get_passage(passage_id, db))


@router.post(
    "/admin/reading-passages",
    response_model=ReadingPassageAdmin,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_passage(
    payload: ReadingPassageCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _validate_meta(payload.exam, payload.difficulty, payload.questions)
    passage = ReadingPassage(
        created_by=current_user.id,
        exam=payload.exam,
        title=payload.title.strip(),
        passage_text=payload.passage_text.strip(),
        topic=(payload.topic or "").strip() or None,
        difficulty=payload.difficulty,
        time_limit_minutes=payload.time_limit_minutes,
        strategy_tip=(payload.strategy_tip or "").strip() or None,
        is_published=payload.is_published,
    )
    db.add(passage)
    db.flush()
    _replace_questions(passage, payload.questions, db)
    db.commit()
    return _admin_payload(_get_passage(str(passage.id), db))


@router.patch("/admin/reading-passages/{passage_id}", response_model=ReadingPassageAdmin)
def admin_update_passage(
    passage_id: str,
    payload: ReadingPassageUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    passage = _get_passage(passage_id, db)
    data = payload.model_dump(exclude_unset=True)
    questions = data.pop("questions", None)
    exam = data.get("exam", passage.exam)
    difficulty = data.get("difficulty", passage.difficulty)
    if questions is not None:
        _validate_meta(exam, difficulty, questions)
    elif "exam" in data or "difficulty" in data:
        _validate_meta(exam, difficulty, [])

    for key, value in data.items():
        if isinstance(value, str) and key in {"title", "passage_text", "topic", "strategy_tip"}:
            value = value.strip() or None if key in {"topic", "strategy_tip"} else value.strip()
        setattr(passage, key, value)

    if questions is not None:
        # Reconstruct pydantic-like objects from dicts already dumped
        from app.schemas.reading import ReadingQuestionInput

        parsed = [ReadingQuestionInput(**q) if isinstance(q, dict) else q for q in questions]
        _replace_questions(passage, parsed, db)

    db.commit()
    return _admin_payload(_get_passage(passage_id, db))


@router.delete("/admin/reading-passages/{passage_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_passage(
    passage_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    passage = _get_passage(passage_id, db)
    db.delete(passage)
    db.commit()
    return None


# ---- Student ----


@router.get("/reading/passages", response_model=list[ReadingPassageSummary])
def list_published_passages(
    exam: str | None = Query(default=None),
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    q = (
        db.query(ReadingPassage)
        .filter(ReadingPassage.is_published.is_(True))
        .order_by(ReadingPassage.created_at.desc())
    )
    if exam:
        q = q.filter(ReadingPassage.exam == exam)
    rows = q.all()
    return [
        ReadingPassageSummary(
            id=p.id,
            exam=p.exam,
            title=p.title,
            topic=p.topic,
            difficulty=p.difficulty,
            time_limit_minutes=p.time_limit_minutes,
            is_published=p.is_published,
            question_count=len(p.questions),
            created_at=p.created_at,
        )
        for p in rows
    ]


@router.get("/reading/passages/{passage_id}", response_model=ReadingPassageStudent)
def get_published_passage(
    passage_id: str,
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    passage = _get_passage(passage_id, db)
    if not passage.is_published:
        raise HTTPException(status_code=404, detail="Passage not found")
    return _student_payload(passage)


@router.post(
    "/reading/attempts",
    response_model=ReadingAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_reading_attempt(
    payload: ReadingAttemptCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    passage = (
        db.query(ReadingPassage)
        .options(joinedload(ReadingPassage.questions))
        .filter(
            ReadingPassage.id == payload.passage_id,
            ReadingPassage.is_published.is_(True),
        )
        .first()
    )
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")

    questions = sorted(passage.questions, key=lambda q: q.order_index)
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Passage has no questions",
        )

    results, score = reading_service.score_attempt(questions, payload.answers)
    total = len(questions)
    percentage = round((score / total) * 100, 1) if total else 0.0

    attempt = ReadingAttempt(
        user_id=current_user.id,
        passage_id=passage.id,
        exam=passage.exam,
        passage_title=passage.title,
        answers=payload.answers,
        results=results,
        score=score,
        total=total,
        percentage=percentage,
        time_spent_seconds=payload.time_spent_seconds,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return ReadingAttemptResponse(
        id=attempt.id,
        passage_id=attempt.passage_id,
        exam=attempt.exam,
        passage_title=attempt.passage_title,
        score=attempt.score,
        total=attempt.total,
        percentage=attempt.percentage,
        time_spent_seconds=attempt.time_spent_seconds,
        results=[ReadingResultItem(**r) for r in results],
        created_at=attempt.created_at,
    )


@router.get("/reading/attempts", response_model=list[ReadingAttemptSummary])
def list_my_attempts(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return (
        db.query(ReadingAttempt)
        .filter(ReadingAttempt.user_id == current_user.id)
        .order_by(ReadingAttempt.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/reading/attempts/{attempt_id}", response_model=ReadingAttemptResponse)
def get_my_attempt(
    attempt_id: str,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(attempt_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt = (
        db.query(ReadingAttempt)
        .filter(
            ReadingAttempt.id == parsed,
            ReadingAttempt.user_id == current_user.id,
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return ReadingAttemptResponse(
        id=attempt.id,
        passage_id=attempt.passage_id,
        exam=attempt.exam,
        passage_title=attempt.passage_title,
        score=attempt.score,
        total=attempt.total,
        percentage=attempt.percentage,
        time_spent_seconds=attempt.time_spent_seconds,
        results=[ReadingResultItem(**r) for r in attempt.results],
        created_at=attempt.created_at,
    )
