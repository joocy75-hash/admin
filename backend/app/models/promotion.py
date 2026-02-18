from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class Promotion(SQLModel, table=True):
    __tablename__ = "promotions"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    type: str = Field(max_length=30, index=True)  # first_deposit, reload, cashback, event, attendance, referral
    description: str | None = Field(default=None)
    bonus_type: str = Field(max_length=20)  # percent, fixed
    bonus_value: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    min_deposit: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    max_bonus: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    wagering_multiplier: int = Field(default=1)
    target: str = Field(default="all", max_length=20)  # all, vip_level, new_users
    target_value: str | None = Field(default=None, max_length=50)
    max_claims_per_user: int = Field(default=1)
    max_total_claims: int = Field(default=0)  # 0=unlimited
    total_claimed: int = Field(default=0)
    rules: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    is_active: bool = Field(default=True, index=True)
    priority: int = Field(default=0)
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)
    created_by: int | None = Field(default=None, foreign_key="admin_users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserPromotion(SQLModel, table=True):
    __tablename__ = "user_promotions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    promotion_id: int = Field(foreign_key="promotions.id", index=True)
    status: str = Field(default="active", max_length=20, index=True)  # active, completed, expired, cancelled
    bonus_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    wagering_required: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    wagering_completed: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    deposit_tx_id: int | None = Field(default=None)
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)


class Coupon(SQLModel, table=True):
    __tablename__ = "coupons"

    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(max_length=50, unique=True, index=True)
    promotion_id: int = Field(foreign_key="promotions.id", index=True)
    max_uses: int = Field(default=1)
    used_count: int = Field(default=0)
    is_active: bool = Field(default=True)
    expires_at: datetime | None = Field(default=None)
    created_by: int | None = Field(default=None, foreign_key="admin_users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCoupon(SQLModel, table=True):
    __tablename__ = "user_coupons"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    coupon_id: int = Field(foreign_key="coupons.id", index=True)
    bonus_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
