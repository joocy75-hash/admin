from datetime import datetime, timezone

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class AdminNotification(SQLModel, table=True):
    __tablename__ = "admin_notifications"

    id: int | None = Field(default=None, primary_key=True)
    admin_user_id: int = Field(foreign_key="admin_users.id", index=True)

    type: str = Field(max_length=30, index=True)  # transaction, user, system, alert, settlement
    title: str = Field(max_length=200)
    message: str | None = Field(default=None)
    data: dict | None = Field(default=None, sa_column=Column(JSONB))

    is_read: bool = Field(default=False, index=True)
    priority: str = Field(default="normal", max_length=20, index=True)  # low, normal, high, urgent
    link: str | None = Field(default=None, max_length=500)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
