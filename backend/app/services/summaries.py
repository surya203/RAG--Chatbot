"""AI-generated study artifacts from a document's text (Phase 5)."""

from dataclasses import dataclass

from app.core.config import settings
from app.services.llm import complete

BASE_SYSTEM = (
    "You are an expert study assistant. You are given the extracted text of a "
    "student's document. Produce high-quality study material based ONLY on that "
    "text. Format your response in clean Markdown. Do not invent facts that are "
    "not supported by the document."
)


@dataclass(frozen=True)
class SummaryType:
    key: str
    label: str
    instruction: str


# Ordered list defines the order shown in the UI.
SUMMARY_TYPES: list[SummaryType] = [
    SummaryType(
        "chapter_summary",
        "Chapter Summary",
        "Write a structured summary organized by the document's chapters or "
        "sections. Use a `##` heading per section followed by a short paragraph "
        "capturing its key points.",
    ),
    SummaryType(
        "one_page",
        "One-page Summary",
        "Write a concise one-page summary (roughly 300-500 words) that captures "
        "the document's main ideas, structured with a few short paragraphs.",
    ),
    SummaryType(
        "bullet_notes",
        "Bullet Notes",
        "Create concise, revision-friendly study notes as nested bullet points "
        "grouped under `##` topic headings. Keep each bullet short and factual.",
    ),
    SummaryType(
        "definitions",
        "Important Definitions",
        "Extract the important terms, concepts, and their definitions. Present "
        "them as a Markdown list where each item is **Term** — definition. Only "
        "include terms actually defined or explained in the text.",
    ),
    SummaryType(
        "formula_sheet",
        "Formula Sheet",
        "Extract all formulas, equations, and key quantitative relationships, "
        "each with a one-line explanation of its variables and purpose. Use a "
        "Markdown list with the formula in inline code. If the document contains "
        "no formulas, clearly state that none were found.",
    ),
    SummaryType(
        "interview_questions",
        "Interview Questions",
        "Generate 8-12 likely interview or exam questions that test understanding "
        "of this material, each followed by a brief model answer. Number the "
        "questions and bold each question.",
    ),
]

SUMMARY_TYPE_KEYS = {s.key for s in SUMMARY_TYPES}
_BY_KEY = {s.key: s for s in SUMMARY_TYPES}


def get_summary_type(key: str) -> SummaryType | None:
    return _BY_KEY.get(key)


def generate_summary(document_name: str, text: str, summary_type: str) -> str:
    """Generate one summary artifact from the document text via the LLM."""
    spec = _BY_KEY[summary_type]

    snippet = text[: settings.SUMMARY_MAX_INPUT_CHARS]
    truncated = len(text) > settings.SUMMARY_MAX_INPUT_CHARS
    truncation_note = (
        "\n\n(Note: the document was long and was truncated; summarize what is "
        "provided.)"
        if truncated
        else ""
    )

    user_prompt = (
        f'Document title: "{document_name}"\n\n'
        f"Task: {spec.instruction}{truncation_note}\n\n"
        f"--- DOCUMENT TEXT ---\n{snippet}"
    )
    return complete(BASE_SYSTEM, user_prompt, max_tokens=settings.SUMMARY_MAX_TOKENS)
