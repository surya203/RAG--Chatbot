import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core import storage
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.document import (
    DEFAULT_SUBJECT,
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_PROCESSING,
    STATUS_READY,
    Document,
)
from app.models.summary import Summary
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentUpdate, UploadResponse
from app.schemas.summary import SummaryResponse, SummaryTypeInfo
from app.services.extraction import clean_text, extract_text
from app.services.ingestion import ingest_document
from app.services.llm import LLMError
from app.services import summaries as summaries_service

router = APIRouter(prefix="/documents", tags=["documents"])

PDF_MAGIC = b"%PDF"

# Documents stuck in processing (e.g. server restart mid-ingest) flip to failed.
STUCK_PROCESSING_MINUTES = 30


def _to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=str(doc.id),
        original_name=doc.original_name,
        subject=doc.subject,
        content_type=doc.content_type,
        size_bytes=doc.size_bytes,
        status=doc.status,
        chunk_count=doc.chunk_count,
        error=doc.error,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def _get_owned_document(doc_id: str, user: User, db: Session) -> Document:
    try:
        parsed_id = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc = (
        db.query(Document)
        .filter(Document.id == parsed_id, Document.user_id == user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


def _recover_stuck_processing(docs: list[Document], db: Session) -> None:
    """Mark long-running processing docs as failed so the UI can reprocess."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=STUCK_PROCESSING_MINUTES)
    changed = False
    for doc in docs:
        if doc.status != STATUS_PROCESSING:
            continue
        updated = doc.updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        if updated <= cutoff:
            doc.status = STATUS_FAILED
            doc.error = (
                "Processing timed out or was interrupted. Please retry."
            )
            changed = True
    if changed:
        db.commit()
        for doc in docs:
            db.refresh(doc)


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: Annotated[list[UploadFile], File()],
    subject: Annotated[str, Form()] = DEFAULT_SUBJECT,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    clean_subject = subject.strip() or DEFAULT_SUBJECT

    uploaded: list[DocumentResponse] = []
    errors: list[str] = []
    new_doc_ids: list[str] = []

    for upload in files:
        name = upload.filename or "untitled.pdf"

        is_pdf_type = upload.content_type == "application/pdf"
        is_pdf_ext = name.lower().endswith(".pdf")
        if not (is_pdf_type or is_pdf_ext):
            errors.append(f"{name}: only PDF files are allowed")
            continue

        data = await upload.read()

        if len(data) == 0:
            errors.append(f"{name}: file is empty")
            continue
        if len(data) > max_bytes:
            errors.append(f"{name}: exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit")
            continue
        if not data.startswith(PDF_MAGIC):
            errors.append(f"{name}: not a valid PDF file")
            continue

        stored_filename = storage.generate_stored_filename()
        storage.save_file(stored_filename, data)

        doc = Document(
            user_id=current_user.id,
            original_name=Path(name).stem[:255] or "untitled",
            subject=clean_subject[:120],
            stored_filename=stored_filename,
            content_type="application/pdf",
            size_bytes=len(data),
            status=STATUS_PENDING,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        uploaded.append(_to_response(doc))
        new_doc_ids.append(str(doc.id))

    if not uploaded and errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="; ".join(errors))

    # Kick off the ingestion pipeline for each new document after the response
    # is sent (extract -> clean -> chunk -> embed -> store).
    for doc_id in new_doc_ids:
        background_tasks.add_task(ingest_document, doc_id)

    return UploadResponse(uploaded=uploaded, errors=errors)


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.subject.asc(), Document.created_at.desc())
        .all()
    )
    _recover_stuck_processing(docs, db)
    return [_to_response(d) for d in docs]


@router.post("/{doc_id}/reprocess", response_model=DocumentResponse)
def reprocess_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _get_owned_document(doc_id, current_user, db)
    doc.status = STATUS_PENDING
    doc.error = None
    db.add(doc)
    db.commit()
    db.refresh(doc)
    background_tasks.add_task(ingest_document, str(doc.id))
    return _to_response(doc)


@router.get("/{doc_id}/file")
def get_document_file(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _get_owned_document(doc_id, current_user, db)
    path = storage.get_file_path(doc.stored_filename)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File is missing from storage"
        )
    return FileResponse(
        path,
        media_type=doc.content_type,
        filename=f"{doc.original_name}.pdf",
        content_disposition_type="inline",
    )


@router.patch("/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: str,
    payload: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _get_owned_document(doc_id, current_user, db)

    if payload.original_name is not None:
        name = payload.original_name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Document name cannot be empty",
            )
        doc.original_name = name[:255]
    if payload.subject is not None:
        doc.subject = payload.subject.strip()[:120] or DEFAULT_SUBJECT

    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _to_response(doc)


@router.get("/{doc_id}/summaries", response_model=list[SummaryTypeInfo])
def list_summaries(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _get_owned_document(doc_id, current_user, db)
    existing = {
        s.summary_type: s
        for s in db.query(Summary).filter(Summary.document_id == doc.id).all()
    }
    return [
        SummaryTypeInfo(
            key=spec.key,
            label=spec.label,
            generated=spec.key in existing,
            updated_at=existing[spec.key].updated_at if spec.key in existing else None,
        )
        for spec in summaries_service.SUMMARY_TYPES
    ]


@router.get("/{doc_id}/summaries/{summary_type}", response_model=SummaryResponse)
def get_summary(
    doc_id: str,
    summary_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _get_owned_document(doc_id, current_user, db)
    spec = summaries_service.get_summary_type(summary_type)
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown summary type")

    row = (
        db.query(Summary)
        .filter(Summary.document_id == doc.id, Summary.summary_type == summary_type)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Summary not generated yet"
        )
    return SummaryResponse(
        summary_type=summary_type,
        label=spec.label,
        content=row.content,
        updated_at=row.updated_at,
    )


@router.post("/{doc_id}/summaries/{summary_type}", response_model=SummaryResponse)
def generate_summary(
    doc_id: str,
    summary_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate (or regenerate) a summary artifact from the document text."""
    doc = _get_owned_document(doc_id, current_user, db)
    if doc.status != STATUS_READY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document must finish processing before generating summaries.",
        )
    spec = summaries_service.get_summary_type(summary_type)
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown summary type")

    path = storage.get_file_path(doc.stored_filename)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File is missing from storage"
        )

    text = clean_text(extract_text(path))
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No extractable text found (the PDF may be scanned images).",
        )

    try:
        content = summaries_service.generate_summary(doc.original_name, text, summary_type)
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    # Upsert: one summary per (document, type).
    row = (
        db.query(Summary)
        .filter(Summary.document_id == doc.id, Summary.summary_type == summary_type)
        .first()
    )
    if row:
        row.content = content
    else:
        row = Summary(
            document_id=doc.id,
            user_id=current_user.id,
            summary_type=summary_type,
            content=content,
        )
        db.add(row)
    db.commit()
    db.refresh(row)

    return SummaryResponse(
        summary_type=summary_type,
        label=spec.label,
        content=row.content,
        updated_at=row.updated_at,
    )


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _get_owned_document(doc_id, current_user, db)
    storage.delete_file(doc.stored_filename)
    db.delete(doc)
    db.commit()
    return None
