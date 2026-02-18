from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class TransactionLimit(SQLModel, table=True):
    __tablename__ = "transaction_limits"
    __table_args__ = (UniqueConstraint("scope_type", "scope_id", "tx_type"),)

    id: int | None = Field(default=None, primary_key=True)
    scope_type: str = Field(max_length=20, index=True)  # global, vip_level, user
    scope_id: int = Field(default=0)  # 0=global, vip_level.level, user.id
    tx_type: str = Field(max_length=20)  # deposit, withdrawal
    min_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    max_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    daily_limit: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    daily_count: int = Field(default=0)
    monthly_limit: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    is_active: bool = Field(default=True)
    updated_by: int | None = Field(default=None, foreign_key="admin_users.id")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
