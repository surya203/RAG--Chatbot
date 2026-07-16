from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_student
from app.db.session import get_db
from app.models.exam_profile import ExamProfile
from app.models.user import User
from app.schemas.progress import ProgressDashboard, StudyPlanResponse
from app.services import progress as progress_service

router = APIRouter(prefix="/progress", tags=["progress"])


def _get_profile(user_id, db: Session) -> ExamProfile | None:
    return (
        db.query(ExamProfile)
        .filter(ExamProfile.user_id == user_id)
        .first()
    )


@router.get("/dashboard", response_model=ProgressDashboard)
def get_progress_dashboard(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    profile = _get_profile(current_user.id, db)
    data = progress_service.build_dashboard(db, current_user.id, profile)
    return ProgressDashboard(**data)


@router.get("/study-plan", response_model=StudyPlanResponse)
def get_study_plan(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    profile = _get_profile(current_user.id, db)
    plan = progress_service.build_study_plan_for_user(db, current_user.id, profile)
    return StudyPlanResponse(**plan)
