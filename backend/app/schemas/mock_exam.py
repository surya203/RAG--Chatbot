from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.mock_exam import MOCK_MODES


class MockExamCreate(BaseModel):
    exam: str
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    mode: str = "full"
    total_time_minutes: int = Field(default=60, ge=10, le=300)
    reading_passage_id: UUID | None = None
    listening_exercise_id: UUID | None = None
    writing_prompt_id: UUID | None = None
    speaking_prompt_id: UUID | None = None
    is_published: bool = True


class MockExamUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    mode: str | None = None
    total_time_minutes: int | None = Field(default=None, ge=10, le=300)
    reading_passage_id: UUID | None = None
    listening_exercise_id: UUID | None = None
    writing_prompt_id: UUID | None = None
    speaking_prompt_id: UUID | None = None
    is_published: bool | None = None


class MockExamSummary(BaseModel):
    id: UUID
    exam: str
    title: str
    description: str | None
    mode: str
    total_time_minutes: int
    has_reading: bool
    has_listening: bool
    has_writing: bool
    has_speaking: bool
    is_published: bool
    created_at: datetime


class MockSectionReading(BaseModel):
    id: UUID
    title: str
    passage_text: str
    topic: str | None
    strategy_tip: str | None
    questions: list[dict]


class MockSectionListening(BaseModel):
    id: UUID
    title: str
    topic: str | None
    strategy_tip: str | None
    replay_limit: int
    questions: list[dict]


class MockSectionWriting(BaseModel):
    id: UUID
    title: str
    task_type: str
    prompt_text: str
    topic: str | None
    min_words: int | None


class MockSectionSpeaking(BaseModel):
    id: UUID
    title: str
    task_type: str
    prompt_text: str
    cue_points: str | None
    prep_seconds: int
    speak_seconds: int


class MockExamStudent(BaseModel):
    id: UUID
    exam: str
    title: str
    description: str | None
    mode: str
    total_time_minutes: int
    reading: MockSectionReading | None
    listening: MockSectionListening | None
    writing: MockSectionWriting | None
    speaking: MockSectionSpeaking | None
    created_at: datetime


class MockExamAdmin(BaseModel):
    id: UUID
    exam: str
    title: str
    description: str | None
    mode: str
    total_time_minutes: int
    reading_passage_id: UUID | None
    listening_exercise_id: UUID | None
    writing_prompt_id: UUID | None
    speaking_prompt_id: UUID | None
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MockAttemptCreate(BaseModel):
    mock_exam_id: UUID
    reading_answers: dict[str, str] | None = None
    listening_answers: dict[str, str] | None = None
    writing_essay: str | None = None
    speaking_transcript: str | None = None
    time_spent_seconds: int | None = Field(default=None, ge=0)


class MockAttemptSummary(BaseModel):
    id: UUID
    mock_title: str
    exam: str
    overall_band: float | None
    overall_percentage: float | None
    points: int
    reading_percentage: float | None
    listening_percentage: float | None
    writing_band: float | None
    speaking_band: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MockAttemptResponse(BaseModel):
    id: UUID
    mock_exam_id: UUID | None
    exam: str
    mock_title: str
    reading_score: int | None
    reading_total: int | None
    reading_percentage: float | None
    listening_score: int | None
    listening_total: int | None
    listening_percentage: float | None
    writing_band: float | None
    speaking_band: float | None
    section_results: dict | None
    weak_topics: list[dict] | None
    overall_band: float | None
    overall_percentage: float | None
    points: int
    time_spent_seconds: int | None
    previous_attempt: MockAttemptSummary | None = None
    created_at: datetime


class ExamLeaderboardEntry(BaseModel):
    rank: int
    name: str
    exam: str
    best_overall_band: float | None
    best_percentage: float | None
    total_points: int
    mock_attempts: int
    writing_avg_band: float | None = None
    avg_mock_band: float | None = None


VALID_MODES = MOCK_MODES
