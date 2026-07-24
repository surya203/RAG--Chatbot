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
from app.models.generation_source import (
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_READY,
    GenerationSource,
)
from app.models.listening import ListeningExercise
from app.models.mock_exam import MockExam
from app.models.reading import ReadingPassage
from app.models.speaking import SpeakingPrompt
from app.models.user import User
from app.models.vocab import VocabCard
from app.models.writing import WritingPrompt
from app.services.extraction import clean_text, extract_text
from app.services.pdf_generate import (
    MAX_SOURCE_CHARS,
    VALID_FEATURES,
    generate_single_feature,
)

router = APIRouter(prefix="/admin/generate", tags=["admin-generate"])
logger = logging.getLogger(__name__)


class GenerateFromPdfResponse(BaseModel):
    created: dict[str, list[str]] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    source_chars: int = 0
    source_name: str = ""
    published: bool = True
    source_id: str | None = None
    status: str = STATUS_READY


class GenerationSourceResponse(BaseModel):
    id: str
    original_name: str
    size_bytes: int
    exam: str
    features: list[str]
    created_items: dict[str, list[str]]
    source_chars: int
    errors: list[str]
    status: str
    created_at: str
    item_count: int

    model_config = {"from_attributes": True}


class PrepareFromPdfResponse(BaseModel):
    source_id: str
    source_name: str
    source_chars: int
    features: list[str]
    exam: str
    status: str


class GenerateFeatureRequest(BaseModel):
    feature: str


class GenerateFeatureResponse(BaseModel):
    source_id: str
    feature: str
    created_ids: list[str] = Field(default_factory=list)
    error: str | None = None
    created_items: dict[str, list[str]] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    status: str


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
        status=row.status or STATUS_READY,
        created_at=row.created_at.isoformat() if row.created_at else "",
        item_count=item_count,
    )


def _parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _delete_created_content(db: Session, created_items: dict) -> None:
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


def _clip_for_storage(text: str) -> str:
    text = text.strip()
    if len(text) <= MAX_SOURCE_CHARS:
        return text
    return text[:MAX_SOURCE_CHARS]


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


@router.get("/sources/{source_id}", response_model=GenerationSourceResponse)
def get_generation_source(
    source_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _source_payload(_get_source(source_id, db))


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
    "/prepare",
    response_model=PrepareFromPdfResponse,
    status_code=status.HTTP_201_CREATED,
)
async def prepare_from_pdf(
    file: Annotated[UploadFile, File()],
    exam: Annotated[str, Form()] = "ielts_academic",
    features: Annotated[str, Form()] = "",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Fast step: upload PDF, extract text, save history row (no LLM yet).

    Use with /sources/{id}/generate-feature to avoid Render request timeouts.
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

        clipped = _clip_for_storage(text)
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
            created_items={},
            source_chars=len(clipped),
            errors=[],
            status=STATUS_PENDING,
            source_text=clipped,
        )
        db.add(source)
        db.commit()
        db.refresh(source)
    except HTTPException:
        if stored_filename:
            storage.delete_file(stored_filename)
        raise
    except Exception as exc:  # noqa: BLE001
        if stored_filename:
            storage.delete_file(stored_filename)
        logger.exception("PDF prepare failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not prepare PDF: {exc}",
        ) from exc
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    return PrepareFromPdfResponse(
        source_id=str(source.id),
        source_name=source.original_name,
        source_chars=source.source_chars,
        features=list(source.features or []),
        exam=source.exam,
        status=source.status,
    )


@router.post(
    "/sources/{source_id}/generate-feature",
    response_model=GenerateFeatureResponse,
)
def generate_feature_for_source(
    source_id: str,
    payload: GenerateFeatureRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Generate a single feature for an already-prepared source PDF."""
    row = _get_source(source_id, db)
    feature = (payload.feature or "").strip().lower()
    if feature not in VALID_FEATURES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"feature must be one of: {', '.join(VALID_FEATURES)}",
        )
    if not row.source_text or len(row.source_text) < 200:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This source has no extracted text to generate from.",
        )

    created_ids, err = generate_single_feature(
        db,
        source_text=row.source_text,
        exam=row.exam,
        feature=feature,
        admin_id=current_user.id,
        published=True,
        source_label=Path(row.original_name).stem[:80] or "Uploaded PDF",
        existing=dict(row.created_items or {}),
    )

    # Re-load after commit/rollback inside generate_single_feature.
    row = _get_source(source_id, db)
    created = dict(row.created_items or {})
    errors = list(row.errors or [])

    if created_ids:
        created[feature] = list(dict.fromkeys([*(created.get(feature) or []), *created_ids]))
    if err:
        msg = f"{feature}: {err}"
        if msg not in errors:
            errors.append(msg)

    planned = list(row.features or [])
    # Mark finished if every planned feature either created or errored.
    finished = True
    for f in planned:
        has_items = bool(created.get(f))
        has_err = any(e.startswith(f"{f}:") for e in errors)
        if not has_items and not has_err:
            finished = False
            break

    if finished:
        row.status = STATUS_READY if created else STATUS_FAILED
    else:
        row.status = STATUS_PENDING

    row.created_items = created
    row.errors = errors
    db.add(row)
    db.commit()
    db.refresh(row)

    return GenerateFeatureResponse(
        source_id=str(row.id),
        feature=feature,
        created_ids=created_ids,
        error=err,
        created_items={k: list(v) for k, v in (row.created_items or {}).items()},
        errors=list(row.errors or []),
        status=row.status,
    )


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
    """Compatibility endpoint: prepare + generate all features in one request.

    Prefer /prepare + /generate-feature on hosts with short HTTP timeouts (Render).
    """
    prep = await prepare_from_pdf(
        file=file,
        exam=exam,
        features=features,
        current_user=current_user,
        db=db,
    )

    source = _get_source(prep.source_id, db)
    order = ("writing", "speaking", "reading", "listening", "vocab", "mocks")
    selected = [f for f in order if f in (source.features or [])]

    for feature in selected:
        generate_feature_for_source(
            source_id=prep.source_id,
            payload=GenerateFeatureRequest(feature=feature),
            current_user=current_user,
            db=db,
        )

    source = _get_source(prep.source_id, db)
    created = dict(source.created_items or {})
    errors = list(source.errors or [])
    if not created and errors:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="; ".join(errors),
        )

    return GenerateFromPdfResponse(
        created=created,
        errors=errors,
        source_chars=source.source_chars,
        source_name=source.original_name,
        published=True,
        source_id=str(source.id),
        status=source.status,
    )
