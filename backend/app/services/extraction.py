"""PDF text extraction and cleaning (pipeline steps 1-2)."""

import re
from pathlib import Path

from pypdf import PdfReader


def extract_text(path: Path) -> str:
    """Extract raw text from every page of a PDF."""
    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text)
    return "\n\n".join(pages)


def clean_text(text: str) -> str:
    """Normalize extracted text for chunking.

    - Repair words split across line breaks by hyphenation.
    - Collapse runs of whitespace while preserving paragraph breaks.
    - Strip non-printable control characters.
    """
    # Join hyphenated line breaks: "exam-\nple" -> "example".
    text = re.sub(r"-\n(\w)", r"\1", text)
    # Drop control chars except newline and tab.
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    # Normalize line endings.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ newlines to a paragraph break.
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse spaces/tabs.
    text = re.sub(r"[ \t]{2,}", " ", text)
    # Trim trailing spaces on each line.
    text = "\n".join(line.strip() for line in text.split("\n"))
    return text.strip()
