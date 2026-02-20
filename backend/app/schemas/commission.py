"""Commission system schemas: policies, overrides, ledger, webhooks."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

# ─── Commission Policy ────────────────────────────────────────────

class CommissionPolicyCreate(BaseModel):
    name: str = Field(max_length=100)
    type: str = Field(pattern=r"^(rolling|losing|deposit)$")
    level_rates: dict[str, float] = Field(
        default={},
        description='Level-based rates, e.g. {"1": 0.5, "2": 0.3}',
    )
    game_category: str | None = Field(
        default=None,
        pattern=r"^(casino|slot|holdem|sports|shooting|coin|mini_game)$",
    )
    min_bet_amount: Decimal = Field(default=Decimal("0"), ge=0)
    active: bool = True
    priority: int = 0


class CommissionPolicyUpdate(BaseModel):
    name: str | None = None
    level_rates: dict[str, float] | None = None
    game_category: str | None = None
    min_bet_amount: Decimal | None = None
    active: bool | None = None
    priority: int | None = None


class CommissionPolicyResponse(BaseModel):
    id: int
    name: str
    type: str
    level_rates: dict[str, float]
    game_category: str | None
    min_bet_amount: Decimal
    active: bool
    priority: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommissionPolicyListResponse(BaseModel):
    items: list[CommissionPolicyResponse]
    total: int
    page: int
    page_size: int


# ─── Agent Commission Override ────────────────────────────────────

class OverrideCreate(BaseModel):
    admin_user_id: int
    policy_id: int
    custom_rates: dict[str, float] = Field(
        description='Override rates, e.g. {"1": 0.7, "2": 0.4}',
    )
    active: bool = True


class OverrideUpdate(BaseModel):
    custom_rates: dict[str, float] | None = None
    active: bool | None = None


class OverrideResponse(BaseModel):
    id: int
    admin_user_id: int
    policy_id: int
    custom_rates: dict[str, float] | None
    active: bool
    created_at: datetime
    # Joined fields
    agent_username: str | None = None
    agent_code: str | None = None
    policy_name: str | None = None

    model_config = {"from_attributes": True}


# ─── Commission Ledger ────────────────────────────────────────────

class LedgerResponse(BaseModel):
    id: int
    uuid: str
    recipient_user_id: int
    user_id: int
    agent_id: int | None = None
    policy_id: int | None = None
    type: str
    level: int
    game_category: str | None = None
    source_amount: Decimal
    rate: Decimal
    commission_amount: Decimal
    status: str
    reference_type: str | None
    reference_id: str | None
    settlement_id: int | None
    settled_at: datetime | None
    description: str | None
    created_at: datetime
    # Joined fields
    recipient_username: str | None = None
    user_username: str | None = None

    model_config = {"from_attributes": True}


class LedgerListResponse(BaseModel):
    items: list[LedgerResponse]
    total: int
    page: int
    page_size: int
    total_commission: Decimal = Decimal("0")


class LedgerSummary(BaseModel):
    type: str
    total_amount: Decimal
    count: int


# ─── Agent Commission Rate (Hierarchical) ────────────────────────

class AgentCommissionRateResponse(BaseModel):
    id: int
    agent_id: int
    game_category: str
    commission_type: str
    rate: Decimal
    updated_at: datetime
    agent_username: str | None = None
    agent_code: str | None = None

    model_config = {"from_attributes": True}


class AgentCommissionRateUpdate(BaseModel):
    game_category: str = Field(
        pattern=r"^(casino|slot|holdem|sports|shooting|coin|mini_game)$",
    )
    commission_type: str = Field(pattern=r"^(rolling|losing)$")
    rate: Decimal = Field(ge=0, le=100)


class AgentCommissionRateBulkUpdate(BaseModel):
    rates: list[AgentCommissionRateUpdate]


# ─── Webhook Payloads ─────────────────────────────────────────────

class BetWebhook(BaseModel):
    """Webhook for a new bet event — triggers rolling commission."""
    user_id: int
    game_category: str = Field(pattern=r"^(casino|slot|holdem|sports|shooting|coin|mini_game)$")
    game_code: str | None = None
    round_id: str
    bet_amount: Decimal = Field(gt=0)


class RoundResultWebhook(BaseModel):
    """Webhook for game round result — triggers losing commission on losses."""
    user_id: int
    game_category: str = Field(pattern=r"^(casino|slot|holdem|sports|shooting|coin|mini_game)$")
    game_code: str | None = None
    round_id: str
    bet_amount: Decimal = Field(gt=0)
    win_amount: Decimal = Field(ge=0)
    result: str = Field(pattern=r"^(win|lose|draw|push)$")
