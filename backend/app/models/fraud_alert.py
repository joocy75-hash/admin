from datetime import datetime, timezone

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class FraudAlert(SQLModel, table=True):
    __tablename__ = "fraud_alerts"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    alert_type: str = Field(max_length=30, index=True)  # large_deposit, rapid_withdrawal, unusual_pattern, ip_mismatch, multi_account
    severity: str = Field(max_length=20, index=True)  # low, medium, high, critical
    status: str = Field(default="open", max_length=20, index=True)  # open, investigating, resolved, false_positive

    description: str | None = Field(default=None)
    data: dict | None = Field(default=None, sa_column=Column(JSONB))

    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

    reviewed_by: int | None = Field(default=None, foreign_key="admin_users.id")
    reviewed_at: datetime | None = Field(default=None)
    resolution_note: str | None = Field(default=None)


class FraudRule(SQLModel, table=True):
    __tablename__ = "fraud_rules"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    rule_type: str = Field(max_length=30, index=True)
    condition: dict | None = Field(default=None, sa_column=Column(JSONB))
    severity: str = Field(default="medium", max_length=20)  # low, medium, high, critical
    is_active: bool = Field(default=True, index=True)

    created_by: int = Field(foreign_key="admin_users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
