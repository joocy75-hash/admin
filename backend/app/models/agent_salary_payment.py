from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel


class AgentSalaryPayment(SQLModel, table=True):
    __tablename__ = "agent_salary_payments"

    id: int | None = Field(default=None, primary_key=True)
    agent_id: int = Field(foreign_key="admin_users.id", index=True)
    config_id: int = Field(foreign_key="agent_salary_configs.id")
    salary_type: str = Field(max_length=20)  # daily, weekly, monthly
    period_start: datetime
    period_end: datetime
    base_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    performance_bonus: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    deductions: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    total_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    status: str = Field(default="pending", max_length=20, index=True)  # pending, approved, paid, rejected
    memo: str | None = Field(default=None)
    approved_by: int | None = Field(default=None, foreign_key="admin_users.id")
    approved_at: datetime | None = Field(default=None)
    paid_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
