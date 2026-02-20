"""Promotion, bonus, and coupon management endpoints."""

import secrets
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.promotion import Coupon, Promotion, UserCoupon, UserPromotion
from app.models.user import User
from app.schemas.promotion import (
    CouponBatchCreate,
    CouponCreate,
    CouponListResponse,
    CouponRedeemRequest,
    CouponRedeemResponse,
    CouponResponse,
    CouponUpdate,
    ParticipantListResponse,
    ParticipantResponse,
    PromotionClaimRequest,
    PromotionClaimResponse,
    PromotionCreate,
    PromotionDetailResponse,
    PromotionListResponse,
    PromotionOverallStats,
    PromotionResponse,
    PromotionSingleStats,
    PromotionUpdate,
    UserClaimListResponse,
)

router = APIRouter(prefix="/promotions", tags=["promotions"])


# ─── Helpers ─────────────────────────────────────────────────────

def _promotion_to_response(p: Promotion) -> PromotionResponse:
    return PromotionResponse(
        id=p.id,
        name=p.name,
        type=p.type,
        description=p.description,
        bonus_type=p.bonus_type,
        bonus_value=p.bonus_value,
        min_deposit=p.min_deposit,
        max_bonus=p.max_bonus,
        wagering_multiplier=p.wagering_multiplier,
        target=p.target,
        target_value=p.target_value,
        max_claims_per_user=p.max_claims_per_user,
        max_total_claims=p.max_total_claims,
        total_claimed=p.total_claimed,
        rules=p.rules,
        is_active=p.is_active,
        priority=p.priority,
        starts_at=p.starts_at,
        ends_at=p.ends_at,
        created_by=p.created_by,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _generate_coupon_code(prefix: str = '') -> str:
    raw = secrets.token_urlsafe(6).upper()[:8]
    return f'{prefix}{raw}' if prefix else raw


def _calculate_bonus(
    promotion: Promotion,
    deposit_amount: Decimal | None,
) -> Decimal:
    if promotion.bonus_type == 'percent':
        if deposit_amount is None or deposit_amount <= 0:
            raise ValueError('deposit_amount is required for percent-type promotions')
        if deposit_amount < promotion.min_deposit:
            raise ValueError(
                f'Deposit amount {deposit_amount} is below minimum {promotion.min_deposit}'
            )
        bonus = deposit_amount * promotion.bonus_value / Decimal('100')
        if promotion.max_bonus > 0:
            bonus = min(bonus, promotion.max_bonus)
        return bonus
    # fixed
    return promotion.bonus_value


def _validate_promotion_active(promotion: Promotion) -> None:
    if not promotion.is_active:
        raise ValueError('Promotion is not active')
    now = datetime.now(timezone.utc)
    if promotion.starts_at and now < promotion.starts_at:
        raise ValueError('Promotion has not started yet')
    if promotion.ends_at and now > promotion.ends_at:
        raise ValueError('Promotion has expired')


# ═══════════════════════════════════════════════════════════════════
# STATS - registered BEFORE /{id} routes to avoid path capture
# ═══════════════════════════════════════════════════════════════════

@router.get('/stats', response_model=PromotionOverallStats)
async def overall_stats(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.view')),
):
    total_q = select(func.count()).select_from(Promotion)
    total_promotions = (await session.execute(total_q)).scalar() or 0

    active_q = select(func.count()).select_from(Promotion).where(Promotion.is_active == True)
    active_promotions = (await session.execute(active_q)).scalar() or 0

    claims_q = select(func.count()).select_from(UserPromotion)
    total_claimed = (await session.execute(claims_q)).scalar() or 0

    bonus_q = select(func.coalesce(func.sum(UserPromotion.bonus_amount), 0)).select_from(UserPromotion)
    total_bonus_given = (await session.execute(bonus_q)).scalar() or Decimal('0')

    return PromotionOverallStats(
        total_promotions=total_promotions,
        active_promotions=active_promotions,
        total_claimed=total_claimed,
        total_bonus_given=total_bonus_given,
    )


# ═══════════════════════════════════════════════════════════════════
# COUPON ENDPOINTS - registered BEFORE /{id} to avoid path capture
# ═══════════════════════════════════════════════════════════════════

# ─── List Coupons ────────────────────────────────────────────────

@router.get('/coupons', response_model=CouponListResponse)
async def list_coupons(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    promotion_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None, max_length=50),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.view')),
):
    base = select(Coupon)
    if promotion_id is not None:
        base = base.where(Coupon.promotion_id == promotion_id)
    if is_active is not None:
        base = base.where(Coupon.is_active == is_active)
    if search:
        base = base.where(Coupon.code.ilike(f'%{search}%'))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Coupon.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    coupons = result.scalars().all()

    items = []
    for c in coupons:
        promo = await session.get(Promotion, c.promotion_id)
        items.append(CouponResponse(
            id=c.id,
            code=c.code,
            promotion_id=c.promotion_id,
            promotion_name=promo.name if promo else None,
            max_uses=c.max_uses,
            used_count=c.used_count,
            is_active=c.is_active,
            expires_at=c.expires_at,
            created_by=c.created_by,
            created_at=c.created_at,
        ))

    return CouponListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Create Coupon ───────────────────────────────────────────────

@router.post('/coupons', response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    body: CouponCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    promo = await session.get(Promotion, body.promotion_id)
    if not promo:
        raise HTTPException(status_code=404, detail='Promotion not found')

    code = body.code or _generate_coupon_code()

    # Check code uniqueness
    existing = await session.execute(select(Coupon).where(Coupon.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f'Coupon code "{code}" already exists')

    coupon = Coupon(
        code=code,
        promotion_id=body.promotion_id,
        max_uses=body.max_uses,
        is_active=body.is_active,
        expires_at=body.expires_at,
        created_by=current_user.id,
    )
    session.add(coupon)
    await session.commit()
    await session.refresh(coupon)

    return CouponResponse(
        id=coupon.id,
        code=coupon.code,
        promotion_id=coupon.promotion_id,
        promotion_name=promo.name,
        max_uses=coupon.max_uses,
        used_count=coupon.used_count,
        is_active=coupon.is_active,
        expires_at=coupon.expires_at,
        created_by=coupon.created_by,
        created_at=coupon.created_at,
    )


# ─── Batch Create Coupons ───────────────────────────────────────

@router.post('/coupons/batch', response_model=list[CouponResponse], status_code=status.HTTP_201_CREATED)
async def batch_create_coupons(
    body: CouponBatchCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    promo = await session.get(Promotion, body.promotion_id)
    if not promo:
        raise HTTPException(status_code=404, detail='Promotion not found')

    created = []
    attempts = 0
    max_attempts = body.count * 3

    while len(created) < body.count and attempts < max_attempts:
        attempts += 1
        code = _generate_coupon_code(prefix=body.prefix)

        existing = await session.execute(select(Coupon).where(Coupon.code == code))
        if existing.scalar_one_or_none():
            continue

        coupon = Coupon(
            code=code,
            promotion_id=body.promotion_id,
            max_uses=body.max_uses,
            is_active=body.is_active,
            expires_at=body.expires_at,
            created_by=current_user.id,
        )
        session.add(coupon)
        created.append(coupon)

    if not created:
        raise HTTPException(status_code=500, detail='Failed to generate unique coupon codes')

    await session.commit()
    for c in created:
        await session.refresh(c)

    return [
        CouponResponse(
            id=c.id,
            code=c.code,
            promotion_id=c.promotion_id,
            promotion_name=promo.name,
            max_uses=c.max_uses,
            used_count=c.used_count,
            is_active=c.is_active,
            expires_at=c.expires_at,
            created_by=c.created_by,
            created_at=c.created_at,
        )
        for c in created
    ]


# ─── Redeem Coupon ───────────────────────────────────────────────

@router.post('/coupons/redeem', response_model=CouponRedeemResponse)
async def redeem_coupon(
    body: CouponRedeemRequest,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    # Find coupon by code
    result = await session.execute(select(Coupon).where(Coupon.code == body.code).with_for_update())
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail='Coupon not found')

    if not coupon.is_active:
        raise HTTPException(status_code=400, detail='Coupon is not active')

    now = datetime.now(timezone.utc)
    if coupon.expires_at and now > coupon.expires_at:
        raise HTTPException(status_code=400, detail='Coupon has expired')

    if coupon.max_uses > 0 and coupon.used_count >= coupon.max_uses:
        raise HTTPException(status_code=400, detail='Coupon has reached max uses')

    # Check if user already used this coupon
    used_q = select(func.count()).select_from(UserCoupon).where(
        and_(UserCoupon.user_id == body.user_id, UserCoupon.coupon_id == coupon.id)
    )
    already_used = (await session.execute(used_q)).scalar() or 0
    if already_used > 0:
        raise HTTPException(status_code=400, detail='User has already used this coupon')

    # Verify user exists
    user = await session.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    # Get linked promotion and calculate bonus
    promotion = await session.get(Promotion, coupon.promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Linked promotion not found')

    try:
        _validate_promotion_active(promotion)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        bonus = _calculate_bonus(promotion, None)
    except ValueError:
        if promotion.bonus_type == "percent":
            raise HTTPException(status_code=400, detail="Deposit amount required for percent-type promotion coupons")
        bonus = promotion.bonus_value

    wagering_required = bonus * Decimal(str(promotion.wagering_multiplier))

    # Create UserCoupon record
    user_coupon = UserCoupon(
        user_id=body.user_id,
        coupon_id=coupon.id,
        bonus_amount=bonus,
    )
    session.add(user_coupon)

    # Create UserPromotion record
    user_promo = UserPromotion(
        user_id=body.user_id,
        promotion_id=promotion.id,
        status='active',
        bonus_amount=bonus,
        wagering_required=wagering_required,
    )
    session.add(user_promo)

    # Increment coupon usage
    coupon.used_count += 1
    session.add(coupon)

    # Increment promotion total claimed
    promotion.total_claimed += 1
    session.add(promotion)

    await session.commit()

    return CouponRedeemResponse(
        coupon_id=coupon.id,
        promotion_id=promotion.id,
        bonus_amount=bonus,
        wagering_required=wagering_required,
        message=f'Coupon redeemed: {bonus} bonus applied',
    )


# ─── Update Coupon ───────────────────────────────────────────────

@router.put('/coupons/{coupon_id}', response_model=CouponResponse)
async def update_coupon(
    coupon_id: int,
    body: CouponUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    coupon = await session.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail='Coupon not found')

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(coupon, field, value)

    session.add(coupon)
    await session.commit()
    await session.refresh(coupon)

    promo = await session.get(Promotion, coupon.promotion_id)
    return CouponResponse(
        id=coupon.id,
        code=coupon.code,
        promotion_id=coupon.promotion_id,
        promotion_name=promo.name if promo else None,
        max_uses=coupon.max_uses,
        used_count=coupon.used_count,
        is_active=coupon.is_active,
        expires_at=coupon.expires_at,
        created_by=coupon.created_by,
        created_at=coupon.created_at,
    )


# ─── Delete Coupon (soft) ───────────────────────────────────────

@router.delete('/coupons/{coupon_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_coupon(
    coupon_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    coupon = await session.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail='Coupon not found')

    coupon.is_active = False
    session.add(coupon)
    await session.commit()


# ─── User Claims by User ────────────────────────────────────────

@router.get('/users/{user_id}/claims', response_model=UserClaimListResponse)
async def list_user_claims(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.view')),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    base = select(UserPromotion).where(UserPromotion.user_id == user_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(UserPromotion.claimed_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    claims = result.scalars().all()

    items = [
        PromotionClaimResponse(
            id=c.id,
            user_id=c.user_id,
            promotion_id=c.promotion_id,
            status=c.status,
            bonus_amount=c.bonus_amount,
            wagering_required=c.wagering_required,
            wagering_completed=c.wagering_completed,
            deposit_tx_id=c.deposit_tx_id,
            claimed_at=c.claimed_at,
            expires_at=c.expires_at,
            completed_at=c.completed_at,
        )
        for c in claims
    ]
    return UserClaimListResponse(items=items, total=total, page=page, page_size=page_size)


# ═══════════════════════════════════════════════════════════════════
# PROMOTION CRUD
# ═══════════════════════════════════════════════════════════════════

# ─── List Promotions ─────────────────────────────────────────────

@router.get('', response_model=PromotionListResponse)
async def list_promotions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias='type'),
    is_active: bool | None = Query(None),
    start_date: str | None = Query(None, description='YYYY-MM-DD'),
    end_date: str | None = Query(None, description='YYYY-MM-DD'),
    search: str | None = Query(None, max_length=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.view')),
):
    base = select(Promotion)
    if type_filter:
        base = base.where(Promotion.type == type_filter)
    if is_active is not None:
        base = base.where(Promotion.is_active == is_active)
    if start_date:
        start_dt = datetime.combine(
            datetime.strptime(start_date, '%Y-%m-%d').date(),
            datetime.min.time(), tzinfo=timezone.utc,
        )
        base = base.where(Promotion.created_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(
            datetime.strptime(end_date, '%Y-%m-%d').date(),
            datetime.max.time(), tzinfo=timezone.utc,
        )
        base = base.where(Promotion.created_at <= end_dt)
    if search:
        base = base.where(Promotion.name.ilike(f'%{search}%'))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Promotion.priority.desc(), Promotion.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    promotions = result.scalars().all()

    items = [_promotion_to_response(p) for p in promotions]
    return PromotionListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Create Promotion ───────────────────────────────────────────

@router.post('', response_model=PromotionResponse, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    body: PromotionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    if body.starts_at and body.ends_at and body.starts_at >= body.ends_at:
        raise HTTPException(status_code=400, detail='starts_at must be before ends_at')

    promotion = Promotion(
        **body.model_dump(),
        created_by=current_user.id,
    )
    session.add(promotion)
    await session.commit()
    await session.refresh(promotion)
    return _promotion_to_response(promotion)


# ─── Get Promotion Detail ───────────────────────────────────────

@router.get('/{promotion_id}', response_model=PromotionDetailResponse)
async def get_promotion(
    promotion_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.view')),
):
    promotion = await session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promotion not found')

    # Gather claim statistics
    active_q = select(func.count()).select_from(UserPromotion).where(
        and_(UserPromotion.promotion_id == promotion_id, UserPromotion.status == 'active')
    )
    active_count = (await session.execute(active_q)).scalar() or 0

    completed_q = select(func.count()).select_from(UserPromotion).where(
        and_(UserPromotion.promotion_id == promotion_id, UserPromotion.status == 'completed')
    )
    completed_count = (await session.execute(completed_q)).scalar() or 0

    total_bonus_q = select(
        func.coalesce(func.sum(UserPromotion.bonus_amount), 0)
    ).where(UserPromotion.promotion_id == promotion_id)
    total_bonus = (await session.execute(total_bonus_q)).scalar() or Decimal('0')

    unique_users_q = select(
        func.count(func.distinct(UserPromotion.user_id))
    ).where(UserPromotion.promotion_id == promotion_id)
    unique_users = (await session.execute(unique_users_q)).scalar() or 0

    claim_stats = {
        'active_claims': active_count,
        'completed_claims': completed_count,
        'total_bonus_given': float(total_bonus),
        'unique_users': unique_users,
    }

    base = _promotion_to_response(promotion)
    return PromotionDetailResponse(
        **base.model_dump(),
        claim_stats=claim_stats,
    )


# ─── Update Promotion ───────────────────────────────────────────

@router.put('/{promotion_id}', response_model=PromotionResponse)
async def update_promotion(
    promotion_id: int,
    body: PromotionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    promotion = await session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promotion not found')

    update_data = body.model_dump(exclude_unset=True)

    # Validate date range if both provided
    new_starts = update_data.get('starts_at', promotion.starts_at)
    new_ends = update_data.get('ends_at', promotion.ends_at)
    if new_starts and new_ends and new_starts >= new_ends:
        raise HTTPException(status_code=400, detail='starts_at must be before ends_at')

    for field, value in update_data.items():
        setattr(promotion, field, value)

    promotion.updated_at = datetime.now(timezone.utc)
    session.add(promotion)
    await session.commit()
    await session.refresh(promotion)
    return _promotion_to_response(promotion)


# ─── Delete Promotion (soft) ────────────────────────────────────

@router.delete('/{promotion_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(
    promotion_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    promotion = await session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promotion not found')

    promotion.is_active = False
    promotion.updated_at = datetime.now(timezone.utc)
    session.add(promotion)
    await session.commit()


# ─── Toggle Active Status ───────────────────────────────────────

@router.post('/{promotion_id}/toggle', response_model=PromotionResponse)
async def toggle_promotion(
    promotion_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    promotion = await session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promotion not found')

    promotion.is_active = not promotion.is_active
    promotion.updated_at = datetime.now(timezone.utc)
    session.add(promotion)
    await session.commit()
    await session.refresh(promotion)
    return _promotion_to_response(promotion)


# ─── Participants ────────────────────────────────────────────────

@router.get('/{promotion_id}/participants', response_model=ParticipantListResponse)
async def list_participants(
    promotion_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias='status'),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.view')),
):
    promotion = await session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promotion not found')

    base = select(UserPromotion).where(UserPromotion.promotion_id == promotion_id)
    if status_filter:
        base = base.where(UserPromotion.status == status_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(UserPromotion.claimed_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    claims = result.scalars().all()

    items = []
    for c in claims:
        user = await session.get(User, c.user_id)
        items.append(ParticipantResponse(
            id=c.id,
            user_id=c.user_id,
            username=user.username if user else None,
            promotion_id=c.promotion_id,
            status=c.status,
            bonus_amount=c.bonus_amount,
            wagering_required=c.wagering_required,
            wagering_completed=c.wagering_completed,
            claimed_at=c.claimed_at,
        ))

    return ParticipantListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Claim Promotion ────────────────────────────────────────────

@router.post('/{promotion_id}/claim', response_model=PromotionClaimResponse, status_code=status.HTTP_201_CREATED)
async def claim_promotion(
    promotion_id: int,
    body: PromotionClaimRequest,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.create')),
):
    result = await session.execute(
        select(Promotion).where(Promotion.id == promotion_id).with_for_update()
    )
    promotion = result.scalar_one_or_none()
    if not promotion:
        raise HTTPException(status_code=404, detail='Promotion not found')

    # 1. Check promotion is active and within date range
    try:
        _validate_promotion_active(promotion)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Verify user exists
    user = await session.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    # 2. Check user hasn't exceeded max_claims_per_user
    user_claims_q = select(func.count()).select_from(UserPromotion).where(
        and_(
            UserPromotion.user_id == body.user_id,
            UserPromotion.promotion_id == promotion_id,
        )
    )
    user_claim_count = (await session.execute(user_claims_q)).scalar() or 0
    if promotion.max_claims_per_user > 0 and user_claim_count >= promotion.max_claims_per_user:
        raise HTTPException(
            status_code=400,
            detail=f'User has reached max claims ({promotion.max_claims_per_user}) for this promotion',
        )

    # 3. Check total_claimed < max_total_claims (if set)
    if promotion.max_total_claims > 0 and promotion.total_claimed >= promotion.max_total_claims:
        raise HTTPException(status_code=400, detail='Promotion has reached max total claims')

    # 4. Calculate bonus
    try:
        bonus = _calculate_bonus(promotion, body.deposit_amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    wagering_required = bonus * Decimal(str(promotion.wagering_multiplier))

    # 5. Create UserPromotion record
    user_promo = UserPromotion(
        user_id=body.user_id,
        promotion_id=promotion_id,
        status='active',
        bonus_amount=bonus,
        wagering_required=wagering_required,
    )
    session.add(user_promo)

    # 6. Increment promotion.total_claimed
    promotion.total_claimed += 1
    promotion.updated_at = datetime.now(timezone.utc)
    session.add(promotion)

    await session.commit()
    await session.refresh(user_promo)

    # 7. Return bonus details
    return PromotionClaimResponse(
        id=user_promo.id,
        user_id=user_promo.user_id,
        promotion_id=user_promo.promotion_id,
        status=user_promo.status,
        bonus_amount=user_promo.bonus_amount,
        wagering_required=user_promo.wagering_required,
        wagering_completed=user_promo.wagering_completed,
        deposit_tx_id=user_promo.deposit_tx_id,
        claimed_at=user_promo.claimed_at,
        expires_at=user_promo.expires_at,
        completed_at=user_promo.completed_at,
    )


# ─── Single Promotion Stats ─────────────────────────────────────

@router.get('/{promotion_id}/stats', response_model=PromotionSingleStats)
async def single_promotion_stats(
    promotion_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker('announcement.view')),
):
    promotion = await session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promotion not found')

    # Total claims
    total_q = select(func.count()).select_from(UserPromotion).where(
        UserPromotion.promotion_id == promotion_id
    )
    total_claims = (await session.execute(total_q)).scalar() or 0

    # Total bonus
    bonus_q = select(
        func.coalesce(func.sum(UserPromotion.bonus_amount), 0)
    ).where(UserPromotion.promotion_id == promotion_id)
    total_bonus = (await session.execute(bonus_q)).scalar() or Decimal('0')

    # Unique users
    unique_q = select(
        func.count(func.distinct(UserPromotion.user_id))
    ).where(UserPromotion.promotion_id == promotion_id)
    unique_users = (await session.execute(unique_q)).scalar() or 0

    # Claims by day (last 30 days)
    daily_q = (
        select(
            func.date_trunc('day', UserPromotion.claimed_at).label('day'),
            func.count().label('count'),
            func.coalesce(func.sum(UserPromotion.bonus_amount), 0).label('bonus'),
        )
        .where(UserPromotion.promotion_id == promotion_id)
        .group_by(func.date_trunc('day', UserPromotion.claimed_at))
        .order_by(func.date_trunc('day', UserPromotion.claimed_at).desc())
        .limit(30)
    )
    daily_result = await session.execute(daily_q)
    claims_by_day = [
        {
            'date': row.day.strftime('%Y-%m-%d') if row.day else None,
            'count': row.count,
            'bonus': float(row.bonus),
        }
        for row in daily_result.all()
    ]

    # Claims by status
    status_q = (
        select(UserPromotion.status, func.count().label('count'))
        .where(UserPromotion.promotion_id == promotion_id)
        .group_by(UserPromotion.status)
    )
    status_result = await session.execute(status_q)
    claims_by_status = {row.status: row.count for row in status_result.all()}

    return PromotionSingleStats(
        promotion_id=promotion_id,
        name=promotion.name,
        total_claims=total_claims,
        total_bonus=total_bonus,
        unique_users=unique_users,
        claims_by_day=claims_by_day,
        claims_by_status=claims_by_status,
    )
