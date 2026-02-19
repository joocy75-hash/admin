from datetime import datetime, timezone

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class PopupNotice(SQLModel, table=True):
    __tablename__ = "popup_notices"

    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(max_length=200)
    content: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    image_url: str | None = Field(default=None, max_length=500)
    display_type: str = Field(default="always", max_length=20)
    target: str = Field(default="all", max_length=20)
    priority: int = Field(default=0)
    is_active: bool = Field(default=True)
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
