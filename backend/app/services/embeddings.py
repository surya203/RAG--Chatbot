"""Embedding generation via OpenAI (pipeline step 4)."""

from functools import lru_cache

from openai import OpenAI

from app.core.config import settings


class EmbeddingError(RuntimeError):
    """Raised when embeddings cannot be generated (e.g. missing/invalid key)."""


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise EmbeddingError(
            "OPENAI_API_KEY is not set. Add it to backend/.env to enable embeddings."
        )
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns one vector per input, in order."""
    if not texts:
        return []
    try:
        response = _client().embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=texts,
        )
    except EmbeddingError:
        raise
    except Exception as exc:  # noqa: BLE001 - surface a clean message upstream
        raise EmbeddingError(f"Embedding request failed: {exc}") from exc

    # The API preserves input order in response.data.
    return [item.embedding for item in response.data]


def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([text])[0]
