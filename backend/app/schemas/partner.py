"""Partner dashboard schemas."""

from datetime import datetime

from pydantic import BaseModel


class PartnerDashboardStats(BaseModel):
    total_sub_users: int = 0
    total_sub_agents: int = 0
    total_bet_amount: float = 0
    total_commission: float = 0
    month_settlement: float = 0
    month_bet_amount: float = 0


class PartnerUserItem(BaseModel):
    id: int
    username: str
    status: str
    balance: float
    total_bet: float
    total_win: float
    created_at: datetime


class PartnerUserListResponse(BaseModel):
    items: list[PartnerUserItem]
    total: int
    page: int
    page_size: int


class PartnerCommissionItem(BaseModel):
    id: int
    type: str
    source_amount: float
    rate: float
    commission_amount: float
    status: str
    reference_id: str | None = None
    created_at: datetime


class PartnerCommissionListResponse(BaseModel):
    items: list[PartnerCommissionItem]
    total: int
    page: int
    page_size: int
    total_commission: float = 0


class PartnerSettlementItem(BaseModel):
    id: int
    period_start: datetime
    period_end: datetime
    total_commission: float
    status: str
    paid_at: datetime | None = None
    created_at: datetime


class PartnerSettlementListResponse(BaseModel):
    items: list[PartnerSettlementItem]
    total: int
    page: int
    page_size: int


class PartnerTreeNode(BaseModel):
    id: int
    username: str
    role: str
    level: int
    status: str
    agent_code: str | None = None
