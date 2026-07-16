import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_student
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.user import User
from app.models.writing import SUPPORTED_TASK_TYPES, WritingAttempt, WritingPrompt
from app.schemas.exam import (
    WritingAttemptCreate,
    WritingAttemptResponse,
    WritingAttemptSummary,
    WritingPromptCreate,
    WritingPromptResponse,
    WritingPromptUpdate,
)
from app.services.llm import LLMError
from app.services import writing as writing_service

router = APIRouter(tags=["writing"])


def _validate_exam_task(exam: str, task_type: str) -> None:
    if exam not in SUPPORTED_EXAMS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"exam must be one of: {', '.join(SUPPORTED_EXAMS)}",
        )
    if task_type not in SUPPORTED_TASK_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"task_type must be one of: {', '.join(SUPPORTED_TASK_TYPES)}",
        )


# ---- Admin: content management ----


@router.get("/admin/writing-prompts", response_model=list[WritingPromptResponse])
def admin_list_prompts(
    exam: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(WritingPrompt).order_by(WritingPrompt.created_at.desc())
    if exam:
        q = q.filter(WritingPrompt.exam == exam)
    return q.all()


@router.post(
    "/admin/writing-prompts",
    response_model=WritingPromptResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_prompt(
    payload: WritingPromptCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _validate_exam_task(payload.exam, payload.task_type)
    prompt = WritingPrompt(
        created_by=current_user.id,
        exam=payload.exam,
        task_type=payload.task_type,
        title=payload.title.strip(),
        prompt_text=payload.prompt_text.strip(),
        topic=(payload.topic or "").strip() or None,
        time_limit_minutes=payload.time_limit_minutes,
        min_words=payload.min_words,
        is_published=payload.is_published,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.patch("/admin/writing-prompts/{prompt_id}", response_model=WritingPromptResponse)
def admin_update_prompt(
    prompt_id: str,
    payload: WritingPromptUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Prompt not found")

    prompt = db.query(WritingPrompt).filter(WritingPrompt.id == parsed).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    data = payload.model_dump(exclude_unset=True)
    if "exam" in data or "task_type" in data:
        _validate_exam_task(
            data.get("exam", prompt.exam),
            data.get("task_type", prompt.task_type),
        )
    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(prompt, key, value)

    db.commit()
    db.refresh(prompt)
    return prompt


@router.delete("/admin/writing-prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_prompt(
    prompt_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Prompt not found")
    prompt = db.query(WritingPrompt).filter(WritingPrompt.id == parsed).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    db.delete(prompt)
    db.commit()
    return None


# ---- Student: practice ----


@router.get("/writing/prompts", response_model=list[WritingPromptResponse])
def list_published_prompts(
    exam: str | None = Query(default=None),
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    q = (
        db.query(WritingPrompt)
        .filter(WritingPrompt.is_published.is_(True))
        .order_by(WritingPrompt.created_at.desc())
    )
    if exam:
        q = q.filter(WritingPrompt.exam == exam)
    return q.all()


@router.get("/writing/prompts/{prompt_id}", response_model=WritingPromptResponse)
def get_published_prompt(
    prompt_id: str,
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Prompt not found")
    prompt = (
        db.query(WritingPrompt)
        .filter(
            WritingPrompt.id == parsed,
            WritingPrompt.is_published.is_(True),
        )
        .first()
    )
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.post(
    "/writing/attempts",
    response_model=WritingAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_writing_attempt(
    payload: WritingAttemptCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    prompt: WritingPrompt | None = None
    if payload.prompt_id:
        prompt = (
            db.query(WritingPrompt)
            .filter(
                WritingPrompt.id == payload.prompt_id,
                WritingPrompt.is_published.is_(True),
            )
            .first()
        )
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        exam = prompt.exam
        task_type = prompt.task_type
        prompt_text = prompt.prompt_text
    else:
        if not payload.exam or not payload.task_type or not payload.prompt_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Custom attempts require exam, task_type, and prompt_text",
            )
        _validate_exam_task(payload.exam, payload.task_type)
        exam = payload.exam
        task_type = payload.task_type
        prompt_text = payload.prompt_text.strip()

    essay = payload.essay_text.strip()
    word_count = writing_service.count_words(essay)

    try:
        feedback = writing_service.score_essay(
            exam=exam,
            task_type=task_type,
            prompt_text=prompt_text,
            essay_text=essay,
        )
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    overall = feedback.get("overall_band")
    try:
        overall_band = float(overall) if overall is not None else None
    except (TypeError, ValueError):
        overall_band = None

    attempt = WritingAttempt(
        user_id=current_user.id,
        prompt_id=prompt.id if prompt else None,
        exam=exam,
        task_type=task_type,
        prompt_text=prompt_text,
        essay_text=essay,
        word_count=word_count,
        time_spent_seconds=payload.time_spent_seconds,
        overall_band=overall_band,
        feedback=feedback,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/writing/attempts", response_model=list[WritingAttemptSummary])
def list_my_attempts(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return (
        db.query(WritingAttempt)
        .filter(WritingAttempt.user_id == current_user.id)
        .order_by(WritingAttempt.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/writing/attempts/{attempt_id}", response_model=WritingAttemptResponse)
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
        db.query(WritingAttempt)
        .filter(
            WritingAttempt.id == parsed,
            WritingAttempt.user_id == current_user.id,
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt
