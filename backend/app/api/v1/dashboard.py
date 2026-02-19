"""Dashboard statistics endpoints."""

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.commission import CommissionLedger
from app.models.game import Game, GameRound
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.dashboard import DashboardStats, RecentCommission, RecentTransaction
from app.services.cache_service import cache_get, cache_set

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

KST = ZoneInfo("Asia/Seoul")


# ─── Dashboard Stats ──────────────────────────────────────────────

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("dashboard.view")),
) -> DashboardStats:
    cached = await cache_get("dashboard:stats")
    if cached:
        return DashboardStats(**cached)

    # Calculate "today" in KST, then convert to UTC for DB queries
    kst_now = datetime.now(KST)
    kst_today_start = datetime.combine(kst_now.date(), datetime.min.time(), tzinfo=KST)
    today_start = kst_today_start.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

    # Agent count (active, non-super_admin)
    agent_count = (await session.execute(
        select(func.count()).where(
            AdminUser.status == "active",
            AdminUser.role != "super_admin",
        )
    )).scalar() or 0

    # User count (active)
    user_count = (await session.execute(
        select(func.count()).where(User.status == "active")
    )).scalar() or 0

    # Today's approved deposits/withdrawals
    tx_sums = (await session.execute(
        select(
            func.coalesce(func.sum(
                case((Transaction.type == "deposit", Transaction.amount), else_=0)
            ), 0).label("deposits"),
            func.coalesce(func.sum(
                case((Transaction.type == "withdrawal", Transaction.amount), else_=0)
            ), 0).label("withdrawals"),
        ).where(
            Transaction.status == "approved",
            Transaction.created_at >= today_start,
        )
    )).one()

    # Today's bets
    today_bets = (await session.execute(
        select(func.coalesce(func.sum(GameRound.bet_amount), 0)).where(
            GameRound.created_at >= today_start,
        )
    )).scalar() or 0

    # Today's commissions
    today_commissions = (await session.execute(
        select(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).where(
            CommissionLedger.created_at >= today_start,
        )
    )).scalar() or 0

    # Total user balance
    total_balance = (await session.execute(
        select(func.coalesce(func.sum(User.balance), 0))
    )).scalar() or 0

    # Active games
    active_games = (await session.execute(
        select(func.count()).where(Game.is_active == True)
    )).scalar() or 0

    # Pending deposits/withdrawals count
    pending_deposits = (await session.execute(
        select(func.count()).where(
            Transaction.status == "pending",
            Transaction.type == "deposit",
        )
    )).scalar() or 0

    pending_withdrawals = (await session.execute(
        select(func.count()).where(
            Transaction.status == "pending",
            Transaction.type == "withdrawal",
        )
    )).scalar() or 0

    stats = DashboardStats(
        total_agents=agent_count,
        total_users=user_count,
        today_deposits=tx_sums.deposits,
        today_withdrawals=tx_sums.withdrawals,
        today_bets=today_bets,
        today_commissions=today_commissions,
        total_balance=total_balance,
        active_games=active_games,
        pending_deposits=pending_deposits,
        pending_withdrawals=pending_withdrawals,
    )
    await cache_set("dashboard:stats", stats.model_dump(), ttl=30)
    return stats


# ─── Recent Transactions ──────────────────────────────────────────

@router.get("/recent-transactions", response_model=list[RecentTransaction])
async def get_recent_transactions(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("dashboard.view")),
) -> list[RecentTransaction]:
    stmt = (
        select(Transaction, User.username.label("user_username"))
        .outerjoin(User, User.id == Transaction.user_id)
        .order_by(Transaction.created_at.desc())
        .limit(10)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        RecentTransaction(
            id=tx.id,
            user_id=tx.user_id,
            user_username=uname,
            type=tx.type,
            action=tx.action,
            amount=tx.amount,
            status=tx.status,
            created_at=tx.created_at,
        )
        for tx, uname in rows
    ]


# ─── Recent Commissions ───────────────────────────────────────────

@router.get("/recent-commissions", response_model=list[RecentCommission])
async def get_recent_commissions(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("dashboard.view")),
) -> list[RecentCommission]:
    stmt = (
        select(CommissionLedger, AdminUser.username.label("agent_username"))
        .outerjoin(AdminUser, AdminUser.id == CommissionLedger.agent_id)
        .order_by(CommissionLedger.created_at.desc())
        .limit(10)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        RecentCommission(
            id=cl.id,
            agent_id=cl.agent_id,
            agent_username=aname,
            type=cl.type,
            commission_amount=cl.commission_amount,
            status=cl.status,
            created_at=cl.created_at,
        )
        for cl, aname in rows
    ]
