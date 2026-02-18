from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel


class MoneyLog(SQLModel, table=True):
    __tablename__ = "money_logs"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    type: str = Field(max_length=30, index=True)
    amount: Decimal = Field(max_digits=18, decimal_places=2)
    balance_before: Decimal = Field(max_digits=18, decimal_places=2)
    balance_after: Decimal = Field(max_digits=18, decimal_places=2)
    description: str | None = Field(default=None, max_length=200)
    reference_type: str | None = Field(default=None, max_length=50)
    reference_id: str | None = Field(default=None, max_length=100)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
