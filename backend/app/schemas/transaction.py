"""Pydantic schemas for transaction (deposit/withdrawal/adjustment) management."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class DepositCreate(BaseModel):
    user_id: int
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    memo: str | None = None


class WithdrawalCreate(BaseModel):
    user_id: int
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    memo: str | None = None


class AdjustmentCreate(BaseModel):
    user_id: int
    action: str = Field(pattern=r"^(credit|debit)$")
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    memo: str | None = None


class TransactionAction(BaseModel):
    memo: str | None = None


class TransactionResponse(BaseModel):
    id: int
    uuid: str
    user_id: int
    user_username: str | None = None
    type: str
    action: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    status: str
    reference_type: str | None
    reference_id: str | None
    memo: str | None
    processed_by: int | None
    processed_by_username: str | None = None
    processed_at: datetime | None
    created_at: datetime


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_amount: Decimal = Decimal("0")


class TransactionSummary(BaseModel):
    type: str
    status: str
    count: int
    total_amount: Decimal
