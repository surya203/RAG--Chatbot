from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.writing import SUPPORTED_TASK_TYPES


class ExamProfileUpsert(BaseModel):
    target_exam: str = Field(..., description="One of: " + ", ".join(SUPPORTED_EXAMS))
    target_score: str | None = Field(default=None, max_length=20)
    exam_date: date | None = None


class ExamProfileResponse(BaseModel):
    id: UUID
    target_exam: str
    target_score: str | None
    exam_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WritingPromptCreate(BaseModel):
    exam: str
    task_type: str
    title: str = Field(min_length=1, max_length=255)
    prompt_text: str = Field(min_length=10)
    topic: str | None = Field(default=None, max_length=120)
    time_limit_minutes: int = Field(default=40, ge=5, le=90)
    min_words: int | None = Field(default=None, ge=50, le=500)
    is_published: bool = True


class WritingPromptUpdate(BaseModel):
    exam: str | None = None
    task_type: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    prompt_text: str | None = Field(default=None, min_length=10)
    topic: str | None = Field(default=None, max_length=120)
    time_limit_minutes: int | None = Field(default=None, ge=5, le=90)
    min_words: int | None = Field(default=None, ge=50, le=500)
    is_published: bool | None = None


class WritingPromptResponse(BaseModel):
    id: UUID
    exam: str
    task_type: str
    title: str
    prompt_text: str
    topic: str | None
    time_limit_minutes: int
    min_words: int | None
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WritingAttemptCreate(BaseModel):
    prompt_id: UUID | None = None
    # Required when prompt_id is omitted (custom prompt).
    exam: str | None = None
    task_type: str | None = None
    prompt_text: str | None = Field(default=None, min_length=10)
    essay_text: str = Field(min_length=30)
    time_spent_seconds: int | None = Field(default=None, ge=0)


class CriterionScore(BaseModel):
    score: float
    feedback: str


class WritingFeedback(BaseModel):
    overall_band: float
    criteria: dict[str, CriterionScore]
    strengths: list[str]
    improvements: list[str]
    improved_paragraph: str
    disclaimer: str = (
        "AI band estimates are guidance for practice only and are not official exam scores."
    )


class WritingAttemptResponse(BaseModel):
    id: UUID
    prompt_id: UUID | None
    exam: str
    task_type: str
    prompt_text: str
    essay_text: str
    word_count: int
    time_spent_seconds: int | None
    overall_band: float | None
    feedback: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WritingAttemptSummary(BaseModel):
    id: UUID
    exam: str
    task_type: str
    prompt_text: str
    word_count: int
    overall_band: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# Re-export for validation helpers
VALID_EXAMS = SUPPORTED_EXAMS
VALID_TASK_TYPES = SUPPORTED_TASK_TYPES
