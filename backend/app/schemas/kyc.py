"""KYC document schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


# ─── Response ───────────────────────────────────────────────────

class KycDocumentResponse(BaseModel):
    id: int
    user_id: int
    user_username: str | None = None
    document_type: str
    document_number: str | None
    front_image_url: str | None
    back_image_url: str | None
    selfie_image_url: str | None
    status: str
    rejection_reason: str | None
    reviewed_by: int | None
    reviewed_by_username: str | None = None
    reviewed_at: datetime | None
    expires_at: datetime | None
    submitted_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class KycDocumentListResponse(BaseModel):
    items: list[KycDocumentResponse]
    total: int
    page: int
    page_size: int


class KycUserStatusResponse(BaseModel):
    user_id: int
    status: str
    latest_document_id: int | None = None
    document_type: str | None = None
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None


class KycStatsResponse(BaseModel):
    pending: int
    approved: int
    rejected: int
    expired: int
    today_submissions: int


# ─── Request ────────────────────────────────────────────────────

class KycRejectRequest(BaseModel):
    reason: str = Field(max_length=500)
