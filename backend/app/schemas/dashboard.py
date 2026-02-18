"""Dashboard statistics schemas."""

from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_agents: int = 0
    total_users: int = 0
    today_deposits: Decimal = Decimal("0")
    today_withdrawals: Decimal = Decimal("0")
    today_bets: Decimal = Decimal("0")
    today_commissions: Decimal = Decimal("0")
    total_balance: Decimal = Decimal("0")
    active_games: int = 0
    pending_deposits: int = 0
    pending_withdrawals: int = 0


class RecentTransaction(BaseModel):
    id: int
    user_id: int
    user_username: str | None = None
    type: str
    action: str
    amount: Decimal
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RecentCommission(BaseModel):
    id: int
    agent_id: int
    agent_username: str | None = None
    type: str
    commission_amount: Decimal
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
