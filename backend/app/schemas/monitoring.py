"""Monitoring schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class RealtimeStatsResponse(BaseModel):
    active_users: int = 0
    pending_deposits: int = 0
    pending_withdrawals: int = 0
    today_revenue: Decimal = Decimal("0")
    today_deposits: Decimal = Decimal("0")
    today_withdrawals: Decimal = Decimal("0")


class LiveTransactionResponse(BaseModel):
    id: int
    user_id: int
    user_username: str | None = None
    type: str
    action: str
    amount: Decimal
    status: str
    coin_type: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActiveAlertsResponse(BaseModel):
    active_count: int = 0
    recent_alerts: list[dict] = []


class HealthCheckResponse(BaseModel):
    status: str
    version: str
    service: str
    checks: dict[str, str]
