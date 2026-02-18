"""Backup management schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


# ─── Response ───────────────────────────────────────────────────

class BackupItem(BaseModel):
    id: str
    filename: str
    size_bytes: int
    size_human: str
    created_at: datetime


class BackupListResponse(BaseModel):
    items: list[BackupItem]


class BackupCreateResponse(BaseModel):
    backup_id: str
    filename: str
    size_bytes: int
    created_at: datetime
    status: str


class BackupSettingsResponse(BaseModel):
    auto_backup_enabled: bool
    schedule: str
    retention_days: int
    backup_path: str


# ─── Request ────────────────────────────────────────────────────

class BackupSettingsUpdate(BaseModel):
    auto_backup_enabled: bool | None = None
    schedule: str | None = Field(default=None, max_length=50)
    retention_days: int | None = Field(default=None, ge=1, le=365)
