"""Score and aggregate full / section mock exam attempts."""

from collections import Counter

from sqlalchemy.orm import Session, joinedload

from app.models.listening import ListeningExercise
from app.models.mock_exam import MockExam
from app.models.reading import ReadingPassage
from app.models.speaking import SpeakingPrompt
from app.models.writing import WritingPrompt
from app.services import reading as reading_service
from app.services.llm import LLMError
from app.services import speaking as speaking_service
from app.services import writing as writing_service

QUESTION_TYPE_LABELS = {
    "true_false_not_given": "True / False / Not Given",
    "yes_no_not_given": "Yes / No / Not Given",
    "multiple_choice": "Multiple choice",
    "matching_headings": "Matching headings",
    "short_answer": "Short answer",
    "fill_blank": "Fill in the blank",
}


def load_mock_content(mock: MockExam, db: Session) -> dict:
    reading = None
    listening = None
    writing = None
    speaking = None

    if mock.reading_passage_id:
        reading = (
            db.query(ReadingPassage)
            .options(joinedload(ReadingPassage.questions))
            .filter(ReadingPassage.id == mock.reading_passage_id)
            .first()
        )
    if mock.listening_exercise_id:
        listening = (
            db.query(ListeningExercise)
            .options(joinedload(ListeningExercise.questions))
            .filter(ListeningExercise.id == mock.listening_exercise_id)
            .first()
        )
    if mock.writing_prompt_id:
        writing = (
            db.query(WritingPrompt)
            .filter(WritingPrompt.id == mock.writing_prompt_id)
            .first()
        )
    if mock.speaking_prompt_id:
        speaking = (
            db.query(SpeakingPrompt)
            .filter(SpeakingPrompt.id == mock.speaking_prompt_id)
            .first()
        )

    return {
        "reading": reading,
        "listening": listening,
        "writing": writing,
        "speaking": speaking,
    }


def _pct_to_band(pct: float | None) -> float | None:
    if pct is None:
        return None
    # Simple IELTS-style mapping from percentage → rough band.
    return round(min(9.0, max(0.0, pct / 12.5)) * 2) / 2


def _weak_topics_from_results(results: list[dict]) -> list[dict]:
    misses: Counter[str] = Counter()
    totals: Counter[str] = Counter()
    for item in results:
        qtype = item.get("question_type", "unknown")
        totals[qtype] += 1
        if not item.get("is_correct"):
            misses[qtype] += 1
    weak: list[dict] = []
    for qtype, miss_count in misses.most_common(4):
        total = totals[qtype]
        if total < 1:
            continue
        rate = round((miss_count / total) * 100, 1)
        if rate < 30:
            continue
        weak.append(
            {
                "area": QUESTION_TYPE_LABELS.get(qtype, qtype.replace("_", " ")),
                "question_type": qtype,
                "miss_rate": rate,
            }
        )
    return weak


def score_mock_attempt(
    mock: MockExam,
    *,
    reading_answers: dict[str, str] | None,
    listening_answers: dict[str, str] | None,
    writing_essay: str | None,
    speaking_transcript: str | None,
    db: Session,
) -> dict:
    content = load_mock_content(mock, db)
    section_results: dict = {}
    skill_bands: list[float] = []
    skill_pcts: list[float] = []
    weak_topics: list[dict] = []

    reading_score = reading_total = None
    reading_percentage = None
    listening_score = listening_total = None
    listening_percentage = None
    writing_band = None
    speaking_band = None
    writing_feedback = None
    speaking_feedback = None

    reading = content["reading"]
    if reading and reading.questions:
        questions = sorted(reading.questions, key=lambda q: q.order_index)
        results, score = reading_service.score_attempt(
            questions, reading_answers or {}
        )
        total = len(questions)
        reading_score = score
        reading_total = total
        reading_percentage = round((score / total) * 100, 1) if total else 0.0
        section_results["reading"] = results
        skill_pcts.append(reading_percentage)
        band = _pct_to_band(reading_percentage)
        if band is not None:
            skill_bands.append(band)
        weak_topics.extend(_weak_topics_from_results(results))

    listening = content["listening"]
    if listening and listening.questions:
        questions = sorted(listening.questions, key=lambda q: q.order_index)
        results, score = reading_service.score_attempt(
            questions, listening_answers or {}
        )
        total = len(questions)
        listening_score = score
        listening_total = total
        listening_percentage = round((score / total) * 100, 1) if total else 0.0
        section_results["listening"] = results
        skill_pcts.append(listening_percentage)
        band = _pct_to_band(listening_percentage)
        if band is not None:
            skill_bands.append(band)
        weak_topics.extend(_weak_topics_from_results(results))

    writing = content["writing"]
    essay = (writing_essay or "").strip()
    if writing and essay:
        try:
            writing_feedback = writing_service.score_essay(
                exam=writing.exam,
                task_type=writing.task_type,
                prompt_text=writing.prompt_text,
                essay_text=essay,
            )
            overall = writing_feedback.get("overall_band")
            writing_band = float(overall) if overall is not None else None
            if writing_band is not None:
                skill_bands.append(writing_band)
                skill_pcts.append(min(100.0, writing_band / 9.0 * 100))
            section_results["writing"] = writing_feedback
        except LLMError as exc:
            section_results["writing"] = {"error": str(exc)}
    elif writing:
        section_results["writing"] = {"skipped": True}

    speaking = content["speaking"]
    transcript = (speaking_transcript or "").strip()
    if speaking and transcript:
        try:
            speaking_feedback = speaking_service.score_speaking(
                exam=speaking.exam,
                task_type=speaking.task_type,
                prompt_text=speaking.prompt_text,
                transcript=transcript,
            )
            overall = speaking_feedback.get("overall_band")
            speaking_band = float(overall) if overall is not None else None
            if speaking_band is not None:
                skill_bands.append(speaking_band)
                skill_pcts.append(min(100.0, speaking_band / 9.0 * 100))
            section_results["speaking"] = speaking_feedback
        except LLMError as exc:
            section_results["speaking"] = {"error": str(exc)}
    elif speaking:
        section_results["speaking"] = {"skipped": True}

    overall_band = (
        round(sum(skill_bands) / len(skill_bands) * 2) / 2 if skill_bands else None
    )
    overall_percentage = (
        round(sum(skill_pcts) / len(skill_pcts), 1) if skill_pcts else None
    )
    # Leaderboard points: 0–1000 style from overall percentage (or band).
    if overall_percentage is not None:
        points = int(round(overall_percentage * 10))
    elif overall_band is not None:
        points = int(round(overall_band / 9.0 * 1000))
    else:
        points = 0

    # Deduplicate weak topics by question_type keeping highest miss rate.
    by_type: dict[str, dict] = {}
    for w in weak_topics:
        q = w["question_type"]
        if q not in by_type or w["miss_rate"] > by_type[q]["miss_rate"]:
            by_type[q] = w

    return {
        "reading_score": reading_score,
        "reading_total": reading_total,
        "reading_percentage": reading_percentage,
        "listening_score": listening_score,
        "listening_total": listening_total,
        "listening_percentage": listening_percentage,
        "writing_band": writing_band,
        "speaking_band": speaking_band,
        "section_results": section_results,
        "weak_topics": list(by_type.values())[:4],
        "overall_band": overall_band,
        "overall_percentage": overall_percentage,
        "points": points,
    }
