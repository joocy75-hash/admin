from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    uuid: UUID = Field(default_factory=uuid4, unique=True, index=True)
    username: str = Field(max_length=50, unique=True, index=True)
    nickname: str | None = Field(default=None, max_length=50)
    real_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20, index=True)
    email: str | None = Field(default=None, max_length=255)
    color: str | None = Field(default=None, max_length=7)
    password_hash: str | None = Field(default=None, max_length=255)

    # Referral tree (self-referencing)
    referrer_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    depth: int = Field(default=0)

    # Rank: agency (default), distributor (1+ referrals), sub_hq (2nd gen exists)
    rank: str = Field(default="agency", max_length=20, index=True)

    balance: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    points: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    status: str = Field(default="active", max_length=20, index=True)
    level: int = Field(default=1)

    # Registration
    registration_ip: str | None = Field(default=None, max_length=45)

    # Crypto deposit address (assigned by system)
    deposit_address: str | None = Field(default=None, max_length=255)
    deposit_network: str | None = Field(default=None, max_length=20)  # TRC20, ERC20, BEP20

    # Aggregated stats
    total_deposit: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    total_withdrawal: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    total_bet: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    total_win: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    login_count: int = Field(default=0)

    memo: str | None = Field(default=None)
    last_login_at: datetime | None = Field(default=None)
    last_login_ip: str | None = Field(default=None, max_length=45)
    last_deposit_at: datetime | None = Field(default=None)
    last_bet_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserTree(SQLModel, table=True):
    """Closure Table for user referral hierarchy."""
    __tablename__ = "user_tree"

    ancestor_id: int = Field(foreign_key="users.id", primary_key=True)
    descendant_id: int = Field(foreign_key="users.id", primary_key=True)
    depth: int = Field(default=0)
