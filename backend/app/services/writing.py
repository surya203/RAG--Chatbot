"""AI Writing Coach — band-aligned essay scoring."""

from app.services.llm import LLMError, complete_json

SYSTEM_PROMPT = """You are an expert English exam writing examiner (IELTS / TOEFL / PTE).
Score the student's essay against official-style writing descriptors.

Return ONLY valid JSON with this exact shape:
{
  "overall_band": <number>,
  "criteria": {
    "task_response": {"score": <number>, "feedback": "<short>"},
    "coherence": {"score": <number>, "feedback": "<short>"},
    "lexical": {"score": <number>, "feedback": "<short>"},
    "grammar": {"score": <number>, "feedback": "<short>"}
  },
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<fix1>", "<fix2>", "<fix3>"],
  "improved_paragraph": "<one rewritten body paragraph that improves the essay>"
}

Scoring rules:
- For IELTS exams: use band scores 0–9 in 0.5 steps.
- For TOEFL: map quality to a 0–5 style scale for criteria, and overall_band as 0–30 Writing-equivalent estimate.
- For PTE: map quality to 10–90 style overall, criteria roughly on same scale divided for each skill.
- Be honest and specific. Do not inflate scores.
- improvements must be concrete and actionable (exactly 3 items when possible).
"""


def _word_count(text: str) -> int:
    return len([w for w in text.strip().split() if w])


def score_essay(
    *,
    exam: str,
    task_type: str,
    prompt_text: str,
    essay_text: str,
) -> dict:
    """Return structured feedback dict or raise LLMError."""
    words = _word_count(essay_text)
    user_prompt = (
        f"Exam: {exam}\n"
        f"Task type: {task_type}\n"
        f"Word count: {words}\n\n"
        f"Prompt:\n{prompt_text}\n\n"
        f"Student essay:\n{essay_text}\n"
    )
    data = complete_json(SYSTEM_PROMPT, user_prompt, max_tokens=2500)
    if "overall_band" not in data or "criteria" not in data:
        raise LLMError("Writing scorer returned an incomplete response.")
    data["disclaimer"] = (
        "AI band estimates are guidance for practice only and are not official exam scores."
    )
    return data


def count_words(text: str) -> int:
    return _word_count(text)
