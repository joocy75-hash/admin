from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel


class ExchangeRate(SQLModel, table=True):
    __tablename__ = "exchange_rates"

    id: int | None = Field(default=None, primary_key=True)
    pair: str = Field(max_length=20, unique=True)
    rate: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=4)
    source: str | None = Field(default=None, max_length=50)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
