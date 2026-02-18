from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Settlement(SQLModel, table=True):
    __tablename__ = "settlements"

    id: int | None = Field(default=None, primary_key=True)
    uuid: UUID = Field(default_factory=uuid4, unique=True)

    agent_id: int = Field(foreign_key="admin_users.id", index=True)

    period_start: datetime
    period_end: datetime

    rolling_total: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    losing_total: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    deposit_total: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    sub_level_total: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    gross_total: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    deductions: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    net_total: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)

    # State: draft → confirmed → paid / draft → rejected
    status: str = Field(default="draft", max_length=20, index=True)

    confirmed_by: int | None = Field(default=None, foreign_key="admin_users.id")
    confirmed_at: datetime | None = Field(default=None)
    paid_at: datetime | None = Field(default=None)

    memo: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
