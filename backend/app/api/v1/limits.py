"""Transaction and betting limits management endpoints."""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from pydantic import Field as PydanticField
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.betting_limit import BettingLimit
from app.models.transaction import Transaction
from app.models.transaction_limit import TransactionLimit
from app.models.user import User

router = APIRouter(prefix="/limits", tags=["limits"])


# ─── Schemas ─────────────────────────────────────────────────────────

class TransactionLimitCreate(BaseModel):
    scope_type: str = PydanticField(pattern=r"^(global|vip_level|user)$")
    scope_id: int = 0
    tx_type: str = PydanticField(pattern=r"^(deposit|withdrawal)$")
    min_amount: Decimal = Decimal("0")
    max_amount: Decimal = Decimal("0")
    daily_limit: Decimal = Decimal("0")
    daily_count: int = 0
    monthly_limit: Decimal = Decimal("0")
    is_active: bool = True


class TransactionLimitResponse(BaseModel):
    id: int
    scope_type: str
    scope_id: int
    tx_type: str
    min_amount: Decimal
    max_amount: Decimal
    daily_limit: Decimal
    daily_count: int
    monthly_limit: Decimal
    is_active: bool
    updated_by: int | None
    updated_at: datetime


class TransactionLimitListResponse(BaseModel):
    items: list[TransactionLimitResponse]
    total: int
    page: int
    page_size: int


class BettingLimitCreate(BaseModel):
    scope_type: str = PydanticField(pattern=r"^(global|vip_level|user)$")
    scope_id: int = 0
    game_category: str
    min_bet: Decimal = Decimal("0")
    max_bet: Decimal = Decimal("0")
    max_daily_loss: Decimal = Decimal("0")
    is_active: bool = True


class BettingLimitResponse(BaseModel):
    id: int
    scope_type: str
    scope_id: int
    game_category: str
    min_bet: Decimal
    max_bet: Decimal
    max_daily_loss: Decimal
    is_active: bool
    updated_by: int | None
    updated_at: datetime


class BettingLimitListResponse(BaseModel):
    items: list[BettingLimitResponse]
    total: int
    page: int
    page_size: int


class ValidationResult(BaseModel):
    valid: bool
    message: str
    limit: TransactionLimitResponse | BettingLimitResponse | None = None


class EffectiveTransactionLimitResponse(BaseModel):
    tx_type: str
    applied_scope: str
    applied_scope_id: int
    min_amount: Decimal
    max_amount: Decimal
    daily_limit: Decimal
    daily_count: int
    monthly_limit: Decimal


class EffectiveBettingLimitResponse(BaseModel):
    game_category: str
    applied_scope: str
    applied_scope_id: int
    min_bet: Decimal
    max_bet: Decimal
    max_daily_loss: Decimal


# ─── Helpers ─────────────────────────────────────────────────────────

def _tx_limit_response(limit: TransactionLimit) -> TransactionLimitResponse:
    return TransactionLimitResponse(
        id=limit.id,
        scope_type=limit.scope_type,
        scope_id=limit.scope_id,
        tx_type=limit.tx_type,
        min_amount=limit.min_amount,
        max_amount=limit.max_amount,
        daily_limit=limit.daily_limit,
        daily_count=limit.daily_count,
        monthly_limit=limit.monthly_limit,
        is_active=limit.is_active,
        updated_by=limit.updated_by,
        updated_at=limit.updated_at,
    )


def _bet_limit_response(limit: BettingLimit) -> BettingLimitResponse:
    return BettingLimitResponse(
        id=limit.id,
        scope_type=limit.scope_type,
        scope_id=limit.scope_id,
        game_category=limit.game_category,
        min_bet=limit.min_bet,
        max_bet=limit.max_bet,
        max_daily_loss=limit.max_daily_loss,
        is_active=limit.is_active,
        updated_by=limit.updated_by,
        updated_at=limit.updated_at,
    )


async def _get_effective_tx_limit(
    session: AsyncSession, user: User, tx_type: str
) -> tuple[TransactionLimit | None, str, int]:
    """Cascading priority: user > vip_level > global. Returns (limit, scope, scope_id)."""
    # 1. User-specific
    stmt = select(TransactionLimit).where(
        TransactionLimit.scope_type == "user",
        TransactionLimit.scope_id == user.id,
        TransactionLimit.tx_type == tx_type,
        TransactionLimit.is_active.is_(True),
    )
    result = await session.execute(stmt)
    limit = result.scalar_one_or_none()
    if limit:
        return limit, "user", user.id

    # 2. VIP level
    stmt = select(TransactionLimit).where(
        TransactionLimit.scope_type == "vip_level",
        TransactionLimit.scope_id == user.level,
        TransactionLimit.tx_type == tx_type,
        TransactionLimit.is_active.is_(True),
    )
    result = await session.execute(stmt)
    limit = result.scalar_one_or_none()
    if limit:
        return limit, "vip_level", user.level

    # 3. Global
    stmt = select(TransactionLimit).where(
        TransactionLimit.scope_type == "global",
        TransactionLimit.scope_id == 0,
        TransactionLimit.tx_type == tx_type,
        TransactionLimit.is_active.is_(True),
    )
    result = await session.execute(stmt)
    limit = result.scalar_one_or_none()
    if limit:
        return limit, "global", 0

    return None, "none", 0


async def _get_effective_bet_limit(
    session: AsyncSession, user: User, game_category: str
) -> tuple[BettingLimit | None, str, int]:
    """Cascading priority: user > vip_level > global."""
    # 1. User-specific
    stmt = select(BettingLimit).where(
        BettingLimit.scope_type == "user",
        BettingLimit.scope_id == user.id,
        BettingLimit.game_category == game_category,
        BettingLimit.is_active.is_(True),
    )
    result = await session.execute(stmt)
    limit = result.scalar_one_or_none()
    if limit:
        return limit, "user", user.id

    # 2. VIP level
    stmt = select(BettingLimit).where(
        BettingLimit.scope_type == "vip_level",
        BettingLimit.scope_id == user.level,
        BettingLimit.game_category == game_category,
        BettingLimit.is_active.is_(True),
    )
    result = await session.execute(stmt)
    limit = result.scalar_one_or_none()
    if limit:
        return limit, "vip_level", user.level

    # 3. Global
    stmt = select(BettingLimit).where(
        BettingLimit.scope_type == "global",
        BettingLimit.scope_id == 0,
        BettingLimit.game_category == game_category,
        BettingLimit.is_active.is_(True),
    )
    result = await session.execute(stmt)
    limit = result.scalar_one_or_none()
    if limit:
        return limit, "global", 0

    return None, "none", 0


# ═══════════════════════════════════════════════════════════════════════
# Transaction Limits
# ═══════════════════════════════════════════════════════════════════════


@router.get("/transactions", response_model=TransactionLimitListResponse)
async def list_transaction_limits(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    scope_type: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    base = select(TransactionLimit)
    if scope_type:
        base = base.where(TransactionLimit.scope_type == scope_type)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(TransactionLimit.scope_type, TransactionLimit.scope_id).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    limits = result.scalars().all()

    return TransactionLimitListResponse(
        items=[_tx_limit_response(l) for l in limits],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/transactions", response_model=TransactionLimitResponse, status_code=status.HTTP_201_CREATED)
async def upsert_transaction_limit(
    body: TransactionLimitCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    # Validate scope_id references
    if body.scope_type == "user" and body.scope_id:
        user = await session.get(User, body.scope_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found for scope_id")

    if body.min_amount > body.max_amount and body.max_amount > 0:
        raise HTTPException(status_code=400, detail="min_amount cannot exceed max_amount")

    # Upsert: find existing by unique constraint
    stmt = select(TransactionLimit).where(
        TransactionLimit.scope_type == body.scope_type,
        TransactionLimit.scope_id == body.scope_id,
        TransactionLimit.tx_type == body.tx_type,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.min_amount = body.min_amount
        existing.max_amount = body.max_amount
        existing.daily_limit = body.daily_limit
        existing.daily_count = body.daily_count
        existing.monthly_limit = body.monthly_limit
        existing.is_active = body.is_active
        existing.updated_by = current_user.id
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
    else:
        existing = TransactionLimit(
            scope_type=body.scope_type,
            scope_id=body.scope_id,
            tx_type=body.tx_type,
            min_amount=body.min_amount,
            max_amount=body.max_amount,
            daily_limit=body.daily_limit,
            daily_count=body.daily_count,
            monthly_limit=body.monthly_limit,
            is_active=body.is_active,
            updated_by=current_user.id,
        )
        session.add(existing)

    await session.commit()
    await session.refresh(existing)
    return _tx_limit_response(existing)


@router.delete("/transactions/{limit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction_limit(
    limit_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    limit = await session.get(TransactionLimit, limit_id)
    if not limit:
        raise HTTPException(status_code=404, detail="Transaction limit not found")

    await session.delete(limit)
    await session.commit()


@router.get(
    "/transactions/effective/{user_id}",
    response_model=list[EffectiveTransactionLimitResponse],
)
async def get_effective_transaction_limits(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    results = []
    for tx_type in ("deposit", "withdrawal"):
        limit, scope, scope_id = await _get_effective_tx_limit(session, user, tx_type)
        if limit:
            results.append(
                EffectiveTransactionLimitResponse(
                    tx_type=tx_type,
                    applied_scope=scope,
                    applied_scope_id=scope_id,
                    min_amount=limit.min_amount,
                    max_amount=limit.max_amount,
                    daily_limit=limit.daily_limit,
                    daily_count=limit.daily_count,
                    monthly_limit=limit.monthly_limit,
                )
            )

    return results


# ═══════════════════════════════════════════════════════════════════════
# Betting Limits
# ═══════════════════════════════════════════════════════════════════════


GAME_CATEGORIES = [
    "casino", "slot", "holdem", "sports", "shooting", "coin", "mini_game",
]


@router.get("/betting", response_model=BettingLimitListResponse)
async def list_betting_limits(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    scope_type: str | None = Query(None),
    game_category: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    base = select(BettingLimit)
    if scope_type:
        base = base.where(BettingLimit.scope_type == scope_type)
    if game_category:
        base = base.where(BettingLimit.game_category == game_category)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(BettingLimit.scope_type, BettingLimit.game_category).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    limits = result.scalars().all()

    return BettingLimitListResponse(
        items=[_bet_limit_response(l) for l in limits],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/betting", response_model=BettingLimitResponse, status_code=status.HTTP_201_CREATED)
async def upsert_betting_limit(
    body: BettingLimitCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    if body.scope_type == "user" and body.scope_id:
        user = await session.get(User, body.scope_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found for scope_id")

    if body.min_bet > body.max_bet and body.max_bet > 0:
        raise HTTPException(status_code=400, detail="min_bet cannot exceed max_bet")

    # Upsert by unique constraint
    stmt = select(BettingLimit).where(
        BettingLimit.scope_type == body.scope_type,
        BettingLimit.scope_id == body.scope_id,
        BettingLimit.game_category == body.game_category,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.min_bet = body.min_bet
        existing.max_bet = body.max_bet
        existing.max_daily_loss = body.max_daily_loss
        existing.is_active = body.is_active
        existing.updated_by = current_user.id
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
    else:
        existing = BettingLimit(
            scope_type=body.scope_type,
            scope_id=body.scope_id,
            game_category=body.game_category,
            min_bet=body.min_bet,
            max_bet=body.max_bet,
            max_daily_loss=body.max_daily_loss,
            is_active=body.is_active,
            updated_by=current_user.id,
        )
        session.add(existing)

    await session.commit()
    await session.refresh(existing)
    return _bet_limit_response(existing)


@router.delete("/betting/{limit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_betting_limit(
    limit_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    limit = await session.get(BettingLimit, limit_id)
    if not limit:
        raise HTTPException(status_code=404, detail="Betting limit not found")

    await session.delete(limit)
    await session.commit()


@router.get(
    "/betting/effective/{user_id}",
    response_model=list[EffectiveBettingLimitResponse],
)
async def get_effective_betting_limits(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    results = []
    for category in GAME_CATEGORIES:
        limit, scope, scope_id = await _get_effective_bet_limit(session, user, category)
        if limit:
            results.append(
                EffectiveBettingLimitResponse(
                    game_category=category,
                    applied_scope=scope,
                    applied_scope_id=scope_id,
                    min_bet=limit.min_bet,
                    max_bet=limit.max_bet,
                    max_daily_loss=limit.max_daily_loss,
                )
            )

    return results


# ═══════════════════════════════════════════════════════════════════════
# Validation Endpoints
# ═══════════════════════════════════════════════════════════════════════


@router.get("/validate/deposit", response_model=ValidationResult)
async def validate_deposit(
    user_id: int = Query(...),
    amount: Decimal = Query(..., gt=0),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    limit, scope, scope_id = await _get_effective_tx_limit(session, user, "deposit")
    if not limit:
        return ValidationResult(valid=True, message="No deposit limit configured")

    limit_resp = _tx_limit_response(limit)

    # Check min amount
    if limit.min_amount > 0 and amount < limit.min_amount:
        return ValidationResult(
            valid=False,
            message=f"Amount {amount} is below minimum {limit.min_amount}",
            limit=limit_resp,
        )

    # Check max amount
    if limit.max_amount > 0 and amount > limit.max_amount:
        return ValidationResult(
            valid=False,
            message=f"Amount {amount} exceeds maximum {limit.max_amount}",
            limit=limit_resp,
        )

    # Check daily limit (sum of today's approved deposits)
    if limit.daily_limit > 0:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        daily_sum_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "deposit",
            Transaction.status.in_(["pending", "approved"]),
            Transaction.created_at >= today_start,
        )
        daily_total = (await session.execute(daily_sum_stmt)).scalar()
        if daily_total + amount > limit.daily_limit:
            return ValidationResult(
                valid=False,
                message=f"Daily deposit limit would be exceeded ({daily_total} + {amount} > {limit.daily_limit})",
                limit=limit_resp,
            )

    # Check daily count
    if limit.daily_count > 0:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        daily_count_stmt = select(func.count()).where(
            Transaction.user_id == user_id,
            Transaction.type == "deposit",
            Transaction.status.in_(["pending", "approved"]),
            Transaction.created_at >= today_start,
        )
        count = (await session.execute(daily_count_stmt)).scalar() or 0
        if count >= limit.daily_count:
            return ValidationResult(
                valid=False,
                message=f"Daily deposit count limit reached ({count}/{limit.daily_count})",
                limit=limit_resp,
            )

    # Check monthly limit
    if limit.monthly_limit > 0:
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_sum_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "deposit",
            Transaction.status.in_(["pending", "approved"]),
            Transaction.created_at >= month_start,
        )
        monthly_total = (await session.execute(monthly_sum_stmt)).scalar()
        if monthly_total + amount > limit.monthly_limit:
            return ValidationResult(
                valid=False,
                message=f"Monthly deposit limit would be exceeded ({monthly_total} + {amount} > {limit.monthly_limit})",
                limit=limit_resp,
            )

    return ValidationResult(valid=True, message="Deposit amount is within limits", limit=limit_resp)


@router.get("/validate/withdrawal", response_model=ValidationResult)
async def validate_withdrawal(
    user_id: int = Query(...),
    amount: Decimal = Query(..., gt=0),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    limit, scope, scope_id = await _get_effective_tx_limit(session, user, "withdrawal")
    if not limit:
        return ValidationResult(valid=True, message="No withdrawal limit configured")

    limit_resp = _tx_limit_response(limit)

    # Check balance
    if amount > user.balance:
        return ValidationResult(
            valid=False,
            message=f"Insufficient balance ({user.balance} < {amount})",
            limit=limit_resp,
        )

    if limit.min_amount > 0 and amount < limit.min_amount:
        return ValidationResult(
            valid=False,
            message=f"Amount {amount} is below minimum {limit.min_amount}",
            limit=limit_resp,
        )

    if limit.max_amount > 0 and amount > limit.max_amount:
        return ValidationResult(
            valid=False,
            message=f"Amount {amount} exceeds maximum {limit.max_amount}",
            limit=limit_resp,
        )

    if limit.daily_limit > 0:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        daily_sum_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "withdrawal",
            Transaction.status.in_(["pending", "approved"]),
            Transaction.created_at >= today_start,
        )
        daily_total = (await session.execute(daily_sum_stmt)).scalar()
        if daily_total + amount > limit.daily_limit:
            return ValidationResult(
                valid=False,
                message=f"Daily withdrawal limit would be exceeded ({daily_total} + {amount} > {limit.daily_limit})",
                limit=limit_resp,
            )

    if limit.daily_count > 0:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        daily_count_stmt = select(func.count()).where(
            Transaction.user_id == user_id,
            Transaction.type == "withdrawal",
            Transaction.status.in_(["pending", "approved"]),
            Transaction.created_at >= today_start,
        )
        count = (await session.execute(daily_count_stmt)).scalar() or 0
        if count >= limit.daily_count:
            return ValidationResult(
                valid=False,
                message=f"Daily withdrawal count limit reached ({count}/{limit.daily_count})",
                limit=limit_resp,
            )

    if limit.monthly_limit > 0:
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_sum_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "withdrawal",
            Transaction.status.in_(["pending", "approved"]),
            Transaction.created_at >= month_start,
        )
        monthly_total = (await session.execute(monthly_sum_stmt)).scalar()
        if monthly_total + amount > limit.monthly_limit:
            return ValidationResult(
                valid=False,
                message=f"Monthly withdrawal limit would be exceeded ({monthly_total} + {amount} > {limit.monthly_limit})",
                limit=limit_resp,
            )

    return ValidationResult(valid=True, message="Withdrawal amount is within limits", limit=limit_resp)


@router.get("/validate/bet", response_model=ValidationResult)
async def validate_bet(
    user_id: int = Query(...),
    game_category: str = Query(...),
    amount: Decimal = Query(..., gt=0),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    limit, scope, scope_id = await _get_effective_bet_limit(session, user, game_category)
    if not limit:
        return ValidationResult(valid=True, message="No betting limit configured for this category")

    limit_resp = _bet_limit_response(limit)

    if limit.min_bet > 0 and amount < limit.min_bet:
        return ValidationResult(
            valid=False,
            message=f"Bet amount {amount} is below minimum {limit.min_bet}",
            limit=limit_resp,
        )

    if limit.max_bet > 0 and amount > limit.max_bet:
        return ValidationResult(
            valid=False,
            message=f"Bet amount {amount} exceeds maximum {limit.max_bet}",
            limit=limit_resp,
        )

    # Check daily loss limit via bet_records
    if limit.max_daily_loss > 0:
        from app.models.bet_record import BetRecord

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        loss_stmt = select(
            func.coalesce(func.sum(func.greatest(BetRecord.bet_amount - BetRecord.win_amount, 0)), 0)
        ).where(
            BetRecord.user_id == user_id,
            BetRecord.game_category == game_category,
            BetRecord.bet_at >= today_start,
        )
        daily_loss = (await session.execute(loss_stmt)).scalar()
        if daily_loss + amount > limit.max_daily_loss:
            return ValidationResult(
                valid=False,
                message=f"Daily loss limit would be exceeded ({daily_loss} + {amount} > {limit.max_daily_loss})",
                limit=limit_resp,
            )

    return ValidationResult(valid=True, message="Bet amount is within limits", limit=limit_resp)
