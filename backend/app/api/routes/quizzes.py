import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import storage
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.quiz import Quiz, QuizAttempt
from app.models.user import User
from app.schemas.quiz import (
    LeaderboardEntry,
    QuizAttemptRequest,
    QuizAttemptResult,
    QuizGenerateRequest,
    QuizQuestionPublic,
    QuizResponse,
    QuizResultItem,
    QuizSummary,
)
from app.services.extraction import clean_text, extract_text
from app.services import quiz as quiz_service

router = APIRouter(tags=["quiz"])


def _owned_document(doc_id: str, user: User, db: Session) -> Document:
    try:
        parsed = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    doc = db.query(Document).filter(Document.id == parsed, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


def _owned_quiz(quiz_id: str, user: User, db: Session) -> Quiz:
    try:
        parsed = uuid.UUID(quiz_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    quiz = db.query(Quiz).filter(Quiz.id == parsed, Quiz.user_id == user.id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return quiz


def _public_questions(quiz: Quiz) -> list[QuizQuestionPublic]:
    # Never expose answers/explanations until the attempt is scored.
    return [
        QuizQuestionPublic(
            id=q["id"],
            type=q["type"],
            difficulty=q["difficulty"],
            question=q["question"],
            options=q.get("options", []),
        )
        for q in quiz.questions
    ]


def _to_response(quiz: Quiz) -> QuizResponse:
    return QuizResponse(
        id=quiz.id,
        document_id=quiz.document_id,
        title=quiz.title,
        question_type=quiz.question_type,
        difficulty=quiz.difficulty,
        created_at=quiz.created_at,
        questions=_public_questions(quiz),
    )


@router.post("/documents/{doc_id}/quizzes", response_model=QuizResponse, status_code=201)
def create_quiz(
    doc_id: str,
    payload: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _owned_document(doc_id, current_user, db)

    path = storage.get_file_path(doc.stored_filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File is missing from storage")
    text = clean_text(extract_text(path))
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No extractable text found (the PDF may be scanned images).",
        )

    try:
        questions = quiz_service.generate_quiz(
            doc.original_name,
            text,
            payload.question_type,
            payload.difficulty,
            payload.num_questions,
        )
    except quiz_service.QuizGenerationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 - LLM/config errors
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    quiz = Quiz(
        document_id=doc.id,
        user_id=current_user.id,
        title=f"{doc.original_name} · {payload.question_type} · {payload.difficulty}",
        question_type=payload.question_type,
        difficulty=payload.difficulty,
        questions=questions,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return _to_response(quiz)


@router.get("/documents/{doc_id}/quizzes", response_model=list[QuizSummary])
def list_quizzes(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _owned_document(doc_id, current_user, db)
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.document_id == doc.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    return [
        QuizSummary(
            id=q.id,
            title=q.title,
            question_type=q.question_type,
            difficulty=q.difficulty,
            num_questions=len(q.questions),
            created_at=q.created_at,
        )
        for q in quizzes
    ]


@router.get("/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _to_response(_owned_quiz(quiz_id, current_user, db))


@router.post("/quizzes/{quiz_id}/attempt", response_model=QuizAttemptResult)
def submit_attempt(
    quiz_id: str,
    payload: QuizAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = _owned_quiz(quiz_id, current_user, db)

    results, score, points = quiz_service.score_attempt(
        quiz.questions, payload.answers, quiz.difficulty
    )
    total = len(quiz.questions)
    percentage = round((score / total) * 100, 1) if total else 0.0

    db.add(
        QuizAttempt(
            quiz_id=quiz.id,
            user_id=current_user.id,
            score=score,
            total=total,
            points=points,
            difficulty=quiz.difficulty,
        )
    )
    db.commit()

    return QuizAttemptResult(
        score=score,
        total=total,
        percentage=percentage,
        points=points,
        results=[QuizResultItem(**r) for r in results],
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rank users by total quiz points (correct answers x difficulty weight)."""
    rows = (
        db.query(
            User.full_name,
            User.email,
            func.coalesce(func.sum(QuizAttempt.points), 0).label("points"),
            func.count(QuizAttempt.id).label("attempts"),
            func.coalesce(
                func.avg(QuizAttempt.score * 100.0 / func.nullif(QuizAttempt.total, 0)),
                0,
            ).label("avg_pct"),
        )
        .join(QuizAttempt, QuizAttempt.user_id == User.id)
        .group_by(User.id)
        .order_by(func.sum(QuizAttempt.points).desc())
        .limit(50)
        .all()
    )
    return [
        LeaderboardEntry(
            rank=i + 1,
            name=row.full_name or row.email,
            points=int(row.points),
            attempts=int(row.attempts),
            avg_percentage=round(float(row.avg_pct), 1),
        )
        for i, row in enumerate(rows)
    ]
