"""Split cleaned text into overlapping chunks (pipeline step 3)."""

from app.core.config import settings


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[str]:
    """Break text into overlapping, roughly chunk_size-character windows.

    Chunks prefer to end on a paragraph or sentence boundary near the window
    edge so we don't cut mid-sentence. Consecutive chunks overlap by `overlap`
    characters to preserve context across boundaries.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size, n)

        # If we're not at the very end, try to break on a natural boundary
        # within the last ~20% of the window.
        if end < n:
            window_start = start + int(chunk_size * 0.8)
            boundary = _find_boundary(text, window_start, end)
            if boundary > start:
                end = boundary

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= n:
            break
        # Step forward, keeping `overlap` characters of context.
        start = max(end - overlap, start + 1)

    return chunks


def _find_boundary(text: str, lo: int, hi: int) -> int:
    """Return the best break point in [lo, hi]: paragraph > sentence > space."""
    segment = text[lo:hi]
    for marker in ("\n\n", ". ", ".\n", "\n", " "):
        idx = segment.rfind(marker)
        if idx != -1:
            return lo + idx + len(marker)
    return hi
