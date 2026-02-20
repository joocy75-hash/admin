"""RTP analytics & bulk operation endpoints."""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.bet_record import BetRecord
from app.models.game import Game, GameProvider
from app.models.message import Message
from app.models.point_log import PointLog
from app.models.user import User
from app.schemas.analytics import (
    BulkMessageSend,
    BulkOperationResult,
    BulkPointGrant,
    BulkStatusUpdate,
    RtpByGameResponse,
    RtpByProviderResponse,
    RtpTrendResponse,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ═══════════════════════════════════════════════════════════════════
# RTP endpoints
# ═══════════════════════════════════════════════════════════════════

# ─── RTP by Game ────────────────────────────────────────────────

@router.get("/rtp/by-game", response_model=list[RtpByGameResponse])
async def rtp_by_game(
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    game_category: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    base = (
        select(
            BetRecord.game_category,
            func.coalesce(Game.name, BetRecord.game_name).label("game_name"),
            func.sum(BetRecord.bet_amount).label("total_bet"),
            func.sum(BetRecord.win_amount).label("total_win"),
            func.count().label("bet_count"),
        )
        .outerjoin(Game, Game.name == BetRecord.game_name)
        .where(BetRecord.status == "settled")
    )

    if game_category:
        base = base.where(BetRecord.game_category == game_category)
    if start_date:
        start_dt = datetime.combine(
            datetime.strptime(start_date, "%Y-%m-%d").date(),
            datetime.min.time(), tzinfo=timezone.utc,
        )
        base = base.where(BetRecord.bet_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(
            datetime.strptime(end_date, "%Y-%m-%d").date(),
            datetime.max.time(), tzinfo=timezone.utc,
        )
        base = base.where(BetRecord.bet_at <= end_dt)

    stmt = base.group_by(BetRecord.game_category, func.coalesce(Game.name, BetRecord.game_name), Game.id)
    result = await session.execute(stmt)
    rows = result.all()

    items = []
    for row in rows:
        total_bet = row.total_bet or Decimal("0")
        total_win = row.total_win or Decimal("0")
        rtp = (total_win / total_bet * 100) if total_bet > 0 else Decimal("0")
        items.append(RtpByGameResponse(
            game_id=0,
            game_name=row.game_name or row.game_category,
            total_bet=total_bet,
            total_win=total_win,
            rtp_percentage=round(rtp, 2),
            bet_count=row.bet_count,
        ))

    return items


# ─── RTP by Provider ───────────────────────────────────────────

@router.get("/rtp/by-provider", response_model=list[RtpByProviderResponse])
async def rtp_by_provider(
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    base = (
        select(
            GameProvider.id.label("provider_id"),
            GameProvider.name.label("provider_name"),
            func.sum(BetRecord.bet_amount).label("total_bet"),
            func.sum(BetRecord.win_amount).label("total_win"),
            func.count().label("bet_count"),
        )
        .select_from(BetRecord)
        .join(Game, Game.name == BetRecord.game_name)
        .join(GameProvider, GameProvider.id == Game.provider_id)
        .where(BetRecord.status == "settled")
    )

    if start_date:
        start_dt = datetime.combine(
            datetime.strptime(start_date, "%Y-%m-%d").date(),
            datetime.min.time(), tzinfo=timezone.utc,
        )
        base = base.where(BetRecord.bet_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(
            datetime.strptime(end_date, "%Y-%m-%d").date(),
            datetime.max.time(), tzinfo=timezone.utc,
        )
        base = base.where(BetRecord.bet_at <= end_dt)

    stmt = base.group_by(GameProvider.id, GameProvider.name)
    result = await session.execute(stmt)
    rows = result.all()

    items = []
    for row in rows:
        total_bet = row.total_bet or Decimal("0")
        total_win = row.total_win or Decimal("0")
        rtp = (total_win / total_bet * 100) if total_bet > 0 else Decimal("0")
        items.append(RtpByProviderResponse(
            provider_id=row.provider_id,
            provider_name=row.provider_name,
            total_bet=total_bet,
            total_win=total_win,
            rtp_percentage=round(rtp, 2),
            bet_count=row.bet_count,
        ))

    return items


# ─── RTP Trend ──────────────────────────────────────────────────

@router.get("/rtp/trend", response_model=list[RtpTrendResponse])
async def rtp_trend(
    days: int = Query(30, ge=1, le=365),
    game_category: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    base = (
        select(
            cast(BetRecord.bet_at, Date).label("date"),
            func.sum(BetRecord.bet_amount).label("total_bet"),
            func.sum(BetRecord.win_amount).label("total_win"),
        )
        .where(
            BetRecord.status == "settled",
            BetRecord.bet_at >= cutoff,
        )
    )

    if game_category:
        base = base.where(BetRecord.game_category == game_category)

    stmt = base.group_by(cast(BetRecord.bet_at, Date)).order_by(cast(BetRecord.bet_at, Date))
    result = await session.execute(stmt)
    rows = result.all()

    items = []
    for row in rows:
        total_bet = row.total_bet or Decimal("0")
        total_win = row.total_win or Decimal("0")
        rtp = (total_win / total_bet * 100) if total_bet > 0 else Decimal("0")
        items.append(RtpTrendResponse(
            date=row.date,
            total_bet=total_bet,
            total_win=total_win,
            rtp_percentage=round(rtp, 2),
        ))

    return items


# ═══════════════════════════════════════════════════════════════════
# Bulk operation endpoints
# ═══════════════════════════════════════════════════════════════════

# ─── Bulk User Status Update ───────────────────────────────────

@router.post("/bulk/user-status", response_model=BulkOperationResult)
async def bulk_update_user_status(
    body: BulkStatusUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    ALLOWED_STATUSES = {"active", "suspended", "blocked"}
    if body.new_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {', '.join(ALLOWED_STATUSES)}")

    success_count = 0
    errors = []

    for user_id in body.user_ids:
        user = await session.get(User, user_id)
        if not user:
            errors.append(f"User {user_id} not found")
            continue
        user.status = body.new_status
        user.updated_at = datetime.now(timezone.utc)
        session.add(user)
        success_count += 1

    await session.commit()

    return BulkOperationResult(
        success_count=success_count,
        fail_count=len(errors),
        errors=errors if errors else None,
    )


# ─── Bulk Message Send ─────────────────────────────────────────

@router.post("/bulk/user-message", response_model=BulkOperationResult)
async def bulk_send_message(
    body: BulkMessageSend,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    success_count = 0
    errors = []

    for user_id in body.user_ids:
        user = await session.get(User, user_id)
        if not user:
            errors.append(f"User {user_id} not found")
            continue

        message = Message(
            sender_type="admin",
            sender_id=current_user.id,
            receiver_type="user",
            receiver_id=user_id,
            title=body.title,
            content=body.content,
        )
        session.add(message)
        success_count += 1

    await session.commit()

    return BulkOperationResult(
        success_count=success_count,
        fail_count=len(errors),
        errors=errors if errors else None,
    )


# ─── Bulk Point Grant/Revoke ──────────────────────────────────

@router.post("/bulk/user-points", response_model=BulkOperationResult)
async def bulk_grant_points(
    body: BulkPointGrant,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    success_count = 0
    errors = []

    for user_id in body.user_ids:
        stmt = select(User).where(User.id == user_id).with_for_update()
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            errors.append(f"User {user_id} not found")
            continue

        balance_before = user.points
        user.points += body.amount
        if user.points < 0:
            user.points = Decimal("0")
        balance_after = user.points
        actual_change = balance_after - balance_before
        user.updated_at = datetime.now(timezone.utc)
        session.add(user)

        log = PointLog(
            user_id=user_id,
            type=body.type,
            amount=actual_change,
            balance_before=balance_before,
            balance_after=balance_after,
            description=body.reason,
            reference_type="admin_bulk",
            reference_id=str(current_user.id),
        )
        session.add(log)
        success_count += 1

    await session.commit()

    return BulkOperationResult(
        success_count=success_count,
        fail_count=len(errors),
        errors=errors if errors else None,
    )
