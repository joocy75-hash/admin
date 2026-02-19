from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class Mission(SQLModel, table=True):
    __tablename__ = "missions"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    rules: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    type: str = Field(default="daily", max_length=20)
    bonus_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    max_participants: int = Field(default=0)
    is_active: bool = Field(default=True)
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
