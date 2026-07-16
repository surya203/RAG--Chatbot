import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.core import storage
from app.core.deps import require_admin, require_student
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.listening import (
    DIFFICULTIES,
    SUPPORTED_LISTENING_QTYPES,
    ListeningAttempt,
    ListeningExercise,
    ListeningQuestion,
)
from app.models.user import User
from app.schemas.listening import (
    ListeningAttemptCreate,
    ListeningAttemptResponse,
    ListeningAttemptSummary,
    ListeningExerciseAdmin,
    ListeningExerciseStudent,
    ListeningExerciseSummary,
    ListeningQuestionAdmin,
    ListeningQuestionInput,
    ListeningQuestionPublic,
    ListeningResultItem,
    VocabItem,
)
from app.services import reading as reading_service

router = APIRouter(tags=["listening"])

MAX_AUDIO_MB = 25


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
        if qtype not in SUPPORTED_LISTENING_QTYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"question_type must be one of: {', '.join(SUPPORTED_LISTENING_QTYPES)}",
            )


def _get_exercise(exercise_id: str, db: Session) -> ListeningExercise:
    try:
        parsed = uuid.UUID(exercise_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Exercise not found")
    exercise = (
        db.query(ListeningExercise)
        .options(joinedload(ListeningExercise.questions))
        .filter(ListeningExercise.id == parsed)
        .first()
    )
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


def _parse_vocab(raw: list | None) -> list[VocabItem] | None:
    if not raw:
        return None
    return [VocabItem(word=v["word"], definition=v["definition"]) for v in raw]


def _admin_payload(exercise: ListeningExercise) -> ListeningExerciseAdmin:
    return ListeningExerciseAdmin(
        id=exercise.id,
        exam=exercise.exam,
        title=exercise.title,
        audio_content_type=exercise.audio_content_type,
        transcript=exercise.transcript,
        vocabulary=_parse_vocab(exercise.vocabulary),
        topic=exercise.topic,
        difficulty=exercise.difficulty,
        time_limit_minutes=exercise.time_limit_minutes,
        replay_limit=exercise.replay_limit,
        strategy_tip=exercise.strategy_tip,
        is_published=exercise.is_published,
        questions=[
            ListeningQuestionAdmin(
                id=q.id,
                order_index=q.order_index,
                question_type=q.question_type,
                question_text=q.question_text,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
            )
            for q in sorted(exercise.questions, key=lambda x: x.order_index)
        ],
        created_at=exercise.created_at,
        updated_at=exercise.updated_at,
    )


def _student_payload(exercise: ListeningExercise) -> ListeningExerciseStudent:
    return ListeningExerciseStudent(
        id=exercise.id,
        exam=exercise.exam,
        title=exercise.title,
        topic=exercise.topic,
        difficulty=exercise.difficulty,
        time_limit_minutes=exercise.time_limit_minutes,
        replay_limit=exercise.replay_limit,
        strategy_tip=exercise.strategy_tip,
        questions=[
            ListeningQuestionPublic(
                id=q.id,
                order_index=q.order_index,
                question_type=q.question_type,
                question_text=q.question_text,
                options=q.options,
            )
            for q in sorted(exercise.questions, key=lambda x: x.order_index)
        ],
        created_at=exercise.created_at,
    )


def _replace_questions(
    exercise: ListeningExercise, questions: list[ListeningQuestionInput], db: Session
) -> None:
    db.query(ListeningQuestion).filter(
        ListeningQuestion.exercise_id == exercise.id
    ).delete()
    for i, q in enumerate(questions):
        db.add(
            ListeningQuestion(
                exercise_id=exercise.id,
                order_index=q.order_index if q.order_index else i,
                question_type=q.question_type,
                question_text=q.question_text.strip(),
                options=q.options or None,
                correct_answer=q.correct_answer.strip(),
                explanation=(q.explanation or "").strip() or None,
            )
        )


def _parse_questions_json(raw: str) -> list[ListeningQuestionInput]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid questions JSON",
        ) from exc
    if not isinstance(data, list) or not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one question is required",
        )
    return [ListeningQuestionInput(**item) for item in data]


def _parse_vocab_json(raw: str | None) -> list | None:
    if not raw or not raw.strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid vocabulary JSON",
        ) from exc
    if not isinstance(data, list):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Vocabulary must be a JSON array",
        )
    return data


# ---- Admin ----


@router.get("/admin/listening-exercises", response_model=list[ListeningExerciseSummary])
def admin_list_exercises(
    exam: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(ListeningExercise).order_by(ListeningExercise.created_at.desc())
    if exam:
        q = q.filter(ListeningExercise.exam == exam)
    rows = q.all()
    return [
        ListeningExerciseSummary(
            id=e.id,
            exam=e.exam,
            title=e.title,
            topic=e.topic,
            difficulty=e.difficulty,
            time_limit_minutes=e.time_limit_minutes,
            replay_limit=e.replay_limit,
            is_published=e.is_published,
            question_count=len(e.questions),
            created_at=e.created_at,
        )
        for e in rows
    ]


@router.get(
    "/admin/listening-exercises/{exercise_id}",
    response_model=ListeningExerciseAdmin,
)
def admin_get_exercise(
    exercise_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _admin_payload(_get_exercise(exercise_id, db))


@router.post(
    "/admin/listening-exercises",
    response_model=ListeningExerciseAdmin,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_exercise(
    audio: Annotated[UploadFile, File()],
    exam: Annotated[str, Form()],
    title: Annotated[str, Form()],
    transcript: Annotated[str, Form()],
    questions_json: Annotated[str, Form()],
    topic: Annotated[str | None, Form()] = None,
    difficulty: Annotated[str, Form()] = "medium",
    time_limit_minutes: Annotated[int, Form()] = 10,
    replay_limit: Annotated[int, Form()] = 2,
    strategy_tip: Annotated[str | None, Form()] = None,
    vocabulary_json: Annotated[str | None, Form()] = None,
    is_published: Annotated[bool, Form()] = True,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    questions = _parse_questions_json(questions_json)
    _validate_meta(exam, difficulty, questions)

    name = audio.filename or "audio.mp3"
    ext = name.lower().split(".")[-1] if "." in name else ""
    allowed = {e.lstrip(".") for e in storage.AUDIO_EXTENSIONS}
    if ext not in allowed and audio.content_type not in storage.AUDIO_MIME.values():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio must be mp3, wav, m4a, ogg, or webm",
        )

    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(data) > MAX_AUDIO_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400, detail=f"Audio exceeds {MAX_AUDIO_MB} MB limit"
        )

    stored = storage.generate_audio_filename(name)
    storage.save_file(stored, data)
    content_type = audio.content_type or storage.guess_audio_content_type(stored)

    exercise = ListeningExercise(
        created_by=current_user.id,
        exam=exam,
        title=title.strip(),
        audio_filename=stored,
        audio_content_type=content_type,
        transcript=transcript.strip(),
        vocabulary=_parse_vocab_json(vocabulary_json),
        topic=(topic or "").strip() or None,
        difficulty=difficulty,
        time_limit_minutes=time_limit_minutes,
        replay_limit=max(0, replay_limit),
        strategy_tip=(strategy_tip or "").strip() or None,
        is_published=is_published,
    )
    db.add(exercise)
    db.flush()
    _replace_questions(exercise, questions, db)
    db.commit()
    return _admin_payload(_get_exercise(str(exercise.id), db))


@router.patch(
    "/admin/listening-exercises/{exercise_id}",
    response_model=ListeningExerciseAdmin,
)
def admin_update_exercise(
    exercise_id: str,
    is_published: bool | None = None,
    title: str | None = None,
    replay_limit: int | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    exercise = _get_exercise(exercise_id, db)
    if is_published is not None:
        exercise.is_published = is_published
    if title is not None:
        exercise.title = title.strip()
    if replay_limit is not None:
        exercise.replay_limit = max(0, replay_limit)
    db.commit()
    return _admin_payload(_get_exercise(exercise_id, db))


@router.delete(
    "/admin/listening-exercises/{exercise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def admin_delete_exercise(
    exercise_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    exercise = _get_exercise(exercise_id, db)
    storage.delete_file(exercise.audio_filename)
    db.delete(exercise)
    db.commit()
    return None


# ---- Student ----


@router.get("/listening/exercises", response_model=list[ListeningExerciseSummary])
def list_published_exercises(
    exam: str | None = Query(default=None),
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    q = (
        db.query(ListeningExercise)
        .filter(ListeningExercise.is_published.is_(True))
        .order_by(ListeningExercise.created_at.desc())
    )
    if exam:
        q = q.filter(ListeningExercise.exam == exam)
    rows = q.all()
    return [
        ListeningExerciseSummary(
            id=e.id,
            exam=e.exam,
            title=e.title,
            topic=e.topic,
            difficulty=e.difficulty,
            time_limit_minutes=e.time_limit_minutes,
            replay_limit=e.replay_limit,
            is_published=e.is_published,
            question_count=len(e.questions),
            created_at=e.created_at,
        )
        for e in rows
    ]


@router.get(
    "/listening/exercises/{exercise_id}",
    response_model=ListeningExerciseStudent,
)
def get_published_exercise(
    exercise_id: str,
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    exercise = _get_exercise(exercise_id, db)
    if not exercise.is_published:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return _student_payload(exercise)


@router.get("/listening/exercises/{exercise_id}/audio")
def get_exercise_audio(
    exercise_id: str,
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    exercise = _get_exercise(exercise_id, db)
    if not exercise.is_published:
        raise HTTPException(status_code=404, detail="Exercise not found")
    path = storage.get_file_path(exercise.audio_filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file is missing from storage")
    return FileResponse(
        path,
        media_type=exercise.audio_content_type,
        filename=f"{exercise.title}{path.suffix}",
    )


@router.post(
    "/listening/attempts",
    response_model=ListeningAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_listening_attempt(
    payload: ListeningAttemptCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    exercise = (
        db.query(ListeningExercise)
        .options(joinedload(ListeningExercise.questions))
        .filter(
            ListeningExercise.id == payload.exercise_id,
            ListeningExercise.is_published.is_(True),
        )
        .first()
    )
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    questions = sorted(exercise.questions, key=lambda q: q.order_index)
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Exercise has no questions",
        )

    results, score = reading_service.score_attempt(questions, payload.answers)
    total = len(questions)
    percentage = round((score / total) * 100, 1) if total else 0.0

    attempt = ListeningAttempt(
        user_id=current_user.id,
        exercise_id=exercise.id,
        exam=exercise.exam,
        exercise_title=exercise.title,
        answers=payload.answers,
        results=results,
        score=score,
        total=total,
        percentage=percentage,
        replays_used=payload.replays_used,
        time_spent_seconds=payload.time_spent_seconds,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return ListeningAttemptResponse(
        id=attempt.id,
        exercise_id=attempt.exercise_id,
        exam=attempt.exam,
        exercise_title=attempt.exercise_title,
        score=attempt.score,
        total=attempt.total,
        percentage=attempt.percentage,
        replays_used=attempt.replays_used,
        time_spent_seconds=attempt.time_spent_seconds,
        results=[ListeningResultItem(**r) for r in results],
        transcript=exercise.transcript,
        vocabulary=_parse_vocab(exercise.vocabulary),
        created_at=attempt.created_at,
    )


@router.get("/listening/attempts", response_model=list[ListeningAttemptSummary])
def list_my_attempts(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return (
        db.query(ListeningAttempt)
        .filter(ListeningAttempt.user_id == current_user.id)
        .order_by(ListeningAttempt.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/listening/attempts/{attempt_id}", response_model=ListeningAttemptResponse)
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
        db.query(ListeningAttempt)
        .filter(
            ListeningAttempt.id == parsed,
            ListeningAttempt.user_id == current_user.id,
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    exercise = None
    if attempt.exercise_id:
        exercise = (
            db.query(ListeningExercise)
            .filter(ListeningExercise.id == attempt.exercise_id)
            .first()
        )

    return ListeningAttemptResponse(
        id=attempt.id,
        exercise_id=attempt.exercise_id,
        exam=attempt.exam,
        exercise_title=attempt.exercise_title,
        score=attempt.score,
        total=attempt.total,
        percentage=attempt.percentage,
        replays_used=attempt.replays_used,
        time_spent_seconds=attempt.time_spent_seconds,
        results=[ListeningResultItem(**r) for r in attempt.results],
        transcript=exercise.transcript if exercise else "",
        vocabulary=_parse_vocab(exercise.vocabulary) if exercise else None,
        created_at=attempt.created_at,
    )
