from datetime import datetime

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: int | None = Field(default=None, primary_key=True)

    admin_user_id: int | None = Field(default=None, foreign_key="admin_users.id", index=True)
    ip_address: str | None = Field(default=None, max_length=45)
    user_agent: str | None = Field(default=None)

    action: str = Field(max_length=50, index=True)  # create, update, delete, login, export
    module: str = Field(max_length=50, index=True)  # users, agents, commission, settlement
    resource_type: str | None = Field(default=None, max_length=50)
    resource_id: str | None = Field(default=None, max_length=100)

    before_data: dict | None = Field(default=None, sa_column=Column(JSONB))
    after_data: dict | None = Field(default=None, sa_column=Column(JSONB))

    description: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
