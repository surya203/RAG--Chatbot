from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class QuizGenerateRequest(BaseModel):
    question_type: str = "mcq"
    difficulty: str = "medium"
    num_questions: int = Field(default=10, ge=1, le=20)


class QuizQuestionPublic(BaseModel):
    id: str
    type: str
    difficulty: str
    question: str
    options: list[str]


class QuizResponse(BaseModel):
    id: UUID
    document_id: UUID
    title: str
    question_type: str
    difficulty: str
    created_at: datetime
    questions: list[QuizQuestionPublic]


class QuizSummary(BaseModel):
    id: UUID
    title: str
    question_type: str
    difficulty: str
    num_questions: int
    created_at: datetime


class QuizAttemptRequest(BaseModel):
    answers: dict[str, str]


class QuizResultItem(BaseModel):
    question_id: str
    type: str
    question: str
    options: list[str]
    your_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str


class QuizAttemptResult(BaseModel):
    score: int
    total: int
    percentage: float
    points: int
    results: list[QuizResultItem]


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    points: int
    attempts: int
    avg_percentage: float
