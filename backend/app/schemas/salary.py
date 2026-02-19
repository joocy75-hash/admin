"""Salary management schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

# ─── Salary Config ──────────────────────────────────────────────

class SalaryConfigCreate(BaseModel):
    admin_user_id: int
    salary_type: str = Field(pattern=r"^(daily|weekly|monthly)$")
    base_rate: Decimal = Decimal("0")
    min_threshold: Decimal = Decimal("0")
    active: bool = True


class SalaryConfigUpdate(BaseModel):
    salary_type: str | None = Field(default=None, pattern=r"^(daily|weekly|monthly)$")
    base_rate: Decimal | None = None
    min_threshold: Decimal | None = None
    active: bool | None = None


class SalaryConfigResponse(BaseModel):
    id: int
    admin_user_id: int
    agent_username: str | None = None
    salary_type: str
    base_rate: Decimal
    min_threshold: Decimal
    active: bool
    created_at: datetime


class SalaryConfigListResponse(BaseModel):
    items: list[SalaryConfigResponse]
    total: int
    page: int
    page_size: int


# ─── Salary Payment ────────────────────────────────────────────

class SalaryPaymentCreate(BaseModel):
    agent_id: int
    config_id: int
    period_start: datetime
    period_end: datetime
    base_amount: Decimal = Decimal("0")
    performance_bonus: Decimal = Decimal("0")
    deductions: Decimal = Decimal("0")
    memo: str | None = None


class SalaryPaymentResponse(BaseModel):
    id: int
    agent_id: int
    agent_username: str | None = None
    config_id: int
    salary_type: str
    period_start: datetime
    period_end: datetime
    base_amount: Decimal
    performance_bonus: Decimal
    deductions: Decimal
    total_amount: Decimal
    status: str
    memo: str | None
    approved_by: int | None
    approved_by_username: str | None = None
    approved_at: datetime | None
    paid_at: datetime | None
    created_at: datetime


class SalaryPaymentListResponse(BaseModel):
    items: list[SalaryPaymentResponse]
    total: int
    page: int
    page_size: int


class PaymentActionBody(BaseModel):
    memo: str | None = None


class PaymentSummaryResponse(BaseModel):
    total_pending: int
    total_approved: int
    total_paid: int
    total_rejected: int
    pending_amount: Decimal
    approved_amount: Decimal
    paid_amount: Decimal
