from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class AgentCommissionRate(SQLModel, table=True):
    """Per-agent, per-game-category commission rates.
    Supports hierarchical distribution: sub-agent rate <= parent rate."""

    __tablename__ = "agent_commission_rates"
    __table_args__ = (
        UniqueConstraint("agent_id", "game_category", "commission_type"),
    )

    id: int | None = Field(default=None, primary_key=True)
    agent_id: int = Field(foreign_key="admin_users.id", index=True)
    game_category: str = Field(max_length=50)  # casino, slot, holdem, sports, etc.
    commission_type: str = Field(max_length=20)  # rolling, losing
    rate: Decimal = Field(default=Decimal("0"), max_digits=5, decimal_places=2)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: int | None = Field(default=None, foreign_key="admin_users.id")
