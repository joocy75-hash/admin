"""Report schemas: agent, commission, financial reports."""

from decimal import Decimal

from pydantic import BaseModel


class AgentReportItem(BaseModel):
    agent_id: int
    username: str
    agent_code: str
    role: str
    total_users: int = 0
    total_bets: Decimal = Decimal("0")
    total_commissions: Decimal = Decimal("0")


class AgentReportResponse(BaseModel):
    items: list[AgentReportItem]
    start_date: str
    end_date: str


class CommissionReportItem(BaseModel):
    type: str
    total_amount: Decimal = Decimal("0")
    count: int = 0


class CommissionReportByAgent(BaseModel):
    agent_id: int
    username: str
    rolling_total: Decimal = Decimal("0")
    losing_total: Decimal = Decimal("0")


class CommissionReportResponse(BaseModel):
    items: list[CommissionReportItem]
    by_agent: list[CommissionReportByAgent]
    start_date: str
    end_date: str


class FinancialReportResponse(BaseModel):
    total_deposits: Decimal = Decimal("0")
    total_withdrawals: Decimal = Decimal("0")
    net_revenue: Decimal = Decimal("0")
    total_commissions: Decimal = Decimal("0")
    deposit_count: int = 0
    withdrawal_count: int = 0
    start_date: str
    end_date: str
