"""Spaced-repetition scheduling (SM-2 inspired) for vocabulary cards."""

from datetime import datetime, timedelta, timezone

from app.models.vocab import (
    SRS_STATUS_LEARNING,
    SRS_STATUS_MASTERED,
    SRS_STATUS_NEW,
    SRS_STATUS_REVIEW,
    VocabUserProgress,
)

# Student ratings mapped to SM-2 quality (0-5 scale).
RATING_QUALITY = {
    "again": 1,
    "hard": 3,
    "good": 4,
    "easy": 5,
}

VALID_RATINGS = tuple(RATING_QUALITY.keys())

MASTERED_INTERVAL_DAYS = 21
MASTERED_REPETITIONS = 4


def apply_review(
    progress: VocabUserProgress,
    rating: str,
    now: datetime | None = None,
) -> VocabUserProgress:
    """Update progress after a review. Mutates and returns *progress*."""
    if rating not in VALID_RATINGS:
        raise ValueError(f"rating must be one of: {', '.join(VALID_RATINGS)}")

    now = now or datetime.now(timezone.utc)
    quality = RATING_QUALITY[rating]

    progress.total_reviews += 1
    progress.last_reviewed_at = now

    if quality < 3:
        progress.repetitions = 0
        progress.interval_days = 0
        progress.status = SRS_STATUS_LEARNING
        progress.next_review_at = now + timedelta(minutes=10)
    else:
        if progress.repetitions == 0:
            progress.interval_days = 1
        elif progress.repetitions == 1:
            progress.interval_days = 6
        else:
            progress.interval_days = max(
                1, round(progress.interval_days * progress.ease_factor)
            )
        progress.repetitions += 1

        progress.ease_factor = max(
            1.3,
            progress.ease_factor
            + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
        )

        if (
            progress.repetitions >= MASTERED_REPETITIONS
            and progress.interval_days >= MASTERED_INTERVAL_DAYS
        ):
            progress.status = SRS_STATUS_MASTERED
        elif progress.repetitions >= 2:
            progress.status = SRS_STATUS_REVIEW
        else:
            progress.status = SRS_STATUS_LEARNING

        progress.next_review_at = now + timedelta(days=progress.interval_days)

    if progress.status == SRS_STATUS_NEW:
        progress.status = SRS_STATUS_LEARNING

    return progress


def new_progress_defaults(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    return {
        "ease_factor": 2.5,
        "interval_days": 0,
        "repetitions": 0,
        "status": SRS_STATUS_NEW,
        "next_review_at": now,
        "total_reviews": 0,
    }
