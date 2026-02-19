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
    model_config = {"extra": "forbid"}

    real_name: str | None = None
    phone: str | None = None
    email: str | None = None
    nickname: str | None = None
    color: str | None = None
    status: str | None = Field(default=None, pattern=r"^(active|suspended|banned)$")
    level: int | None = Field(default=None, ge=1, le=99)
    commission_enabled: bool | None = None
    commission_type: str | None = Field(default=None, pattern=r"^(rolling|losing)$")
    losing_rate: Decimal | None = Field(default=None, ge=0, le=50)
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
    deposit_address: str | None = None
    deposit_network: str | None = None
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
    commission_enabled: bool = True
    commission_type: str = "rolling"
    losing_rate: Decimal = Decimal("0")
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


class WalletAddressResponse(BaseModel):
    id: int
    coin_type: str
    network: str
    address: str
    label: str | None
    is_primary: bool
    status: str


class WalletAddressCreate(BaseModel):
    coin_type: str = Field(pattern=r"^(USDT|TRX|ETH|BTC|BNB)$")
    network: str = Field(pattern=r"^(TRC20|ERC20|BEP20|BTC)$")
    address: str = Field(min_length=10, max_length=255)
    label: str | None = None
    is_primary: bool = False


class WalletAddressUpdate(BaseModel):
    coin_type: str | None = Field(default=None, pattern=r"^(USDT|TRX|ETH|BTC|BNB)$")
    network: str | None = Field(default=None, pattern=r"^(TRC20|ERC20|BEP20|BTC)$")
    address: str | None = Field(default=None, min_length=10, max_length=255)
    label: str | None = None
    is_primary: bool | None = None
    status: str | None = Field(default=None, pattern=r"^(active|disabled)$")


class BettingPermissionResponse(BaseModel):
    id: int
    game_category: str
    is_allowed: bool


class BettingPermissionUpdate(BaseModel):
    game_category: str = Field(pattern=r"^(casino|slot|holdem|sports|shooting|coin|mini_game)$")
    is_allowed: bool


class NullBettingConfigResponse(BaseModel):
    id: int
    game_category: str
    every_n_bets: int
    inherit_to_children: bool


class NullBettingConfigUpdate(BaseModel):
    game_category: str = Field(pattern=r"^(casino|slot|holdem|sports|shooting|coin|mini_game)$")
    every_n_bets: int = Field(ge=1, le=1000)
    inherit_to_children: bool = False


class GameRollingRateResponse(BaseModel):
    id: int
    game_category: str
    provider: str | None
    rolling_rate: Decimal


class GameRollingRateUpdate(BaseModel):
    game_category: str = Field(pattern=r"^(casino|slot|holdem|sports|shooting|coin|mini_game)$")
    provider: str | None = None
    rolling_rate: Decimal = Field(ge=0, le=10)


class PasswordSet(BaseModel):
    new_password: str = Field(min_length=8, max_length=100)


class UserDetailResponse(BaseModel):
    user: UserResponse
    statistics: UserStatistics
    wallet_addresses: list[WalletAddressResponse]
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


class BulkStatusUpdate(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=100)
    status: str = Field(pattern=r"^(active|suspended|banned)$")
