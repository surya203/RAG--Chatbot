"""Admin: upload a PDF and generate published exam-feature content from it."""

import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.models.exam_profile import SUPPORTED_EXAMS
from app.models.user import User
from app.services.extraction import clean_text, extract_text
from app.services.llm import LLMError
from app.services.pdf_generate import VALID_FEATURES, generate_from_pdf_text

router = APIRouter(prefix="/admin/generate", tags=["admin-generate"])


class GenerateFromPdfResponse(BaseModel):
    created: dict[str, list[str]] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    source_chars: int = 0
    source_name: str = ""
    published: bool = True


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

    Form fields:
    - file: PDF
    - exam: one of supported exams
    - features: comma-separated list, e.g. writing,speaking,reading,listening,vocab,mocks

    Clicking this endpoint = Upload & Generate → content is published.
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
    except HTTPException:
        raise
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generation failed: {exc}",
        ) from exc
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    return GenerateFromPdfResponse(
        created=result.created,
        errors=result.errors,
        source_chars=result.source_chars,
        source_name=filename,
        published=True,
    )
