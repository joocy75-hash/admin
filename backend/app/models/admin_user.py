from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel


class AdminUser(SQLModel, table=True):
    __tablename__ = "admin_users"

    id: int | None = Field(default=None, primary_key=True)
    uuid: UUID = Field(default_factory=uuid4, unique=True, index=True)
    username: str = Field(max_length=50, unique=True, index=True)
    email: str | None = Field(default=None, max_length=255, unique=True)
    password_hash: str = Field(max_length=255)

    # Agent hierarchy
    role: str = Field(default="agent", max_length=20, index=True)
    parent_id: int | None = Field(default=None, foreign_key="admin_users.id", index=True)
    depth: int = Field(default=0)
    agent_code: str = Field(max_length=20, unique=True, index=True)

    # Status
    status: str = Field(default="active", max_length=20, index=True)
    max_sub_agents: int = Field(default=100)

    # Commission overrides (NULL = use policy default)
    rolling_rate: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    losing_rate: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    deposit_rate: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)

    # Wallet
    balance: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    pending_balance: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)

    # Security
    two_factor_secret: str | None = Field(default=None, max_length=255)
    two_factor_enabled: bool = Field(default=False)
    last_login_at: datetime | None = Field(default=None)
    last_login_ip: str | None = Field(default=None, max_length=45)

    # Meta
    memo: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdminUserTree(SQLModel, table=True):
    """Closure Table for agent hierarchy. Stores all ancestor-descendant pairs."""

    __tablename__ = "admin_user_tree"

    ancestor_id: int = Field(foreign_key="admin_users.id", primary_key=True)
    descendant_id: int = Field(foreign_key="admin_users.id", primary_key=True)
    depth: int = Field(default=0)
