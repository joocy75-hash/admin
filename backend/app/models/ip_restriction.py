from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class IpRestriction(SQLModel, table=True):
    __tablename__ = "ip_restrictions"

    id: int | None = Field(default=None, primary_key=True)
    type: str = Field(max_length=20)  # whitelist, blacklist
    ip_address: str = Field(max_length=45)  # supports IPv6
    description: str | None = Field(default=None, max_length=200)
    is_active: bool = Field(default=True)
    created_by: int | None = Field(default=None, foreign_key="admin_users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
