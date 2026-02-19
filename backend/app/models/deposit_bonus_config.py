from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel


class DepositBonusConfig(SQLModel, table=True):
    __tablename__ = "deposit_bonus_configs"

    id: int | None = Field(default=None, primary_key=True)
    type: str = Field(max_length=20)
    bonus_percent: Decimal = Field(default=Decimal("0"), max_digits=5, decimal_places=2)
    max_bonus_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    min_deposit_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    rollover_multiplier: int = Field(default=1)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
