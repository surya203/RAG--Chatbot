import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_student
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.speaking import SUPPORTED_SPEAKING_TASKS, SpeakingAttempt, SpeakingPrompt
from app.models.user import User
from app.schemas.speaking import (
    SpeakingAttemptCreate,
    SpeakingAttemptResponse,
    SpeakingAttemptSummary,
    SpeakingPromptCreate,
    SpeakingPromptResponse,
    SpeakingPromptUpdate,
)
from app.services.llm import LLMError
from app.services import speaking as speaking_service

router = APIRouter(tags=["speaking"])


def _validate(exam: str, task_type: str) -> None:
    if exam not in SUPPORTED_EXAMS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"exam must be one of: {', '.join(SUPPORTED_EXAMS)}",
        )
    if task_type not in SUPPORTED_SPEAKING_TASKS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"task_type must be one of: {', '.join(SUPPORTED_SPEAKING_TASKS)}",
        )


# ---- Admin ----


@router.get("/admin/speaking-prompts", response_model=list[SpeakingPromptResponse])
def admin_list_prompts(
    exam: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(SpeakingPrompt).order_by(SpeakingPrompt.created_at.desc())
    if exam:
        q = q.filter(SpeakingPrompt.exam == exam)
    return q.all()


@router.post(
    "/admin/speaking-prompts",
    response_model=SpeakingPromptResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_prompt(
    payload: SpeakingPromptCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _validate(payload.exam, payload.task_type)
    prompt = SpeakingPrompt(
        created_by=current_user.id,
        exam=payload.exam,
        task_type=payload.task_type,
        title=payload.title.strip(),
        prompt_text=payload.prompt_text.strip(),
        cue_points=(payload.cue_points or "").strip() or None,
        model_answer=(payload.model_answer or "").strip() or None,
        topic=(payload.topic or "").strip() or None,
        prep_seconds=payload.prep_seconds,
        speak_seconds=payload.speak_seconds,
        is_published=payload.is_published,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.patch("/admin/speaking-prompts/{prompt_id}", response_model=SpeakingPromptResponse)
def admin_update_prompt(
    prompt_id: str,
    payload: SpeakingPromptUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Prompt not found")
    prompt = db.query(SpeakingPrompt).filter(SpeakingPrompt.id == parsed).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    data = payload.model_dump(exclude_unset=True)
    if "exam" in data or "task_type" in data:
        _validate(data.get("exam", prompt.exam), data.get("task_type", prompt.task_type))
    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip() or None if key in {"cue_points", "model_answer", "topic"} else value.strip()
        setattr(prompt, key, value)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.delete("/admin/speaking-prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_prompt(
    prompt_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Prompt not found")
    prompt = db.query(SpeakingPrompt).filter(SpeakingPrompt.id == parsed).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    db.delete(prompt)
    db.commit()
    return None


# ---- Student ----


@router.get("/speaking/prompts", response_model=list[SpeakingPromptResponse])
def list_published_prompts(
    exam: str | None = Query(default=None),
    _: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    q = (
        db.query(SpeakingPrompt)
        .filter(SpeakingPrompt.is_published.is_(True))
        .order_by(SpeakingPrompt.created_at.desc())
    )
    if exam:
        q = q.filter(SpeakingPrompt.exam == exam)
    return q.all()


@router.get("/speaking/prompts/{prompt_id}", response_model=SpeakingPromptResponse)
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
        db.query(SpeakingPrompt)
        .filter(SpeakingPrompt.id == parsed, SpeakingPrompt.is_published.is_(True))
        .first()
    )
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.post(
    "/speaking/attempts",
    response_model=SpeakingAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_speaking_attempt(
    payload: SpeakingAttemptCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    prompt: SpeakingPrompt | None = None
    if payload.prompt_id:
        prompt = (
            db.query(SpeakingPrompt)
            .filter(
                SpeakingPrompt.id == payload.prompt_id,
                SpeakingPrompt.is_published.is_(True),
            )
            .first()
        )
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        exam = prompt.exam
        task_type = prompt.task_type
        prompt_text = prompt.prompt_text
        if prompt.cue_points:
            prompt_text = f"{prompt_text}\n\nYou should say:\n{prompt.cue_points}"
    else:
        if not payload.exam or not payload.task_type or not payload.prompt_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Custom attempts require exam, task_type, and prompt_text",
            )
        _validate(payload.exam, payload.task_type)
        exam = payload.exam
        task_type = payload.task_type
        prompt_text = payload.prompt_text.strip()

    transcript = payload.transcript.strip()
    try:
        feedback = speaking_service.score_speaking(
            exam=exam,
            task_type=task_type,
            prompt_text=prompt_text,
            transcript=transcript,
            duration_seconds=payload.duration_seconds,
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

    attempt = SpeakingAttempt(
        user_id=current_user.id,
        prompt_id=prompt.id if prompt else None,
        exam=exam,
        task_type=task_type,
        prompt_text=prompt_text,
        transcript=transcript,
        duration_seconds=payload.duration_seconds,
        overall_band=overall_band,
        feedback=feedback,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/speaking/attempts", response_model=list[SpeakingAttemptSummary])
def list_my_attempts(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return (
        db.query(SpeakingAttempt)
        .filter(SpeakingAttempt.user_id == current_user.id)
        .order_by(SpeakingAttempt.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/speaking/attempts/{attempt_id}", response_model=SpeakingAttemptResponse)
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
        db.query(SpeakingAttempt)
        .filter(
            SpeakingAttempt.id == parsed,
            SpeakingAttempt.user_id == current_user.id,
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt
