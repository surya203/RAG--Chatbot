from datetime import datetime

from pydantic import BaseModel


class SummaryTypeInfo(BaseModel):
    key: str
    label: str
    generated: bool
    updated_at: datetime | None = None


class SummaryResponse(BaseModel):
    summary_type: str
    label: str
    content: str
    updated_at: datetime
