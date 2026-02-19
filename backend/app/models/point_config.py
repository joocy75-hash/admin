from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class PointConfig(SQLModel, table=True):
    __tablename__ = "point_configs"

    id: int | None = Field(default=None, primary_key=True)
    key: str = Field(max_length=50, unique=True)
    value: str = Field(default="", max_length=255)
    description: str | None = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
