from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class VipLevel(SQLModel, table=True):
    __tablename__ = "vip_levels"

    id: int | None = Field(default=None, primary_key=True)
    level: int = Field(unique=True, index=True)
    name: str = Field(max_length=50)
    min_total_deposit: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    min_total_bet: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    rolling_bonus_rate: Decimal = Field(default=Decimal("0"), max_digits=5, decimal_places=2)
    losing_bonus_rate: Decimal = Field(default=Decimal("0"), max_digits=5, decimal_places=2)
    deposit_limit_daily: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    withdrawal_limit_daily: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    withdrawal_limit_monthly: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    max_single_bet: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    benefits: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    color: str | None = Field(default=None, max_length=7)
    icon: str | None = Field(default=None, max_length=50)
    sort_order: int = Field(default=0)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserLevelHistory(SQLModel, table=True):
    __tablename__ = "user_level_history"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    from_level: int
    to_level: int
    reason: str = Field(max_length=100)
    changed_by: int | None = Field(default=None, foreign_key="admin_users.id")
    changed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
