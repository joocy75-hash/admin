"""Settlement system schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SettlementCreate(BaseModel):
    agent_id: int
    period_start: str = Field(description="YYYY-MM-DD")
    period_end: str = Field(description="YYYY-MM-DD")
    memo: str | None = None


class SettlementResponse(BaseModel):
    id: int
    uuid: str
    agent_id: int
    period_start: datetime
    period_end: datetime
    rolling_total: Decimal
    losing_total: Decimal
    deposit_total: Decimal
    sub_level_total: Decimal
    gross_total: Decimal
    deductions: Decimal
    net_total: Decimal
    status: str
    confirmed_by: int | None
    confirmed_at: datetime | None
    paid_at: datetime | None
    memo: str | None
    created_at: datetime
    # Joined
    agent_username: str | None = None
    agent_code: str | None = None
    confirmed_by_username: str | None = None

    model_config = {"from_attributes": True}


class SettlementListResponse(BaseModel):
    items: list[SettlementResponse]
    total: int
    page: int
    page_size: int


class SettlementPreview(BaseModel):
    agent_id: int
    agent_username: str
    period_start: str
    period_end: str
    rolling_total: Decimal
    losing_total: Decimal
    deposit_total: Decimal
    gross_total: Decimal
    pending_entries: int


class SettlementAction(BaseModel):
    memo: str | None = None
