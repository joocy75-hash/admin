from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class BetSummary(BaseModel):
    total_bet: Decimal
    total_win: Decimal
    net_profit: Decimal


class BetRecordResponse(BaseModel):
    id: int
    game_category: str
    provider: str | None
    game_name: str | None
    round_id: str | None
    bet_amount: Decimal
    win_amount: Decimal
    profit: Decimal
    status: str
    bet_at: datetime
    settled_at: datetime | None


class BetRecordListResponse(BaseModel):
    items: list[BetRecordResponse]
    total: int
    page: int
    page_size: int
    summary: BetSummary


class MoneySummary(BaseModel):
    current_balance: Decimal
    total_credit: Decimal
    total_debit: Decimal


class MoneyLogResponse(BaseModel):
    id: int
    type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    description: str | None
    reference_type: str | None
    created_at: datetime


class MoneyLogListResponse(BaseModel):
    items: list[MoneyLogResponse]
    total: int
    page: int
    page_size: int
    summary: MoneySummary


class PointSummary(BaseModel):
    current_points: Decimal
    total_credit: Decimal
    total_debit: Decimal


class PointLogResponse(BaseModel):
    id: int
    type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    description: str | None
    reference_type: str | None
    created_at: datetime


class PointLogListResponse(BaseModel):
    items: list[PointLogResponse]
    total: int
    page: int
    page_size: int
    summary: PointSummary


class LoginHistoryResponse(BaseModel):
    id: int
    login_ip: str
    user_agent: str | None
    device_type: str | None
    os: str | None
    browser: str | None
    country: str | None
    city: str | None
    login_at: datetime
    logout_at: datetime | None


class LoginHistoryListResponse(BaseModel):
    items: list[LoginHistoryResponse]
    total: int
    page: int
    page_size: int
