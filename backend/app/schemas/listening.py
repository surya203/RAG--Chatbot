from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.listening import SUPPORTED_LISTENING_QTYPES
from app.models.reading import DIFFICULTIES


class VocabItem(BaseModel):
    word: str
    definition: str


class ListeningQuestionInput(BaseModel):
    question_type: str
    question_text: str = Field(min_length=3)
    options: list[str] | None = None
    correct_answer: str = Field(min_length=1, max_length=500)
    explanation: str | None = None
    order_index: int = 0


class ListeningQuestionPublic(BaseModel):
    id: UUID
    order_index: int
    question_type: str
    question_text: str
    options: list[str] | None = None

    model_config = {"from_attributes": True}


class ListeningQuestionAdmin(ListeningQuestionPublic):
    correct_answer: str
    explanation: str | None = None


class ListeningExerciseSummary(BaseModel):
    id: UUID
    exam: str
    title: str
    topic: str | None
    difficulty: str
    time_limit_minutes: int
    replay_limit: int
    is_published: bool
    question_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ListeningExerciseStudent(BaseModel):
    id: UUID
    exam: str
    title: str
    topic: str | None
    difficulty: str
    time_limit_minutes: int
    replay_limit: int
    strategy_tip: str | None
    questions: list[ListeningQuestionPublic]
    created_at: datetime


class ListeningExerciseAdmin(BaseModel):
    id: UUID
    exam: str
    title: str
    audio_content_type: str
    transcript: str
    vocabulary: list[VocabItem] | None
    topic: str | None
    difficulty: str
    time_limit_minutes: int
    replay_limit: int
    strategy_tip: str | None
    is_published: bool
    questions: list[ListeningQuestionAdmin]
    created_at: datetime
    updated_at: datetime


class ListeningAttemptCreate(BaseModel):
    exercise_id: UUID
    answers: dict[str, str]
    replays_used: int = Field(default=0, ge=0)
    time_spent_seconds: int | None = Field(default=None, ge=0)


class ListeningResultItem(BaseModel):
    question_id: str
    question_type: str
    question_text: str
    your_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str | None = None


class ListeningAttemptResponse(BaseModel):
    id: UUID
    exercise_id: UUID | None
    exam: str
    exercise_title: str
    score: int
    total: int
    percentage: float
    replays_used: int
    time_spent_seconds: int | None
    results: list[ListeningResultItem]
    transcript: str
    vocabulary: list[VocabItem] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ListeningAttemptSummary(BaseModel):
    id: UUID
    exercise_title: str
    exam: str
    score: int
    total: int
    percentage: float
    created_at: datetime

    model_config = {"from_attributes": True}


VALID_QTYPES = SUPPORTED_LISTENING_QTYPES
VALID_DIFFICULTIES = DIFFICULTIES
