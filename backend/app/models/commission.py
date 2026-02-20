from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class CommissionPolicy(SQLModel, table=True):
    __tablename__ = "commission_policies"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    type: str = Field(max_length=20, index=True)  # rolling, losing, deposit, cpa, sub_level

    # Level rates as JSON: {"1": 0.5, "2": 0.3, "3": 0.1, ...}
    level_rates: dict = Field(default={}, sa_column=Column(JSONB, nullable=False, server_default="{}"))

    # Conditions
    game_category: str | None = Field(default=None, max_length=50, index=True)
    min_bet_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)

    active: bool = Field(default=True)
    priority: int = Field(default=0)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentCommissionOverride(SQLModel, table=True):
    __tablename__ = "agent_commission_overrides"

    id: int | None = Field(default=None, primary_key=True)
    admin_user_id: int = Field(foreign_key="admin_users.id", index=True)
    policy_id: int = Field(foreign_key="commission_policies.id")

    # Override rates (NULL = use policy default)
    custom_rates: dict | None = Field(default=None, sa_column=Column(JSONB))

    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CommissionLedger(SQLModel, table=True):
    """Commission ledger - records every commission event.

    MLM model: user_id = bettor, recipient_user_id = who earns the commission (User).
    agent_id is kept nullable for legacy/admin-override scenarios.
    """

    __tablename__ = "commission_ledger"
    __table_args__ = (
        UniqueConstraint("reference_id", "user_id", "type", "recipient_user_id", name="uq_ledger_idempotency"),
    )

    id: int | None = Field(default=None, primary_key=True)
    uuid: UUID = Field(default_factory=uuid4, unique=True)

    # Who earns the commission (User in MLM tree, including self-rolling)
    recipient_user_id: int = Field(foreign_key="users.id", index=True)
    # The bettor (who placed the bet)
    user_id: int = Field(foreign_key="users.id", index=True)
    # Legacy/admin agent reference (nullable)
    agent_id: int | None = Field(default=None, foreign_key="admin_users.id", index=True)
    policy_id: int | None = Field(default=None, foreign_key="commission_policies.id")

    type: str = Field(max_length=20, index=True)  # rolling, losing
    level: int = Field(default=0)  # 0=self, 1=direct referrer, 2=grandparent, ...
    game_category: str | None = Field(default=None, max_length=50, index=True)

    source_amount: Decimal = Field(max_digits=18, decimal_places=2)
    rate: Decimal = Field(max_digits=5, decimal_places=4)
    commission_amount: Decimal = Field(max_digits=18, decimal_places=2)

    # State machine: pending → settled → withdrawn / pending → cancelled
    status: str = Field(default="pending", max_length=20, index=True)

    reference_type: str | None = Field(default=None, max_length=50)
    reference_id: str | None = Field(default=None, max_length=100)

    settlement_id: int | None = Field(default=None, foreign_key="settlements.id")
    settled_at: datetime | None = Field(default=None)

    description: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
