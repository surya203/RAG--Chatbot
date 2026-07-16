from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.vocab import VOCAB_TOPICS


class VocabCardInput(BaseModel):
    exam: str
    topic: str = "general"
    word: str = Field(min_length=1, max_length=120)
    definition: str = Field(min_length=1)
    example_sentence: str | None = None
    collocations: list[str] | None = None
    is_published: bool = True


class VocabCardAdmin(BaseModel):
    id: UUID
    exam: str
    topic: str
    word: str
    definition: str
    example_sentence: str | None
    collocations: list[str] | None
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VocabCardSummary(BaseModel):
    id: UUID
    exam: str
    topic: str
    word: str
    definition: str
    example_sentence: str | None
    is_published: bool
    in_my_deck: bool = False
    status: str | None = None
    next_review_at: datetime | None = None


class VocabReviewCard(BaseModel):
    progress_id: UUID
    card_id: UUID
    word: str
    definition: str
    example_sentence: str | None
    collocations: list[str] | None
    topic: str
    status: str
    repetitions: int
    due: bool


class VocabReviewRequest(BaseModel):
    progress_id: UUID
    rating: str = Field(description="again | hard | good | easy")


class VocabReviewResponse(BaseModel):
    progress_id: UUID
    card_id: UUID
    status: str
    interval_days: int
    next_review_at: datetime
    repetitions: int


class VocabStats(BaseModel):
    learning: int
    due: int
    mastered: int
    reviews_today: int
    streak_days: int


class VocabCardPatch(BaseModel):
    is_published: bool | None = None
    definition: str | None = None
    example_sentence: str | None = None


class VocabEnrollRequest(BaseModel):
    topic: str | None = None
    card_ids: list[UUID] | None = None


class VocabEnrollResponse(BaseModel):
    enrolled: int
    skipped: int


VALID_TOPICS = VOCAB_TOPICS
