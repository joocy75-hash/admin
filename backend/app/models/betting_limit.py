from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class BettingLimit(SQLModel, table=True):
    __tablename__ = "betting_limits"
    __table_args__ = (UniqueConstraint("scope_type", "scope_id", "game_category"),)

    id: int | None = Field(default=None, primary_key=True)
    scope_type: str = Field(max_length=20, index=True)  # global, vip_level, user
    scope_id: int = Field(default=0)  # 0=global, vip_level.level, user.id
    game_category: str = Field(max_length=30)  # casino, slot, holdem, sports, etc.
    min_bet: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    max_bet: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    max_daily_loss: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    is_active: bool = Field(default=True)
    updated_by: int | None = Field(default=None, foreign_key="admin_users.id")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
