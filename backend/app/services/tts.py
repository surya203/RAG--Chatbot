"""Text-to-speech for listening exercises (OpenAI TTS)."""

from functools import lru_cache

from openai import OpenAI

from app.core.config import settings

# OpenAI TTS has a practical input limit; keep scripts short.
TTS_MAX_CHARS = 3500


class TTSError(RuntimeError):
    """Raised when speech audio cannot be generated."""


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise TTSError("OPENAI_API_KEY is not set (required for listening audio).")
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def synthesize_speech(text: str, *, voice: str = "alloy") -> bytes:
    """Return MP3 bytes for the given script text."""
    cleaned = " ".join((text or "").split()).strip()
    if not cleaned:
        raise TTSError("Cannot generate audio from empty transcript.")
    if len(cleaned) > TTS_MAX_CHARS:
        cleaned = cleaned[:TTS_MAX_CHARS].rsplit(" ", 1)[0] + "."

    try:
        response = _client().audio.speech.create(
            model="tts-1",
            voice=voice,
            input=cleaned,
            response_format="mp3",
        )
    except Exception as exc:  # noqa: BLE001
        raise TTSError(f"OpenAI TTS failed: {exc}") from exc

    return response.content
