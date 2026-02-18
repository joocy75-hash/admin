"""Pydantic schemas for audit log management."""

from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    admin_user_id: int | None
    admin_username: str | None = None
    ip_address: str | None
    user_agent: str | None
    action: str
    module: str
    resource_type: str | None
    resource_id: str | None
    before_data: dict | None
    after_data: dict | None
    description: str | None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
