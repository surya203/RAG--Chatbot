"""Filesystem storage for uploaded files (PDFs, listening audio, etc.)."""

import uuid
from pathlib import Path

from app.core.config import settings

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".webm"}
AUDIO_MIME = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
}


def get_storage_dir() -> Path:
    """Return the storage directory, creating it if necessary."""
    path = Path(settings.STORAGE_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_listening_dir() -> Path:
    path = get_storage_dir() / "listening"
    path.mkdir(parents=True, exist_ok=True)
    return path


def generate_stored_filename() -> str:
    """A collision-free, opaque filename for on-disk storage."""
    return f"{uuid.uuid4().hex}.pdf"


def generate_generation_source_filename() -> str:
    """Opaque path under generation/ for admin PDF → Generate sources."""
    return f"generation/{uuid.uuid4().hex}.pdf"


def generate_audio_filename(original_name: str) -> str:
    ext = Path(original_name).suffix.lower()
    if ext not in AUDIO_EXTENSIONS:
        ext = ".mp3"
    return f"listening/{uuid.uuid4().hex}{ext}"


def guess_audio_content_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return AUDIO_MIME.get(ext, "audio/mpeg")


def get_file_path(stored_filename: str) -> Path:
    return get_storage_dir() / stored_filename


def save_file(stored_filename: str, data: bytes) -> None:
    path = get_file_path(stored_filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def delete_file(stored_filename: str) -> None:
    """Remove a stored file. No-op if it's already gone."""
    path = get_file_path(stored_filename)
    path.unlink(missing_ok=True)
