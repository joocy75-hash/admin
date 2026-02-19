"""Pydantic schemas for promotion/bonus/coupon management."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

# ─── Promotion Schemas ───────────────────────────────────────────

class PromotionCreate(BaseModel):
    name: str = Field(max_length=200)
    type: str = Field(pattern=r'^(first_deposit|reload|cashback|event|attendance|referral)$')
    description: str | None = None
    bonus_type: str = Field(pattern=r'^(percent|fixed)$')
    bonus_value: Decimal = Field(ge=0)
    min_deposit: Decimal = Field(default=Decimal('0'), ge=0)
    max_bonus: Decimal = Field(default=Decimal('0'), ge=0)
    wagering_multiplier: int = Field(default=1, ge=1)
    target: str = Field(default='all', pattern=r'^(all|vip_level|new_users)$')
    target_value: str | None = None
    max_claims_per_user: int = Field(default=1, ge=1)
    max_total_claims: int = Field(default=0, ge=0)
    rules: dict = Field(default_factory=dict)
    is_active: bool = True
    priority: int = Field(default=0, ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromotionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    type: str | None = Field(default=None, pattern=r'^(first_deposit|reload|cashback|event|attendance|referral)$')
    description: str | None = None
    bonus_type: str | None = Field(default=None, pattern=r'^(percent|fixed)$')
    bonus_value: Decimal | None = Field(default=None, ge=0)
    min_deposit: Decimal | None = Field(default=None, ge=0)
    max_bonus: Decimal | None = Field(default=None, ge=0)
    wagering_multiplier: int | None = Field(default=None, ge=1)
    target: str | None = Field(default=None, pattern=r'^(all|vip_level|new_users)$')
    target_value: str | None = None
    max_claims_per_user: int | None = Field(default=None, ge=1)
    max_total_claims: int | None = Field(default=None, ge=0)
    rules: dict | None = None
    is_active: bool | None = None
    priority: int | None = Field(default=None, ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromotionResponse(BaseModel):
    id: int
    name: str
    type: str
    description: str | None
    bonus_type: str
    bonus_value: Decimal
    min_deposit: Decimal
    max_bonus: Decimal
    wagering_multiplier: int
    target: str
    target_value: str | None
    max_claims_per_user: int
    max_total_claims: int
    total_claimed: int
    rules: dict
    is_active: bool
    priority: int
    starts_at: datetime | None
    ends_at: datetime | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class PromotionDetailResponse(PromotionResponse):
    claim_stats: dict = Field(default_factory=dict)


class PromotionListResponse(BaseModel):
    items: list[PromotionResponse]
    total: int
    page: int
    page_size: int


# ─── Claim Schemas ───────────────────────────────────────────────

class PromotionClaimRequest(BaseModel):
    user_id: int
    deposit_amount: Decimal | None = Field(default=None, ge=0)


class PromotionClaimResponse(BaseModel):
    id: int
    user_id: int
    promotion_id: int
    status: str
    bonus_amount: Decimal
    wagering_required: Decimal
    wagering_completed: Decimal
    deposit_tx_id: int | None
    claimed_at: datetime
    expires_at: datetime | None
    completed_at: datetime | None


class UserClaimListResponse(BaseModel):
    items: list[PromotionClaimResponse]
    total: int
    page: int
    page_size: int


class ParticipantResponse(BaseModel):
    id: int
    user_id: int
    username: str | None
    promotion_id: int
    status: str
    bonus_amount: Decimal
    wagering_required: Decimal
    wagering_completed: Decimal
    claimed_at: datetime


class ParticipantListResponse(BaseModel):
    items: list[ParticipantResponse]
    total: int
    page: int
    page_size: int


# ─── Coupon Schemas ──────────────────────────────────────────────

class CouponCreate(BaseModel):
    code: str | None = Field(default=None, max_length=50)
    promotion_id: int
    max_uses: int = Field(default=1, ge=1)
    is_active: bool = True
    expires_at: datetime | None = None


class CouponBatchCreate(BaseModel):
    promotion_id: int
    count: int = Field(ge=1, le=500)
    prefix: str = Field(default='', max_length=10)
    max_uses: int = Field(default=1, ge=1)
    is_active: bool = True
    expires_at: datetime | None = None


class CouponUpdate(BaseModel):
    max_uses: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    expires_at: datetime | None = None


class CouponResponse(BaseModel):
    id: int
    code: str
    promotion_id: int
    promotion_name: str | None = None
    max_uses: int
    used_count: int
    is_active: bool
    expires_at: datetime | None
    created_by: int | None
    created_at: datetime


class CouponListResponse(BaseModel):
    items: list[CouponResponse]
    total: int
    page: int
    page_size: int


class CouponRedeemRequest(BaseModel):
    user_id: int
    code: str = Field(max_length=50)


class CouponRedeemResponse(BaseModel):
    coupon_id: int
    promotion_id: int
    bonus_amount: Decimal
    wagering_required: Decimal
    message: str


# ─── Stats Schemas ───────────────────────────────────────────────

class PromotionOverallStats(BaseModel):
    total_promotions: int
    active_promotions: int
    total_claimed: int
    total_bonus_given: Decimal


class PromotionSingleStats(BaseModel):
    promotion_id: int
    name: str
    total_claims: int
    total_bonus: Decimal
    unique_users: int
    claims_by_day: list[dict]
    claims_by_status: dict
