from datetime import datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


class BetRecord(SQLModel, table=True):
    __tablename__ = "bet_records"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    game_category: str = Field(max_length=30, index=True)
    provider: str | None = Field(default=None, max_length=50)
    game_name: str | None = Field(default=None, max_length=100)
    round_id: str | None = Field(default=None, max_length=100)
    bet_amount: Decimal = Field(max_digits=18, decimal_places=2)
    win_amount: Decimal = Field(max_digits=18, decimal_places=2)
    profit: Decimal = Field(max_digits=18, decimal_places=2)
    status: str = Field(default="pending", max_length=20)
    bet_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    settled_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
