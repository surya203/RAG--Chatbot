from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_student
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS, ExamProfile
from app.models.user import User
from app.schemas.exam import ExamProfileResponse, ExamProfileUpsert

router = APIRouter(prefix="/exam-profile", tags=["exam-profile"])


@router.get("/me", response_model=ExamProfileResponse | None)
def get_my_exam_profile(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return (
        db.query(ExamProfile)
        .filter(ExamProfile.user_id == current_user.id)
        .first()
    )


@router.put("/me", response_model=ExamProfileResponse)
def upsert_my_exam_profile(
    payload: ExamProfileUpsert,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    if payload.target_exam not in SUPPORTED_EXAMS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"target_exam must be one of: {', '.join(SUPPORTED_EXAMS)}",
        )

    profile = (
        db.query(ExamProfile)
        .filter(ExamProfile.user_id == current_user.id)
        .first()
    )
    if profile:
        profile.target_exam = payload.target_exam
        profile.target_score = payload.target_score
        profile.exam_date = payload.exam_date
    else:
        profile = ExamProfile(
            user_id=current_user.id,
            target_exam=payload.target_exam,
            target_score=payload.target_score,
            exam_date=payload.exam_date,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)
    return profile
