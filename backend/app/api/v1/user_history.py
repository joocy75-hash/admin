from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.user import User
from app.models.bet_record import BetRecord
from app.models.money_log import MoneyLog
from app.models.point_log import PointLog
from app.models.user_login_history import UserLoginHistory
from app.schemas.user_history import (
    BetRecordListResponse,
    BetRecordResponse,
    BetSummary,
    LoginHistoryListResponse,
    LoginHistoryResponse,
    MoneyLogListResponse,
    MoneyLogResponse,
    MoneySummary,
    PointLogListResponse,
    PointLogResponse,
    PointSummary,
)

router = APIRouter(prefix="/users", tags=["user-history"])


async def _verify_user(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─── Bet Records ───────────────────────────────────────────────────

@router.get("/{user_id}/bets", response_model=BetRecordListResponse)
async def list_user_bets(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    game_category: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user(session, user_id)

    base = select(BetRecord).where(BetRecord.user_id == user_id)
    if game_category:
        base = base.where(BetRecord.game_category == game_category)
    if date_from:
        base = base.where(BetRecord.bet_at >= date_from)
    if date_to:
        base = base.where(BetRecord.bet_at <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Summary
    sum_base = select(
        func.coalesce(func.sum(BetRecord.bet_amount), 0).label("total_bet"),
        func.coalesce(func.sum(BetRecord.win_amount), 0).label("total_win"),
        func.coalesce(func.sum(BetRecord.profit), 0).label("net_profit"),
    ).where(BetRecord.user_id == user_id)
    if game_category:
        sum_base = sum_base.where(BetRecord.game_category == game_category)
    if date_from:
        sum_base = sum_base.where(BetRecord.bet_at >= date_from)
    if date_to:
        sum_base = sum_base.where(BetRecord.bet_at <= date_to)

    sum_row = (await session.execute(sum_base)).one()

    stmt = base.order_by(BetRecord.bet_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    records = result.scalars().all()

    items = [
        BetRecordResponse(
            id=r.id,
            game_category=r.game_category,
            provider=r.provider,
            game_name=r.game_name,
            round_id=r.round_id,
            bet_amount=r.bet_amount,
            win_amount=r.win_amount,
            profit=r.profit,
            status=r.status,
            bet_at=r.bet_at,
            settled_at=r.settled_at,
        )
        for r in records
    ]

    return BetRecordListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        summary=BetSummary(
            total_bet=sum_row.total_bet,
            total_win=sum_row.total_win,
            net_profit=sum_row.net_profit,
        ),
    )


# ─── Money Logs ────────────────────────────────────────────────────

@router.get("/{user_id}/money-logs", response_model=MoneyLogListResponse)
async def list_user_money_logs(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    user = await _verify_user(session, user_id)

    base = select(MoneyLog).where(MoneyLog.user_id == user_id)
    if type_filter:
        base = base.where(MoneyLog.type == type_filter)
    if date_from:
        base = base.where(MoneyLog.created_at >= date_from)
    if date_to:
        base = base.where(MoneyLog.created_at <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Summary: credit = positive amounts, debit = negative amounts
    sum_base = select(
        func.coalesce(func.sum(case((MoneyLog.amount > 0, MoneyLog.amount))), 0).label("total_credit"),
        func.coalesce(func.sum(case((MoneyLog.amount < 0, func.abs(MoneyLog.amount)))), 0).label("total_debit"),
    ).where(MoneyLog.user_id == user_id)
    if type_filter:
        sum_base = sum_base.where(MoneyLog.type == type_filter)
    if date_from:
        sum_base = sum_base.where(MoneyLog.created_at >= date_from)
    if date_to:
        sum_base = sum_base.where(MoneyLog.created_at <= date_to)

    sum_row = (await session.execute(sum_base)).one()

    stmt = base.order_by(MoneyLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    logs = result.scalars().all()

    items = [
        MoneyLogResponse(
            id=l.id,
            type=l.type,
            amount=l.amount,
            balance_before=l.balance_before,
            balance_after=l.balance_after,
            description=l.description,
            reference_type=l.reference_type,
            created_at=l.created_at,
        )
        for l in logs
    ]

    return MoneyLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        summary=MoneySummary(
            current_balance=user.balance,
            total_credit=sum_row.total_credit,
            total_debit=sum_row.total_debit,
        ),
    )


# ─── Point Logs ────────────────────────────────────────────────────

@router.get("/{user_id}/point-logs", response_model=PointLogListResponse)
async def list_user_point_logs(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    user = await _verify_user(session, user_id)

    base = select(PointLog).where(PointLog.user_id == user_id)
    if type_filter:
        base = base.where(PointLog.type == type_filter)
    if date_from:
        base = base.where(PointLog.created_at >= date_from)
    if date_to:
        base = base.where(PointLog.created_at <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    sum_base = select(
        func.coalesce(func.sum(case((PointLog.amount > 0, PointLog.amount))), 0).label("total_credit"),
        func.coalesce(func.sum(case((PointLog.amount < 0, func.abs(PointLog.amount)))), 0).label("total_debit"),
    ).where(PointLog.user_id == user_id)
    if type_filter:
        sum_base = sum_base.where(PointLog.type == type_filter)
    if date_from:
        sum_base = sum_base.where(PointLog.created_at >= date_from)
    if date_to:
        sum_base = sum_base.where(PointLog.created_at <= date_to)

    sum_row = (await session.execute(sum_base)).one()

    stmt = base.order_by(PointLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    logs = result.scalars().all()

    items = [
        PointLogResponse(
            id=l.id,
            type=l.type,
            amount=l.amount,
            balance_before=l.balance_before,
            balance_after=l.balance_after,
            description=l.description,
            reference_type=l.reference_type,
            created_at=l.created_at,
        )
        for l in logs
    ]

    return PointLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        summary=PointSummary(
            current_points=user.points,
            total_credit=sum_row.total_credit,
            total_debit=sum_row.total_debit,
        ),
    )


# ─── Login History ─────────────────────────────────────────────────

@router.get("/{user_id}/login-history", response_model=LoginHistoryListResponse)
async def list_user_login_history(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user(session, user_id)

    base = select(UserLoginHistory).where(UserLoginHistory.user_id == user_id)
    if date_from:
        base = base.where(UserLoginHistory.login_at >= date_from)
    if date_to:
        base = base.where(UserLoginHistory.login_at <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(UserLoginHistory.login_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    records = result.scalars().all()

    items = [
        LoginHistoryResponse(
            id=r.id,
            login_ip=r.login_ip,
            user_agent=r.user_agent,
            device_type=r.device_type,
            os=r.os,
            browser=r.browser,
            country=r.country,
            city=r.city,
            login_at=r.login_at,
            logout_at=r.logout_at,
        )
        for r in records
    ]

    return LoginHistoryListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
