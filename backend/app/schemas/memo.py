"""Admin memo schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


# ─── Create / Update ────────────────────────────────────────────

class MemoCreate(BaseModel):
    target_type: str = Field(max_length=20)
    target_id: int
    content: str


class MemoUpdate(BaseModel):
    content: str


# ─── Response ───────────────────────────────────────────────────

class MemoResponse(BaseModel):
    id: int
    target_type: str
    target_id: int
    content: str
    created_by: int | None
    created_by_username: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MemoListResponse(BaseModel):
    items: list[MemoResponse]
    total: int
