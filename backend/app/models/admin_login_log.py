from datetime import datetime, timezone

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class AdminLoginLog(SQLModel, table=True):
    __tablename__ = "admin_login_logs"

    id: int | None = Field(default=None, primary_key=True)
    admin_user_id: int = Field(foreign_key="admin_users.id", index=True)
    ip_address: str | None = Field(default=None, max_length=45)
    user_agent: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    device: str | None = Field(default=None, max_length=50)
    os: str | None = Field(default=None, max_length=50)
    browser: str | None = Field(default=None, max_length=50)
    logged_in_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
