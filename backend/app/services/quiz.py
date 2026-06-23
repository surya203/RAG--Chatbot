"""AI quiz generation and scoring (Phase 6)."""

import re

from app.core.config import settings
from app.models.quiz import (
    DIFFICULTY_WEIGHTS,
    TYPE_FILL_BLANK,
    TYPE_MCQ,
    TYPE_MIXED,
    TYPE_TRUE_FALSE,
)
from app.services.llm import complete_json

VALID_TYPES = {TYPE_MCQ, TYPE_TRUE_FALSE, TYPE_FILL_BLANK, TYPE_MIXED}
VALID_DIFFICULTIES = set(DIFFICULTY_WEIGHTS)

SYSTEM_PROMPT = (
    "You are an expert exam author. You create accurate quiz questions strictly "
    "grounded in the provided document text. Always respond with a single JSON "
    "object and nothing else."
)

_TYPE_INSTRUCTIONS = {
    TYPE_MCQ: (
        'multiple-choice questions. Each question object must have: "type":"mcq", '
        '"question" (string), "options" (array of exactly 4 distinct strings), '
        '"answer" (string exactly equal to the correct option), "explanation" (string).'
    ),
    TYPE_TRUE_FALSE: (
        'true/false questions. Each object: "type":"true_false", "question" (a '
        'statement), "options":["True","False"], "answer" ("True" or "False"), '
        '"explanation" (string).'
    ),
    TYPE_FILL_BLANK: (
        'fill-in-the-blank questions. Each object: "type":"fill_blank", "question" '
        '(a sentence containing "____" where the blank is), "options":[], "answer" '
        "(the missing word or short phrase), \"explanation\" (string)."
    ),
    TYPE_MIXED: (
        "a mix of multiple-choice, true/false, and fill-in-the-blank questions. "
        "Use the field shapes described for each: mcq has 4 options; true_false has "
        'options ["True","False"]; fill_blank has "____" in the question and empty '
        'options. Every object needs "type", "question", "options", "answer", '
        '"explanation".'
    ),
}


class QuizGenerationError(RuntimeError):
    pass


def generate_quiz(
    document_name: str,
    text: str,
    question_type: str,
    difficulty: str,
    num_questions: int,
) -> list[dict]:
    """Generate and validate a list of quiz questions from document text."""
    if question_type not in VALID_TYPES:
        raise QuizGenerationError(f"Unsupported question type: {question_type}")
    if difficulty not in VALID_DIFFICULTIES:
        raise QuizGenerationError(f"Unsupported difficulty: {difficulty}")

    snippet = text[: settings.SUMMARY_MAX_INPUT_CHARS]
    user_prompt = (
        f'Document title: "{document_name}"\n\n'
        f"Create exactly {num_questions} {difficulty}-difficulty "
        f"{_TYPE_INSTRUCTIONS[question_type]}\n\n"
        'Return JSON shaped as {"questions": [ ... ]}. Base every question only on '
        "the document text below.\n\n"
        f"--- DOCUMENT TEXT ---\n{snippet}"
    )

    data = complete_json(SYSTEM_PROMPT, user_prompt, max_tokens=4096)
    raw = data.get("questions")
    if not isinstance(raw, list) or not raw:
        raise QuizGenerationError("The model did not return any questions.")

    questions = _normalize(raw, difficulty)[:num_questions]
    if not questions:
        raise QuizGenerationError("No valid questions could be generated.")
    return questions


def _normalize(raw: list, difficulty: str) -> list[dict]:
    out: list[dict] = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        qtype = item.get("type")
        question = (item.get("question") or "").strip()
        answer = str(item.get("answer", "")).strip()
        explanation = (item.get("explanation") or "").strip()
        options = item.get("options") or []
        if not question or not answer or qtype not in {
            TYPE_MCQ,
            TYPE_TRUE_FALSE,
            TYPE_FILL_BLANK,
        }:
            continue

        if qtype == TYPE_MCQ:
            options = [str(o).strip() for o in options if str(o).strip()]
            if len(options) < 2 or answer not in options:
                continue
        elif qtype == TYPE_TRUE_FALSE:
            options = ["True", "False"]
            answer = "True" if answer.lower().startswith("t") else "False"
        else:  # fill_blank
            options = []

        out.append(
            {
                "id": f"q{i}",
                "type": qtype,
                "difficulty": difficulty,
                "question": question,
                "options": options,
                "answer": answer,
                "explanation": explanation,
            }
        )
    return out


def _normalize_text(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^\w\s]", "", value)  # drop punctuation
    return re.sub(r"\s+", " ", value)


def is_correct(question: dict, user_answer: str) -> bool:
    given = (user_answer or "").strip()
    correct = question["answer"]
    if question["type"] == TYPE_FILL_BLANK:
        g, c = _normalize_text(given), _normalize_text(correct)
        return bool(g) and (g == c or g in c or c in g)
    return given.lower() == correct.lower()


def score_attempt(questions: list[dict], answers: dict[str, str], difficulty: str):
    """Return (results, score, points). results includes correct answers."""
    weight = DIFFICULTY_WEIGHTS.get(difficulty, 1)
    results = []
    score = 0
    for q in questions:
        user_answer = answers.get(q["id"], "")
        correct = is_correct(q, user_answer)
        if correct:
            score += 1
        results.append(
            {
                "question_id": q["id"],
                "type": q["type"],
                "question": q["question"],
                "options": q["options"],
                "your_answer": user_answer,
                "correct_answer": q["answer"],
                "is_correct": correct,
                "explanation": q.get("explanation", ""),
            }
        )
    return results, score, score * weight
