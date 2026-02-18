"""BI Dashboard analytics schemas."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


# ─── Revenue ────────────────────────────────────────────────────

class RevenueSummaryResponse(BaseModel):
    total_deposits: Decimal
    total_withdrawals: Decimal
    net_revenue: Decimal
    period: str
    prev_deposits: Decimal
    prev_withdrawals: Decimal
    prev_net: Decimal
    deposit_change_pct: float
    withdrawal_change_pct: float
    revenue_change_pct: float


class RevenueTrendItem(BaseModel):
    date: date
    deposits: Decimal
    withdrawals: Decimal
    net: Decimal
    cumulative_net: Decimal


class RevenueTrendResponse(BaseModel):
    items: list[RevenueTrendItem]
    days: int


# ─── Users ──────────────────────────────────────────────────────

class UserRetentionResponse(BaseModel):
    new_users: int
    active_users: int
    total_users: int
    active_ratio: float
    churn_rate: float
    period: str


class CohortItem(BaseModel):
    registration_month: str
    month_0_pct: float
    month_1_pct: float
    month_2_pct: float
    month_3_pct: float


class CohortResponse(BaseModel):
    items: list[CohortItem]


# ─── Games ──────────────────────────────────────────────────────

class GamePerformanceItem(BaseModel):
    game_id: int | None = None
    game_name: str
    total_bet: Decimal
    total_win: Decimal
    rtp_pct: float
    player_count: int
    avg_bet: Decimal


class GamePerformanceResponse(BaseModel):
    items: list[GamePerformanceItem]


# ─── Agents ─────────────────────────────────────────────────────

class AgentPerformanceItem(BaseModel):
    agent_id: int
    agent_name: str
    downline_count: int
    total_deposit: Decimal
    total_bet: Decimal
    commission_earned: Decimal
    net_revenue: Decimal


class AgentPerformanceResponse(BaseModel):
    items: list[AgentPerformanceItem]


# ─── Overview ───────────────────────────────────────────────────

class OverviewResponse(BaseModel):
    total_users: int
    active_today: int
    deposits_today: Decimal
    withdrawals_today: Decimal
    net_revenue_today: Decimal
    bets_today: Decimal
    new_registrations_today: int
    pending_withdrawals: int
