from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class UserNullBettingConfig(SQLModel, table=True):
    __tablename__ = "user_null_betting_configs"
    __table_args__ = (UniqueConstraint("user_id", "game_category"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    game_category: str = Field(max_length=30)
    every_n_bets: int = Field(default=0)
    inherit_to_children: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
