from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel


class PaybackConfig(SQLModel, table=True):
    __tablename__ = "payback_configs"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    payback_percent: Decimal = Field(default=Decimal("0"), max_digits=5, decimal_places=2)
    payback_type: str = Field(default="cash", max_length=10)
    period: str = Field(default="daily", max_length=10)
    min_loss_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    max_payback_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
