from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class UserBettingPermission(SQLModel, table=True):
    __tablename__ = "user_betting_permissions"
    __table_args__ = (UniqueConstraint("user_id", "game_category"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    game_category: str = Field(max_length=30)
    is_allowed: bool = Field(default=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
