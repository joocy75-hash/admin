from datetime import datetime, timezone

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class SpinConfig(SQLModel, table=True):
    __tablename__ = "spin_configs"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(default="기본 룰렛", max_length=100)
    prizes: list = Field(default=[], sa_column=Column(JSONB, nullable=False, server_default="[]"))
    max_spins_daily: int = Field(default=1)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
