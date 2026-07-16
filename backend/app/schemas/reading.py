from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.reading import DIFFICULTIES, SUPPORTED_READING_QTYPES


class ReadingQuestionInput(BaseModel):
    question_type: str
    question_text: str = Field(min_length=3)
    options: list[str] | None = None
    correct_answer: str = Field(min_length=1, max_length=500)
    explanation: str | None = None
    order_index: int = 0


class ReadingPassageCreate(BaseModel):
    exam: str
    title: str = Field(min_length=1, max_length=255)
    passage_text: str = Field(min_length=50)
    topic: str | None = Field(default=None, max_length=120)
    difficulty: str = "medium"
    time_limit_minutes: int = Field(default=20, ge=5, le=90)
    strategy_tip: str | None = None
    is_published: bool = True
    questions: list[ReadingQuestionInput] = Field(min_length=1)


class ReadingPassageUpdate(BaseModel):
    exam: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    passage_text: str | None = Field(default=None, min_length=50)
    topic: str | None = Field(default=None, max_length=120)
    difficulty: str | None = None
    time_limit_minutes: int | None = Field(default=None, ge=5, le=90)
    strategy_tip: str | None = None
    is_published: bool | None = None
    questions: list[ReadingQuestionInput] | None = None


class ReadingQuestionPublic(BaseModel):
    id: UUID
    order_index: int
    question_type: str
    question_text: str
    options: list[str] | None = None

    model_config = {"from_attributes": True}


class ReadingQuestionAdmin(ReadingQuestionPublic):
    correct_answer: str
    explanation: str | None = None


class ReadingPassageSummary(BaseModel):
    id: UUID
    exam: str
    title: str
    topic: str | None
    difficulty: str
    time_limit_minutes: int
    is_published: bool
    question_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ReadingPassageStudent(BaseModel):
    id: UUID
    exam: str
    title: str
    passage_text: str
    topic: str | None
    difficulty: str
    time_limit_minutes: int
    strategy_tip: str | None
    questions: list[ReadingQuestionPublic]
    created_at: datetime


class ReadingPassageAdmin(BaseModel):
    id: UUID
    exam: str
    title: str
    passage_text: str
    topic: str | None
    difficulty: str
    time_limit_minutes: int
    strategy_tip: str | None
    is_published: bool
    questions: list[ReadingQuestionAdmin]
    created_at: datetime
    updated_at: datetime


class ReadingAttemptCreate(BaseModel):
    passage_id: UUID
    answers: dict[str, str]  # question_id -> answer
    time_spent_seconds: int | None = Field(default=None, ge=0)


class ReadingResultItem(BaseModel):
    question_id: str
    question_type: str
    question_text: str
    your_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str | None = None


class ReadingAttemptResponse(BaseModel):
    id: UUID
    passage_id: UUID | None
    exam: str
    passage_title: str
    score: int
    total: int
    percentage: float
    time_spent_seconds: int | None
    results: list[ReadingResultItem]
    created_at: datetime

    model_config = {"from_attributes": True}


class ReadingAttemptSummary(BaseModel):
    id: UUID
    passage_title: str
    exam: str
    score: int
    total: int
    percentage: float
    created_at: datetime

    model_config = {"from_attributes": True}


VALID_QTYPES = SUPPORTED_READING_QTYPES
VALID_DIFFICULTIES = DIFFICULTIES
