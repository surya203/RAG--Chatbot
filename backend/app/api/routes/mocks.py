import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_student
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.listening import ListeningExercise
from app.models.mock_exam import MOCK_MODES, MockAttempt, MockExam
from app.models.reading import ReadingPassage
from app.models.speaking import SpeakingPrompt
from app.models.user import User
from app.models.writing import WritingAttempt, WritingPrompt
from app.schemas.mock_exam import (
    ExamLeaderboardEntry,
    MockAttemptCreate,
    MockAttemptResponse,
    MockAttemptSummary,
    MockExamAdmin,
    MockExamCreate,
    MockExamStudent,
    MockExamSummary,
    MockExamUpdate,
    MockSectionListening,
    MockSectionReading,
    MockSectionSpeaking,
    MockSectionWriting,
)
from app.services import mock_exam as mock_service

router = APIRouter(tags=["mocks"])


def _get_mock(mock_id: str, db: Session) -> MockExam:
    try:
        parsed = uuid.UUID(mock_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Mock exam not found")
    mock = db.query(MockExam).filter(MockExam.id == parsed).first()
    if not mock:
        raise HTTPException(status_code=404, detail="Mock exam not found")
    return mock


def _validate_create(payload: MockExamCreate) -> None:
    if payload.exam not in SUPPORTED_EXAMS:
        raise HTTPException(
            status_code=422,
            detail=f"exam must be one of: {', '.join(SUPPORTED_EXAMS)}",
        )
    if payload.mode not in MOCK_MODES:
        raise HTTPException(
            status_code=422,
            detail=f"mode must be one of: {', '.join(MOCK_MODES)}",
        )
    if not any(
        [
            payload.reading_passage_id,
            payload.listening_exercise_id,
            payload.writing_prompt_id,
            payload.speaking_prompt_id,
        ]
    ):
        raise HTTPException(
            status_code=422,
            detail="Select at least one section (reading, listening, writing, or speaking)",
        )


def _summary(mock: MockExam) -> MockExamSummary:
    return MockExamSummary(
        id=mock.id,
        exam=mock.exam,
        title=mock.title,
        description=mock.description,
        mode=mock.mode,
        total_time_minutes=mock.total_time_minutes,
        has_reading=mock.reading_passage_id is not None,
        has_listening=mock.listening_exercise_id is not None,
        has_writing=mock.writing_prompt_id is not None,
        has_speaking=mock.speaking_prompt_id is not None,
        is_published=mock.is_published,
        created_at=mock.created_at,
    )


def _admin_payload(mock: MockExam) -> MockExamAdmin:
    return MockExamAdmin(
        id=mock.id,
        exam=mock.exam,
        title=mock.title,
        description=mock.description,
        mode=mock.mode,
        total_time_minutes=mock.total_time_minutes,
        reading_passage_id=mock.reading_passage_id,
        listening_exercise_id=mock.listening_exercise_id,
        writing_prompt_id=mock.writing_prompt_id,
        speaking_prompt_id=mock.speaking_prompt_id,
        is_published=mock.is_published,
        created_at=mock.created_at,
        updated_at=mock.updated_at,
    )


def _public_questions(questions) -> list[dict]:
    return [
        {
            "id": str(q.id),
            "order_index": q.order_index,
            "question_type": q.question_type,
            "question_text": q.question_text,
            "options": q.options,
        }
        for q in sorted(questions, key=lambda x: x.order_index)
    ]


def _student_payload(mock: MockExam, content: dict) -> MockExamStudent:
    reading = content["reading"]
    listening = content["listening"]
    writing = content["writing"]
    speaking = content["speaking"]

    return MockExamStudent(
        id=mock.id,
        exam=mock.exam,
        title=mock.title,
        description=mock.description,
        mode=mock.mode,
        total_time_minutes=mock.total_time_minutes,
        reading=(
            MockSectionReading(
                id=reading.id,
                title=reading.title,
                passage_text=reading.passage_text,
                topic=reading.topic,
                strategy_tip=reading.strategy_tip,
                questions=_public_questions(reading.questions),
            )
            if reading
            else None
        ),
        listening=(
            MockSectionListening(
                id=listening.id,
                title=listening.title,
                topic=listening.topic,
                strategy_tip=listening.strategy_tip,
                replay_limit=listening.replay_limit,
                questions=_public_questions(listening.questions),
            )
            if listening
            else None
        ),
        writing=(
            MockSectionWriting(
                id=writing.id,
                title=writing.title,
                task_type=writing.task_type,
                prompt_text=writing.prompt_text,
                topic=writing.topic,
                min_words=writing.min_words,
            )
            if writing
            else None
        ),
        speaking=(
            MockSectionSpeaking(
                id=speaking.id,
                title=speaking.title,
                task_type=speaking.task_type,
                prompt_text=speaking.prompt_text,
                cue_points=speaking.cue_points,
                prep_seconds=speaking.prep_seconds,
                speak_seconds=speaking.speak_seconds,
            )
            if speaking
            else None
        ),
        created_at=mock.created_at,
    )


def _attempt_summary(att: MockAttempt) -> MockAttemptSummary:
    return MockAttemptSummary(
        id=att.id,
        mock_title=att.mock_title,
        exam=att.exam,
        overall_band=att.overall_band,
        overall_percentage=att.overall_percentage,
        points=att.points,
        reading_percentage=att.reading_percentage,
        listening_percentage=att.listening_percentage,
        writing_band=att.writing_band,
        speaking_band=att.speaking_band,
        created_at=att.created_at,
    )


def _attempt_response(
    att: MockAttempt, previous: MockAttempt | None = None
) -> MockAttemptResponse:
    return MockAttemptResponse(
        id=att.id,
        mock_exam_id=att.mock_exam_id,
        exam=att.exam,
        mock_title=att.mock_title,
        reading_score=att.reading_score,
        reading_total=att.reading_total,
        reading_percentage=att.reading_percentage,
        listening_score=att.listening_score,
        listening_total=att.listening_total,
        listening_percentage=att.listening_percentage,
        writing_band=att.writing_band,
        speaking_band=att.speaking_band,
        section_results=att.section_results,
        weak_topics=att.weak_topics,
        overall_band=att.overall_band,
        overall_percentage=att.overall_percentage,
        points=att.points,
        time_spent_seconds=att.time_spent_seconds,
        previous_attempt=_attempt_summary(previous) if previous else None,
        created_at=att.created_at,
    )


# ---- Admin ----


@router.get("/admin/mock-exams", response_model=list[MockExamSummary])
def admin_list_mocks(
    exam: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(MockExam).order_by(MockExam.created_at.desc())
    if exam:
        q = q.filter(MockExam.exam == exam)
    return [_summary(m) for m in q.all()]


@router.get("/admin/mock-exams/{mock_id}", response_model=MockExamAdmin)
def admin_get_mock(
    mock_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _admin_payload(_get_mock(mock_id, db))


@router.post(
    "/admin/mock-exams",
    response_model=MockExamAdmin,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_mock(
    payload: MockExamCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _validate_create(payload)

    # Ensure linked content exists (when provided).
    if payload.reading_passage_id:
        if not db.query(ReadingPassage).filter(ReadingPassage.id == payload.reading_passage_id).first():
            raise HTTPException(status_code=422, detail="Reading passage not found")
    if payload.listening_exercise_id:
        if not db.query(ListeningExercise).filter(ListeningExercise.id == payload.listening_exercise_id).first():
            raise HTTPException(status_code=422, detail="Listening exercise not found")
    if payload.writing_prompt_id:
        if not db.query(WritingPrompt).filter(WritingPrompt.id == payload.writing_prompt_id).first():
            raise HTTPException(status_code=422, detail="Writing prompt not found")
    if payload.speaking_prompt_id:
        if not db.query(SpeakingPrompt).filter(SpeakingPrompt.id == payload.speaking_prompt_id).first():
            raise HTTPException(status_code=422, detail="Speaking prompt not found")

    mock = MockExam(
        created_by=current_user.id,
        exam=payload.exam,
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        mode=payload.mode,
        total_time_minutes=payload.total_time_minutes,
        reading_passage_id=payload.reading_passage_id,
        listening_exercise_id=payload.listening_exercise_id,
        writing_prompt_id=payload.writing_prompt_id,
        speaking_prompt_id=payload.speaking_prompt_id,
        is_published=payload.is_published,
    )
    db.add(mock)
    db.commit()
    db.refresh(mock)
    return _admin_payload(mock)


@router.patch("/admin/mock-exams/{mock_id}", response_model=MockExamAdmin)
def admin_update_mock(
    mock_id: str,
    payload: MockExamUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    mock = _get_mock(mock_id, db)
    data = payload.model_dump(exclude_unset=True)
    if "mode" in data and data["mode"] not in MOCK_MODES:
        raise HTTPException(status_code=422, detail="Invalid mode")
    for key, value in data.items():
        if key == "title" and value is not None:
            setattr(mock, key, value.strip())
        elif key == "description":
            setattr(mock, key, (value or "").strip() or None)
        else:
            setattr(mock, key, value)
    db.commit()
    db.refresh(mock)
    return _admin_payload(mock)


@router.delete("/admin/mock-exams/{mock_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_mock(
    mock_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    mock = _get_mock(mock_id, db)
    db.delete(mock)
    db.commit()
    return None


# ---- Student ----


@router.get("/mocks", response_model=list[MockExamSummary])
def list_published_mocks(
    exam: str | None = Query(default=None),
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    q = (
        db.query(MockExam)
        .filter(MockExam.is_published.is_(True))
        .order_by(MockExam.created_at.desc())
    )
    if exam:
        q = q.filter(MockExam.exam == exam)
    return [_summary(m) for m in q.all()]


@router.get("/mocks/attempts", response_model=list[MockAttemptSummary])
def list_my_mock_attempts(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MockAttempt)
        .filter(MockAttempt.user_id == current_user.id)
        .order_by(MockAttempt.created_at.desc())
        .limit(50)
        .all()
    )
    return [_attempt_summary(r) for r in rows]


@router.get("/mocks/attempts/{attempt_id}", response_model=MockAttemptResponse)
def get_my_mock_attempt(
    attempt_id: str,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(attempt_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt = (
        db.query(MockAttempt)
        .filter(
            MockAttempt.id == parsed,
            MockAttempt.user_id == current_user.id,
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    previous = None
    if attempt.mock_exam_id:
        previous = (
            db.query(MockAttempt)
            .filter(
                MockAttempt.user_id == current_user.id,
                MockAttempt.mock_exam_id == attempt.mock_exam_id,
                MockAttempt.id != attempt.id,
                MockAttempt.created_at < attempt.created_at,
            )
            .order_by(MockAttempt.created_at.desc())
            .first()
        )
    return _attempt_response(attempt, previous)


@router.post(
    "/mocks/attempts",
    response_model=MockAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_mock_attempt(
    payload: MockAttemptCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    mock = (
        db.query(MockExam)
        .filter(
            MockExam.id == payload.mock_exam_id,
            MockExam.is_published.is_(True),
        )
        .first()
    )
    if not mock:
        raise HTTPException(status_code=404, detail="Mock exam not found")

    scored = mock_service.score_mock_attempt(
        mock,
        reading_answers=payload.reading_answers,
        listening_answers=payload.listening_answers,
        writing_essay=payload.writing_essay,
        speaking_transcript=payload.speaking_transcript,
        db=db,
    )

    previous = (
        db.query(MockAttempt)
        .filter(
            MockAttempt.user_id == current_user.id,
            MockAttempt.mock_exam_id == mock.id,
        )
        .order_by(MockAttempt.created_at.desc())
        .first()
    )

    attempt = MockAttempt(
        user_id=current_user.id,
        mock_exam_id=mock.id,
        exam=mock.exam,
        mock_title=mock.title,
        reading_answers=payload.reading_answers,
        listening_answers=payload.listening_answers,
        writing_essay=(payload.writing_essay or "").strip() or None,
        speaking_transcript=(payload.speaking_transcript or "").strip() or None,
        time_spent_seconds=payload.time_spent_seconds,
        **scored,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return _attempt_response(attempt, previous)


@router.get("/mocks/{mock_id}", response_model=MockExamStudent)
def get_published_mock(
    mock_id: str,
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    mock = _get_mock(mock_id, db)
    if not mock.is_published:
        raise HTTPException(status_code=404, detail="Mock exam not found")
    content = mock_service.load_mock_content(mock, db)
    return _student_payload(mock, content)


@router.get("/exam-leaderboard", response_model=list[ExamLeaderboardEntry])
def exam_leaderboard(
    exam: str | None = Query(default=None),
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Rank students by mock exam performance, optionally filtered by exam."""
    q = (
        db.query(
            User.id,
            User.full_name,
            User.email,
            MockAttempt.exam,
            func.max(MockAttempt.overall_band).label("best_band"),
            func.max(MockAttempt.overall_percentage).label("best_pct"),
            func.coalesce(func.sum(MockAttempt.points), 0).label("points"),
            func.count(MockAttempt.id).label("attempts"),
            func.avg(MockAttempt.overall_band).label("avg_band"),
        )
        .join(MockAttempt, MockAttempt.user_id == User.id)
        .group_by(User.id, MockAttempt.exam)
    )
    if exam:
        if exam not in SUPPORTED_EXAMS:
            raise HTTPException(status_code=422, detail="Invalid exam filter")
        q = q.filter(MockAttempt.exam == exam)

    rows = q.order_by(func.sum(MockAttempt.points).desc()).limit(50).all()

    writing_avgs: dict[tuple, float] = {}
    wq = (
        db.query(
            WritingAttempt.user_id,
            WritingAttempt.exam,
            func.avg(WritingAttempt.overall_band),
        )
        .filter(WritingAttempt.overall_band.isnot(None))
        .group_by(WritingAttempt.user_id, WritingAttempt.exam)
    )
    if exam:
        wq = wq.filter(WritingAttempt.exam == exam)
    for uid, ex, avg in wq.all():
        writing_avgs[(uid, ex)] = round(float(avg), 1)

    return [
        ExamLeaderboardEntry(
            rank=i + 1,
            name=row.full_name or row.email,
            exam=row.exam,
            best_overall_band=round(float(row.best_band), 1) if row.best_band is not None else None,
            best_percentage=round(float(row.best_pct), 1) if row.best_pct is not None else None,
            total_points=int(row.points),
            mock_attempts=int(row.attempts),
            writing_avg_band=writing_avgs.get((row.id, row.exam)),
            avg_mock_band=round(float(row.avg_band), 1) if row.avg_band is not None else None,
        )
        for i, row in enumerate(rows)
    ]
