"""Filesystem storage for uploaded PDF files."""

import uuid
from pathlib import Path

from app.core.config import settings


def get_storage_dir() -> Path:
    """Return the storage directory, creating it if necessary."""
    path = Path(settings.STORAGE_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def generate_stored_filename() -> str:
    """A collision-free, opaque filename for on-disk storage."""
    return f"{uuid.uuid4().hex}.pdf"


def get_file_path(stored_filename: str) -> Path:
    return get_storage_dir() / stored_filename


def save_file(stored_filename: str, data: bytes) -> None:
    get_file_path(stored_filename).write_bytes(data)


def delete_file(stored_filename: str) -> None:
    """Remove a stored file. No-op if it's already gone."""
    path = get_file_path(stored_filename)
    path.unlink(missing_ok=True)
