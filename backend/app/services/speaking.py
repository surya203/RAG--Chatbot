"""AI Speaking Coach — band-aligned spoken response scoring from transcript."""

from app.services.llm import LLMError, complete_json

SYSTEM_PROMPT = """You are an expert English exam speaking examiner (IELTS / TOEFL / PTE).
You score the student's spoken response from a speech-to-text transcript.

Return ONLY valid JSON with this exact shape:
{
  "overall_band": <number>,
  "criteria": {
    "fluency": {"score": <number>, "feedback": "<short>"},
    "coherence": {"score": <number>, "feedback": "<short>"},
    "lexical": {"score": <number>, "feedback": "<short>"},
    "grammar": {"score": <number>, "feedback": "<short>"},
    "pronunciation": {"score": <number>, "feedback": "<short note based on transcript cues only>"}
  },
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<fix1>", "<fix2>", "<fix3>"],
  "model_tips": "<2-4 sentences of speaking strategy tips for this prompt>"
}

Scoring rules:
- For IELTS: band scores 0–9 in 0.5 steps.
- For TOEFL: criteria roughly 0–4, overall_band as 0–30 Speaking-equivalent estimate.
- For PTE: overall roughly 10–90.
- Pronunciation: you only see a transcript — note limitations and infer only from disfluencies, incomplete words, or awkward phrasing if present; otherwise give a cautious mid estimate.
- Be honest. Do not inflate scores for very short answers.
"""


def score_speaking(
    *,
    exam: str,
    task_type: str,
    prompt_text: str,
    transcript: str,
    duration_seconds: int | None = None,
) -> dict:
    words = len([w for w in transcript.strip().split() if w])
    user_prompt = (
        f"Exam: {exam}\n"
        f"Task type: {task_type}\n"
        f"Transcript word count: {words}\n"
        f"Speaking duration (seconds): {duration_seconds if duration_seconds is not None else 'unknown'}\n\n"
        f"Prompt:\n{prompt_text}\n\n"
        f"Student transcript:\n{transcript}\n"
    )
    data = complete_json(SYSTEM_PROMPT, user_prompt, max_tokens=2200)
    if "overall_band" not in data or "criteria" not in data:
        raise LLMError("Speaking scorer returned an incomplete response.")
    data["disclaimer"] = (
        "AI band estimates are guidance for practice only and are not official exam scores. "
        "Pronunciation feedback from transcripts is approximate."
    )
    return data
