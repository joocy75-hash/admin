"""IP restriction management schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


# ─── Create / Update ────────────────────────────────────────────

class IpRestrictionCreate(BaseModel):
    type: str = Field(pattern=r"^(whitelist|blacklist)$")
    ip_address: str = Field(max_length=45)
    description: str | None = None


class IpRestrictionUpdate(BaseModel):
    ip_address: str | None = None
    description: str | None = None
    is_active: bool | None = None


# ─── Response ───────────────────────────────────────────────────

class IpRestrictionResponse(BaseModel):
    id: int
    type: str
    ip_address: str
    description: str | None
    is_active: bool
    created_by: int | None
    created_by_username: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IpRestrictionListResponse(BaseModel):
    items: list[IpRestrictionResponse]
    total: int
    page: int
    page_size: int


class IpCheckResponse(BaseModel):
    allowed: bool
    matched_rule: IpRestrictionResponse | None = None


class IpStatsResponse(BaseModel):
    whitelist_total: int
    blacklist_total: int
    active: int
    inactive: int


# ─── Bulk ───────────────────────────────────────────────────────

class BulkIpItem(BaseModel):
    type: str = Field(pattern=r"^(whitelist|blacklist)$")
    ip_address: str = Field(max_length=45)
    description: str | None = None


class BulkIpCreate(BaseModel):
    ips: list[BulkIpItem]
