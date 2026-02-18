from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class UserLoginHistory(SQLModel, table=True):
    __tablename__ = "user_login_history"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    login_ip: str = Field(max_length=45)
    user_agent: str | None = Field(default=None, max_length=500)
    device_type: str | None = Field(default=None, max_length=20)
    os: str | None = Field(default=None, max_length=50)
    browser: str | None = Field(default=None, max_length=50)
    country: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=100)
    login_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    logout_at: datetime | None = Field(default=None)
