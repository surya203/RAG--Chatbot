"""Answer generation via Groq, streamed token-by-token (pipeline steps 7-8)."""

import json
from collections.abc import Iterator
from functools import lru_cache

from openai import OpenAI

from app.core.config import settings
from app.services.retrieval import RetrievedChunk

SYSTEM_PROMPT = (
    "You are a helpful study assistant. Answer the user's question using ONLY "
    "the provided context from their documents. If the context does not contain "
    "the answer, say you couldn't find it in the documents. Cite the source "
    "document names you used. Be concise and clear."
)


class LLMError(RuntimeError):
    """Raised when the LLM cannot be reached or is misconfigured."""


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    if not settings.API_KEY:
        raise LLMError("API_KEY (Groq) is not set in backend/.env.")
    # Groq exposes an OpenAI-compatible API.
    return OpenAI(api_key=settings.API_KEY, base_url=settings.GROQ_BASE_URL)


def _build_context(chunks: list[RetrievedChunk]) -> str:
    blocks = []
    for c in chunks:
        blocks.append(f"[Source: {c.document_name} (part {c.chunk_index + 1})]\n{c.content}")
    return "\n\n---\n\n".join(blocks)


def complete(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> str:
    """Non-streaming completion. Used for one-shot artifacts like summaries."""
    try:
        response = _client().chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=max_tokens,
        )
    except Exception as exc:  # noqa: BLE001
        raise LLMError(f"Groq request failed: {exc}") from exc

    return (response.choices[0].message.content or "").strip()


def complete_json(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> dict:
    """Completion constrained to a JSON object. Returns the parsed dict."""
    try:
        response = _client().chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
    except Exception as exc:  # noqa: BLE001
        raise LLMError(f"Groq request failed: {exc}") from exc

    content = response.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMError("Model did not return valid JSON.") from exc


def stream_answer(question: str, chunks: list[RetrievedChunk]) -> Iterator[str]:
    """Yield answer text incrementally from Groq.

    Raises LLMError on configuration/connection problems before streaming starts.
    """
    context = _build_context(chunks)
    user_message = (
        f"Context from my documents:\n\n{context}\n\n"
        f"Question: {question}"
        if context
        else f"Question: {question}\n\n(No relevant context was found in the documents.)"
    )

    try:
        stream = _client().chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
            stream=True,
        )
    except Exception as exc:  # noqa: BLE001
        raise LLMError(f"Groq request failed: {exc}") from exc

    for event in stream:
        try:
            delta = event.choices[0].delta.content if event.choices else None
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"Groq stream failed: {exc}") from exc
        if delta:
            yield delta
