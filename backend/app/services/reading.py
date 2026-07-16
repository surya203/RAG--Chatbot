"""Objective scoring for reading practice attempts."""

from app.models.reading import ReadingQuestion


def _normalize(value: str) -> str:
    return " ".join(value.strip().lower().split())


def answers_match(given: str, correct: str, question_type: str) -> bool:
    g = _normalize(given)
    c = _normalize(correct)
    if not g:
        return False
    # Allow alternate answers separated by "|" in the key (e.g. "false|f").
    accepted = [_normalize(part) for part in correct.split("|") if part.strip()]
    if g in accepted:
        return True
    # Soft match for short answers / fill blanks.
    if question_type in {"short_answer", "fill_blank"}:
        return g == c or g in c or c in g
    return g == c


def score_attempt(
    questions: list[ReadingQuestion],
    answers: dict[str, str],
) -> tuple[list[dict], int]:
    """Return (results, score)."""
    results: list[dict] = []
    score = 0
    for q in questions:
        qid = str(q.id)
        your = (answers.get(qid) or "").strip()
        correct = q.correct_answer
        ok = answers_match(your, correct, q.question_type)
        if ok:
            score += 1
        results.append(
            {
                "question_id": qid,
                "question_type": q.question_type,
                "question_text": q.question_text,
                "your_answer": your,
                "correct_answer": correct.split("|")[0].strip(),
                "is_correct": ok,
                "explanation": q.explanation,
            }
        )
    return results, score
