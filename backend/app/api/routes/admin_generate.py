"""Admin: upload a PDF and generate published exam-feature content from it."""

import logging
import tempfile
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import storage
from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.generation_source import GenerationSource
from app.models.listening import ListeningExercise
from app.models.mock_exam import MockExam
from app.models.reading import ReadingPassage
from app.models.speaking import SpeakingPrompt
from app.models.user import User
from app.models.vocab import VocabCard
from app.models.writing import WritingPrompt
from app.services.extraction import clean_text, extract_text
from app.services.llm import LLMError
from app.services.pdf_generate import VALID_FEATURES, generate_from_pdf_text

router = APIRouter(prefix="/admin/generate", tags=["admin-generate"])
logger = logging.getLogger(__name__)


class GenerateFromPdfResponse(BaseModel):
    created: dict[str, list[str]] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    source_chars: int = 0
    source_name: str = ""
    published: bool = True
    source_id: str | None = None


class GenerationSourceResponse(BaseModel):
    id: str
    original_name: str
    size_bytes: int
    exam: str
    features: list[str]
    created_items: dict[str, list[str]]
    source_chars: int
    errors: list[str]
    created_at: str
    item_count: int

    model_config = {"from_attributes": True}


def _source_payload(row: GenerationSource) -> GenerationSourceResponse:
    created = row.created_items or {}
    item_count = sum(len(v) for v in created.values() if isinstance(v, list))
    return GenerationSourceResponse(
        id=str(row.id),
        original_name=row.original_name,
        size_bytes=row.size_bytes,
        exam=row.exam,
        features=list(row.features or []),
        created_items={k: list(v) for k, v in created.items()},
        source_chars=row.source_chars,
        errors=list(row.errors or []),
        created_at=row.created_at.isoformat() if row.created_at else "",
        item_count=item_count,
    )


def _parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _delete_created_content(db: Session, created_items: dict) -> None:
    """Remove practice content that was generated from this source PDF."""
    if not created_items:
        return

    for feature, ids in created_items.items():
        if not isinstance(ids, list):
            continue
        for raw_id in ids:
            parsed = _parse_uuid(str(raw_id))
            if not parsed:
                continue
            if feature == "writing":
                row = db.query(WritingPrompt).filter(WritingPrompt.id == parsed).first()
                if row:
                    db.delete(row)
            elif feature == "speaking":
                row = (
                    db.query(SpeakingPrompt).filter(SpeakingPrompt.id == parsed).first()
                )
                if row:
                    db.delete(row)
            elif feature == "reading":
                row = (
                    db.query(ReadingPassage).filter(ReadingPassage.id == parsed).first()
                )
                if row:
                    db.delete(row)
            elif feature == "listening":
                row = (
                    db.query(ListeningExercise)
                    .filter(ListeningExercise.id == parsed)
                    .first()
                )
                if row:
                    storage.delete_file(row.audio_filename)
                    db.delete(row)
            elif feature == "vocab":
                row = db.query(VocabCard).filter(VocabCard.id == parsed).first()
                if row:
                    db.delete(row)
            elif feature == "mocks":
                row = db.query(MockExam).filter(MockExam.id == parsed).first()
                if row:
                    db.delete(row)


def _get_source(source_id: str, db: Session) -> GenerationSource:
    parsed = _parse_uuid(source_id)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source PDF not found"
        )
    row = db.query(GenerationSource).filter(GenerationSource.id == parsed).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source PDF not found"
        )
    return row


@router.get("/sources", response_model=list[GenerationSourceResponse])
def list_generation_sources(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(GenerationSource)
        .order_by(GenerationSource.created_at.desc())
        .all()
    )
    return [_source_payload(r) for r in rows]


@router.get("/sources/{source_id}/file")
def get_generation_source_file(
    source_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = _get_source(source_id, db)
    path = storage.get_file_path(row.stored_filename)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file is missing from storage",
        )
    download_name = row.original_name
    if not download_name.lower().endswith(".pdf"):
        download_name = f"{download_name}.pdf"
    return FileResponse(
        path,
        media_type=row.content_type or "application/pdf",
        filename=download_name,
        content_disposition_type="inline",
    )


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_generation_source(
    source_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete the source PDF and the content generated from it."""
    row = _get_source(source_id, db)
    _delete_created_content(db, row.created_items or {})
    storage.delete_file(row.stored_filename)
    db.delete(row)
    db.commit()
    return None


@router.post(
    "/from-pdf",
    response_model=GenerateFromPdfResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_from_pdf(
    file: Annotated[UploadFile, File()],
    exam: Annotated[str, Form()] = "ielts_academic",
    features: Annotated[str, Form()] = "",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Upload a PDF, pick features, and publish generated practice content.

    The PDF is stored in admin generation history (not the student library).
    """
    exam_key = (exam or "").strip()
    if exam_key not in SUPPORTED_EXAMS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"exam must be one of: {', '.join(SUPPORTED_EXAMS)}",
        )

    selected = [f.strip().lower() for f in features.split(",") if f.strip()]
    selected = [f for f in selected if f in VALID_FEATURES]
    if not selected:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"features must include at least one of: {', '.join(VALID_FEATURES)}",
        )

    filename = file.filename or "source.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF files are supported.",
        )

    data = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit.",
        )
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Empty file.",
        )

    tmp_path: Path | None = None
    stored_filename: str | None = None
    result = None
    source_id: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)

        raw = extract_text(tmp_path)
        text = clean_text(raw)
        if len(text) < 200:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No usable text found in the PDF (it may be scanned images).",
            )

        result = generate_from_pdf_text(
            db,
            source_text=text,
            exam=exam_key,
            features=selected,
            admin_id=current_user.id,
            published=True,
            source_label=Path(filename).stem[:80] or "Uploaded PDF",
        )

        stored_filename = storage.generate_generation_source_filename()
        storage.save_file(stored_filename, data)

        source = GenerationSource(
            uploaded_by=current_user.id,
            original_name=Path(filename).name[:255],
            stored_filename=stored_filename,
            content_type=file.content_type or "application/pdf",
            size_bytes=len(data),
            exam=exam_key,
            features=selected,
            created_items=result.created,
            source_chars=result.source_chars,
            errors=result.errors,
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        source_id = str(source.id)
    except HTTPException:
        if stored_filename:
            storage.delete_file(stored_filename)
        raise
    except LLMError as exc:
        if stored_filename:
            storage.delete_file(stored_filename)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        if stored_filename:
            storage.delete_file(stored_filename)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        if stored_filename:
            storage.delete_file(stored_filename)
        logger.exception("PDF generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generation failed: {exc}",
        ) from exc
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    assert result is not None
    return GenerateFromPdfResponse(
        created=result.created,
        errors=result.errors,
        source_chars=result.source_chars,
        source_name=filename,
        published=True,
        source_id=source_id,
    )
