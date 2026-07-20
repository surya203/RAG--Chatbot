"""Generate exam-feature content from PDF source text (admin tool)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.core import storage
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.listening import ListeningExercise, ListeningQuestion
from app.models.mock_exam import MOCK_MODE_FULL, MockExam
from app.models.reading import ReadingPassage, ReadingQuestion, SUPPORTED_READING_QTYPES
from app.models.speaking import SpeakingPrompt
from app.models.vocab import VOCAB_TOPICS, VocabCard
from app.models.writing import WritingPrompt
from app.services.llm import LLMError, complete_json
from app.services.tts import TTSError, synthesize_speech

VALID_FEATURES = (
    "writing",
    "speaking",
    "reading",
    "listening",
    "vocab",
    "mocks",
)

MAX_SOURCE_CHARS = 20000

WRITING_DEFAULTS = {
    "ielts_academic": ("ielts_task2", 40, 250),
    "ielts_general": ("ielts_task2", 40, 250),
    "toefl_ibt": ("toefl_independent", 30, 300),
    "pte_academic": ("pte_essay", 20, 200),
}

SPEAKING_DEFAULTS = {
    "ielts_academic": ("ielts_part2", 60, 120),
    "ielts_general": ("ielts_part2", 60, 120),
    "toefl_ibt": ("toefl_independent_speaking", 15, 45),
    "pte_academic": ("pte_retell_lecture", 10, 40),
}


@dataclass
class GenerateResult:
    created: dict[str, list[str]] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    source_chars: int = 0


def _clip_source(text: str) -> str:
    text = text.strip()
    if len(text) <= MAX_SOURCE_CHARS:
        return text
    return text[:MAX_SOURCE_CHARS] + "\n\n[Source truncated for generation.]"


def _ask_json(system: str, user: str, max_tokens: int = 4096) -> dict[str, Any]:
    return complete_json(system, user, max_tokens=max_tokens)


def _normalize_questions(raw: list[Any], *, min_count: int = 3) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, item in enumerate(raw or []):
        if not isinstance(item, dict):
            continue
        qtype = str(item.get("question_type") or "multiple_choice").strip()
        if qtype not in SUPPORTED_READING_QTYPES:
            qtype = "multiple_choice"
        qtext = str(item.get("question_text") or "").strip()
        answer_raw = item.get("correct_answer")
        if isinstance(answer_raw, dict):
            answer = ", ".join(f"{k}: {v}" for k, v in answer_raw.items())
        else:
            answer = str(answer_raw or "").strip()
        if len(qtext) < 3 or not answer:
            continue
        options = item.get("options")
        normalized_options: list[str] | None = None
        if isinstance(options, list) and options:
            normalized_options = []
            for opt in options:
                if isinstance(opt, str):
                    if opt.strip():
                        normalized_options.append(opt.strip())
                elif isinstance(opt, dict):
                    if "term" in opt and "definition" in opt:
                        normalized_options.append(
                            f"{opt.get('term')}: {opt.get('definition')}"
                        )
                    elif "text" in opt:
                        normalized_options.append(str(opt.get("text")))
                    else:
                        normalized_options.append(
                            ", ".join(f"{k}: {v}" for k, v in opt.items())
                        )
                else:
                    normalized_options.append(str(opt))
            if not normalized_options:
                normalized_options = None
        if qtype == "multiple_choice" and not normalized_options:
            normalized_options = ["A", "B", "C", "D"]
        # Prefer MCQ when options are complex object lists that break matching UX.
        if qtype == "matching_headings" and normalized_options:
            qtype = "multiple_choice"
        out.append(
            {
                "order_index": i,
                "question_type": qtype,
                "question_text": qtext[:2000],
                "options": normalized_options,
                "correct_answer": answer[:500],
                "explanation": (str(item.get("explanation") or "").strip() or None),
            }
        )
    if len(out) < min_count:
        raise LLMError(f"Model returned too few valid questions ({len(out)}).")
    return out


def generate_writing(
    db: Session,
    *,
    exam: str,
    source: str,
    admin_id: uuid.UUID,
    published: bool,
) -> WritingPrompt:
    task_type, minutes, min_words = WRITING_DEFAULTS.get(
        exam, ("ielts_task2", 40, 250)
    )
    data = _ask_json(
        "You are an exam-prep content author. Return JSON only.",
        (
            f"Using the source material below, create ONE {exam} writing prompt "
            f"of type {task_type}.\n"
            "Return JSON keys: title, prompt_text, topic.\n"
            "prompt_text must be a full exam-style task students can answer "
            "(at least 80 characters), grounded in themes from the source "
            "(do not copy long verbatim passages).\n\n"
            f"SOURCE:\n{source}"
        ),
    )
    title = str(data.get("title") or "Writing practice").strip()[:255]
    prompt_text = str(data.get("prompt_text") or "").strip()
    if len(prompt_text) < 40:
        raise LLMError("Writing prompt text too short.")
    row = WritingPrompt(
        created_by=admin_id,
        exam=exam,
        task_type=task_type,
        title=title,
        prompt_text=prompt_text,
        topic=(str(data.get("topic") or "").strip()[:120] or None),
        time_limit_minutes=minutes,
        min_words=min_words,
        is_published=published,
    )
    db.add(row)
    db.flush()
    return row


def generate_speaking(
    db: Session,
    *,
    exam: str,
    source: str,
    admin_id: uuid.UUID,
    published: bool,
) -> SpeakingPrompt:
    task_type, prep, speak = SPEAKING_DEFAULTS.get(exam, ("ielts_part2", 60, 120))
    data = _ask_json(
        "You are an exam-prep speaking coach author. Return JSON only.",
        (
            f"Using the source material, create ONE {exam} speaking prompt "
            f"of type {task_type}.\n"
            "Return JSON keys: title, prompt_text, cue_points, topic, model_answer.\n"
            "prompt_text must be a clear speaking task (≥40 chars).\n"
            "cue_points can be bullet lines separated by newlines.\n\n"
            f"SOURCE:\n{source}"
        ),
    )
    title = str(data.get("title") or "Speaking practice").strip()[:255]
    prompt_text = str(data.get("prompt_text") or "").strip()
    if len(prompt_text) < 20:
        raise LLMError("Speaking prompt text too short.")
    row = SpeakingPrompt(
        created_by=admin_id,
        exam=exam,
        task_type=task_type,
        title=title,
        prompt_text=prompt_text,
        cue_points=(str(data.get("cue_points") or "").strip() or None),
        model_answer=(str(data.get("model_answer") or "").strip() or None),
        topic=(str(data.get("topic") or "").strip()[:120] or None),
        prep_seconds=prep,
        speak_seconds=speak,
        is_published=published,
    )
    db.add(row)
    db.flush()
    return row


def generate_reading(
    db: Session,
    *,
    exam: str,
    source: str,
    admin_id: uuid.UUID,
    published: bool,
) -> ReadingPassage:
    data = _ask_json(
        "You are an IELTS/TOEFL/PTE reading author. Return JSON only.",
        (
            f"From the source, create ONE {exam} reading practice set.\n"
            "Return JSON keys: title, passage_text, topic, difficulty, "
            "strategy_tip, questions.\n"
            "passage_text: rewrite/adapt into a coherent exam-style passage "
            "(400–900 words, ≥300 characters). Do not dump the whole PDF.\n"
            "difficulty: easy|medium|hard.\n"
            "questions: array of 5 items, each with question_type, question_text, "
            "options (for multiple_choice), correct_answer, explanation.\n"
            f"question_type must be one of: {', '.join(SUPPORTED_READING_QTYPES)}.\n\n"
            f"SOURCE:\n{source}"
        ),
        max_tokens=6000,
    )
    passage_text = str(data.get("passage_text") or "").strip()
    if len(passage_text) < 200:
        raise LLMError("Reading passage too short.")
    questions = _normalize_questions(data.get("questions") or [], min_count=3)
    difficulty = str(data.get("difficulty") or "medium").strip().lower()
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"
    row = ReadingPassage(
        created_by=admin_id,
        exam=exam,
        title=str(data.get("title") or "Reading practice").strip()[:255],
        passage_text=passage_text,
        topic=(str(data.get("topic") or "").strip()[:120] or None),
        difficulty=difficulty,
        time_limit_minutes=20,
        strategy_tip=(str(data.get("strategy_tip") or "").strip() or None),
        is_published=published,
    )
    db.add(row)
    db.flush()
    for q in questions:
        db.add(
            ReadingQuestion(
                passage_id=row.id,
                order_index=q["order_index"],
                question_type=q["question_type"],
                question_text=q["question_text"],
                options=q["options"],
                correct_answer=q["correct_answer"],
                explanation=q["explanation"],
            )
        )
    db.flush()
    return row


def generate_listening(
    db: Session,
    *,
    exam: str,
    source: str,
    admin_id: uuid.UUID,
    published: bool,
) -> ListeningExercise:
    data = _ask_json(
        "You are an exam listening author. Return JSON only.",
        (
            f"From the source, create ONE {exam} listening exercise.\n"
            "Return JSON keys: title, transcript, topic, difficulty, "
            "strategy_tip, vocabulary, questions.\n"
            "transcript: a spoken monologue/dialogue script suitable for "
            "listening practice (180–450 words). Clear sentences.\n"
            "vocabulary: optional array of {{word, definition}} (max 6).\n"
            "questions: array of 4–6 items with question_type, question_text, "
            "options (array of strings for multiple_choice), correct_answer "
            "(string), explanation.\n"
            "Prefer question_type multiple_choice, short_answer, "
            "true_false_not_given, fill_blank, or yes_no_not_given. "
            "Do NOT use matching_headings. options must be strings only.\n"
            f"Allowed question_type values: {', '.join(SUPPORTED_READING_QTYPES)}.\n\n"
            f"SOURCE:\n{source}"
        ),
        max_tokens=5000,
    )
    transcript = str(data.get("transcript") or "").strip()
    if len(transcript) < 80:
        raise LLMError("Listening transcript too short.")
    questions = _normalize_questions(data.get("questions") or [], min_count=3)

    audio_bytes = synthesize_speech(transcript)
    audio_name = storage.generate_audio_filename("generated.mp3")
    storage.save_file(audio_name, audio_bytes)

    difficulty = str(data.get("difficulty") or "medium").strip().lower()
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    vocab = data.get("vocabulary")
    if not isinstance(vocab, list):
        vocab = None

    row = ListeningExercise(
        created_by=admin_id,
        exam=exam,
        title=str(data.get("title") or "Listening practice").strip()[:255],
        audio_filename=audio_name,
        audio_content_type="audio/mpeg",
        transcript=transcript,
        vocabulary=vocab,
        topic=(str(data.get("topic") or "").strip()[:120] or None),
        difficulty=difficulty,
        time_limit_minutes=10,
        replay_limit=2,
        strategy_tip=(str(data.get("strategy_tip") or "").strip() or None),
        is_published=published,
    )
    db.add(row)
    db.flush()
    for q in questions:
        db.add(
            ListeningQuestion(
                exercise_id=row.id,
                order_index=q["order_index"],
                question_type=q["question_type"],
                question_text=q["question_text"],
                options=q["options"],
                correct_answer=q["correct_answer"],
                explanation=q["explanation"],
            )
        )
    db.flush()
    return row


def generate_vocab(
    db: Session,
    *,
    exam: str,
    source: str,
    admin_id: uuid.UUID,
    published: bool,
) -> list[VocabCard]:
    data = _ask_json(
        "You are a vocabulary curriculum author. Return JSON only.",
        (
            f"From the source, extract 8 useful exam vocabulary cards for {exam}.\n"
            "Return JSON key cards: array of objects with keys "
            "word, definition, example_sentence, topic, collocations.\n"
            f"topic must be one of: {', '.join(VOCAB_TOPICS)}.\n"
            "collocations: optional string array.\n\n"
            f"SOURCE:\n{source}"
        ),
        max_tokens=4000,
    )
    cards_raw = data.get("cards") if isinstance(data, dict) else None
    if not isinstance(cards_raw, list) or not cards_raw:
        raise LLMError("No vocabulary cards returned.")

    created: list[VocabCard] = []
    for item in cards_raw[:12]:
        if not isinstance(item, dict):
            continue
        word = str(item.get("word") or "").strip()[:80]
        definition = str(item.get("definition") or "").strip()
        if len(word) < 2 or len(definition) < 5:
            continue
        topic = str(item.get("topic") or "general").strip().lower()
        if topic not in VOCAB_TOPICS:
            topic = "general"
        collocations = item.get("collocations")
        if not isinstance(collocations, list):
            collocations = None
        row = VocabCard(
            created_by=admin_id,
            exam=exam,
            topic=topic,
            word=word,
            definition=definition[:1000],
            example_sentence=(str(item.get("example_sentence") or "").strip() or None),
            collocations=collocations,
            is_published=published,
        )
        db.add(row)
        created.append(row)
    if not created:
        raise LLMError("No valid vocabulary cards could be saved.")
    db.flush()
    return created


def generate_mock(
    db: Session,
    *,
    exam: str,
    title_hint: str,
    admin_id: uuid.UUID,
    published: bool,
    writing: WritingPrompt | None,
    speaking: SpeakingPrompt | None,
    reading: ReadingPassage | None,
    listening: ListeningExercise | None,
) -> MockExam:
    if not any([writing, speaking, reading, listening]):
        raise LLMError("Mock exam needs at least one generated section.")
    row = MockExam(
        created_by=admin_id,
        exam=exam,
        title=(title_hint or "PDF practice mock")[:255],
        description="Auto-generated from an admin PDF source.",
        mode=MOCK_MODE_FULL,
        total_time_minutes=90,
        reading_passage_id=reading.id if reading else None,
        listening_exercise_id=listening.id if listening else None,
        writing_prompt_id=writing.id if writing else None,
        speaking_prompt_id=speaking.id if speaking else None,
        is_published=published,
    )
    db.add(row)
    db.flush()
    return row


def generate_from_pdf_text(
    db: Session,
    *,
    source_text: str,
    exam: str,
    features: list[str],
    admin_id: uuid.UUID,
    published: bool = True,
    source_label: str = "Uploaded PDF",
) -> GenerateResult:
    if exam not in SUPPORTED_EXAMS:
        raise ValueError(f"Unsupported exam: {exam}")

    selected = [f for f in features if f in VALID_FEATURES]
    if not selected:
        raise ValueError("Select at least one feature to generate.")

    source = _clip_source(source_text)
    if len(source) < 200:
        raise ValueError("PDF text is too short to generate useful content.")

    result = GenerateResult(source_chars=len(source))
    wants_mock = "mocks" in selected

    # When mocks is selected, ensure skill sections exist for a usable mock.
    needed = set(selected)
    if wants_mock:
        needed.update({"writing", "speaking", "reading", "listening"})

    writing_row: WritingPrompt | None = None
    speaking_row: SpeakingPrompt | None = None
    reading_row: ReadingPassage | None = None
    listening_row: ListeningExercise | None = None

    order = ("writing", "speaking", "reading", "listening", "vocab", "mocks")
    for feature in order:
        if feature not in needed:
            continue
        try:
            if feature == "writing":
                writing_row = generate_writing(
                    db,
                    exam=exam,
                    source=source,
                    admin_id=admin_id,
                    published=published,
                )
                result.created.setdefault("writing", []).append(str(writing_row.id))
            elif feature == "speaking":
                speaking_row = generate_speaking(
                    db,
                    exam=exam,
                    source=source,
                    admin_id=admin_id,
                    published=published,
                )
                result.created.setdefault("speaking", []).append(str(speaking_row.id))
            elif feature == "reading":
                reading_row = generate_reading(
                    db,
                    exam=exam,
                    source=source,
                    admin_id=admin_id,
                    published=published,
                )
                result.created.setdefault("reading", []).append(str(reading_row.id))
            elif feature == "listening":
                listening_row = generate_listening(
                    db,
                    exam=exam,
                    source=source,
                    admin_id=admin_id,
                    published=published,
                )
                result.created.setdefault("listening", []).append(str(listening_row.id))
            elif feature == "vocab" and "vocab" in selected:
                cards = generate_vocab(
                    db,
                    exam=exam,
                    source=source,
                    admin_id=admin_id,
                    published=published,
                )
                result.created["vocab"] = [str(c.id) for c in cards]
            elif feature == "mocks" and wants_mock:
                mock = generate_mock(
                    db,
                    exam=exam,
                    title_hint=f"Mock from {source_label}",
                    admin_id=admin_id,
                    published=published,
                    writing=writing_row,
                    speaking=speaking_row,
                    reading=reading_row,
                    listening=listening_row,
                )
                result.created.setdefault("mocks", []).append(str(mock.id))
        except (LLMError, TTSError, ValueError) as exc:
            result.errors.append(f"{feature}: {exc}")
            # Listening may have saved a file before DB failure — leave file; rare.
            if feature == "listening" and listening_row is None:
                pass

    if not result.created and result.errors:
        raise LLMError("; ".join(result.errors))

    db.commit()
    return result
