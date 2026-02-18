"""Pydantic schemas for announcement (notice/popup/banner) management."""

from datetime import datetime

from pydantic import BaseModel, Field


class AnnouncementCreate(BaseModel):
    type: str = Field(pattern=r"^(notice|popup|banner)$")
    title: str = Field(max_length=255)
    content: str
    target: str = Field(default="all", pattern=r"^(all|agents|users)$")
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class AnnouncementUpdate(BaseModel):
    type: str | None = Field(default=None, pattern=r"^(notice|popup|banner)$")
    title: str | None = Field(default=None, max_length=255)
    content: str | None = None
    target: str | None = Field(default=None, pattern=r"^(all|agents|users)$")
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class AnnouncementResponse(BaseModel):
    id: int
    type: str
    title: str
    content: str
    target: str
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    created_by: int | None
    created_at: datetime


class AnnouncementListResponse(BaseModel):
    items: list[AnnouncementResponse]
    total: int
    page: int
    page_size: int
