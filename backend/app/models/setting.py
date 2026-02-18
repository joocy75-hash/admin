from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class Setting(SQLModel, table=True):
    __tablename__ = "settings"
    __table_args__ = (UniqueConstraint("group_name", "key"),)

    id: int | None = Field(default=None, primary_key=True)
    group_name: str = Field(max_length=50, index=True)
    key: str = Field(max_length=100)
    value: dict = Field(sa_column=Column(JSONB, nullable=False))
    description: str | None = Field(default=None)
    updated_by: int | None = Field(default=None, foreign_key="admin_users.id")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Announcement(SQLModel, table=True):
    __tablename__ = "announcements"

    id: int | None = Field(default=None, primary_key=True)
    type: str = Field(max_length=20)  # notice, popup, banner
    title: str = Field(max_length=255)
    content: str
    target: str = Field(default="all", max_length=20)  # all, agents, users
    is_active: bool = Field(default=True)
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)
    created_by: int | None = Field(default=None, foreign_key="admin_users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentSalaryConfig(SQLModel, table=True):
    __tablename__ = "agent_salary_configs"
    __table_args__ = (UniqueConstraint("admin_user_id", "salary_type"),)

    id: int | None = Field(default=None, primary_key=True)
    admin_user_id: int = Field(foreign_key="admin_users.id")
    salary_type: str = Field(max_length=20)  # daily, weekly, monthly
    base_rate: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    min_threshold: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
