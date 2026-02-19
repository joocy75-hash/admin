from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel


class AttendanceConfig(SQLModel, table=True):
    __tablename__ = "attendance_configs"

    id: int | None = Field(default=None, primary_key=True)
    day_number: int = Field(unique=True)
    reward_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    reward_type: str = Field(default="cash", max_length=10)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
