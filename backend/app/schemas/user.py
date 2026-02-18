"""Pydantic schemas for user (member) management with referral tree."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    real_name: str | None = None
    phone: str | None = None
    email: str | None = None
    referrer_code: str | None = None  # referrer's username
    level: int = Field(default=1, ge=1, le=99)
    memo: str | None = None


class UserUpdate(BaseModel):
    real_name: str | None = None
    phone: str | None = None
    email: str | None = None
    nickname: str | None = None
    color: str | None = None
    status: str | None = Field(default=None, pattern=r"^(active|suspended|banned)$")
    level: int | None = Field(default=None, ge=1, le=99)
    memo: str | None = None


class UserResponse(BaseModel):
    id: int
    uuid: str
    username: str
    real_name: str | None
    phone: str | None
    email: str | None
    nickname: str | None = None
    color: str | None = None
    registration_ip: str | None = None
    virtual_account_bank: str | None = None
    virtual_account_number: str | None = None
    referrer_id: int | None
    referrer_username: str | None = None
    depth: int
    rank: str
    balance: Decimal
    points: Decimal
    status: str
    level: int
    direct_referral_count: int = 0
    total_deposit: Decimal = Decimal("0")
    total_withdrawal: Decimal = Decimal("0")
    total_bet: Decimal = Decimal("0")
    total_win: Decimal = Decimal("0")
    login_count: int = 0
    last_deposit_at: datetime | None = None
    last_bet_at: datetime | None = None
    memo: str | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int


class UserTreeNode(BaseModel):
    id: int
    username: str
    rank: str
    status: str
    depth: int
    referrer_id: int | None
    balance: float
    points: float


class UserTreeResponse(BaseModel):
    nodes: list[UserTreeNode]


# ─── User Detail (composite) ─────────────────────────────────────

class UserStatistics(BaseModel):
    total_deposit: Decimal = Decimal("0")
    total_withdrawal: Decimal = Decimal("0")
    total_bet: Decimal = Decimal("0")
    total_win: Decimal = Decimal("0")
    net_profit: Decimal = Decimal("0")
    deposit_withdrawal_diff: Decimal = Decimal("0")


class BankAccountResponse(BaseModel):
    id: int
    bank_name: str
    bank_code: str | None
    account_number: str
    holder_name: str
    is_primary: bool
    status: str


class BankAccountCreate(BaseModel):
    bank_name: str
    bank_code: str | None = None
    account_number: str
    holder_name: str
    is_primary: bool = False


class BankAccountUpdate(BaseModel):
    bank_name: str | None = None
    bank_code: str | None = None
    account_number: str | None = None
    holder_name: str | None = None
    is_primary: bool | None = None
    status: str | None = None


class BettingPermissionResponse(BaseModel):
    id: int
    game_category: str
    is_allowed: bool


class BettingPermissionUpdate(BaseModel):
    game_category: str
    is_allowed: bool


class NullBettingConfigResponse(BaseModel):
    id: int
    game_category: str
    every_n_bets: int
    inherit_to_children: bool


class NullBettingConfigUpdate(BaseModel):
    game_category: str
    every_n_bets: int
    inherit_to_children: bool = False


class GameRollingRateResponse(BaseModel):
    id: int
    game_category: str
    provider: str | None
    rolling_rate: Decimal


class GameRollingRateUpdate(BaseModel):
    game_category: str
    provider: str | None = None
    rolling_rate: Decimal


class PasswordSet(BaseModel):
    new_password: str = Field(min_length=6, max_length=100)


class UserDetailResponse(BaseModel):
    user: UserResponse
    statistics: UserStatistics
    bank_accounts: list[BankAccountResponse]
    betting_permissions: list[BettingPermissionResponse]
    null_betting_configs: list[NullBettingConfigResponse]
    game_rolling_rates: list[GameRollingRateResponse]


class UserSummaryStats(BaseModel):
    total_count: int
    active_count: int
    suspended_count: int
    banned_count: int
    pending_count: int
    total_balance: float
    total_points: float
