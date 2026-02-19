from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class UserGameRollingRate(SQLModel, table=True):
    __tablename__ = "user_game_rolling_rates"
    __table_args__ = (UniqueConstraint("user_id", "game_category", "provider"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    game_category: str = Field(max_length=30)
    provider: str | None = Field(default=None, max_length=50)
    rolling_rate: Decimal = Field(max_digits=5, decimal_places=2)
    losing_rate: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
