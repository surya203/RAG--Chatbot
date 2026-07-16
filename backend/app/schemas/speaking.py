from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.speaking import SUPPORTED_SPEAKING_TASKS


class SpeakingPromptCreate(BaseModel):
    exam: str
    task_type: str
    title: str = Field(min_length=1, max_length=255)
    prompt_text: str = Field(min_length=10)
    cue_points: str | None = None
    model_answer: str | None = None
    topic: str | None = Field(default=None, max_length=120)
    prep_seconds: int = Field(default=0, ge=0, le=300)
    speak_seconds: int = Field(default=120, ge=20, le=600)
    is_published: bool = True


class SpeakingPromptUpdate(BaseModel):
    exam: str | None = None
    task_type: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    prompt_text: str | None = Field(default=None, min_length=10)
    cue_points: str | None = None
    model_answer: str | None = None
    topic: str | None = Field(default=None, max_length=120)
    prep_seconds: int | None = Field(default=None, ge=0, le=300)
    speak_seconds: int | None = Field(default=None, ge=20, le=600)
    is_published: bool | None = None


class SpeakingPromptResponse(BaseModel):
    id: UUID
    exam: str
    task_type: str
    title: str
    prompt_text: str
    cue_points: str | None
    model_answer: str | None
    topic: str | None
    prep_seconds: int
    speak_seconds: int
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SpeakingAttemptCreate(BaseModel):
    prompt_id: UUID | None = None
    exam: str | None = None
    task_type: str | None = None
    prompt_text: str | None = Field(default=None, min_length=10)
    transcript: str = Field(min_length=10)
    duration_seconds: int | None = Field(default=None, ge=0)


class SpeakingAttemptResponse(BaseModel):
    id: UUID
    prompt_id: UUID | None
    exam: str
    task_type: str
    prompt_text: str
    transcript: str
    duration_seconds: int | None
    overall_band: float | None
    feedback: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SpeakingAttemptSummary(BaseModel):
    id: UUID
    exam: str
    task_type: str
    prompt_text: str
    overall_band: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


VALID_EXAMS = SUPPORTED_EXAMS
VALID_SPEAKING_TASKS = SUPPORTED_SPEAKING_TASKS
