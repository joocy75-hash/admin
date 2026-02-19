"""Monitoring endpoints: realtime stats, live transactions, active alerts, health."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.config import settings
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.fraud_alert import FraudAlert
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.monitoring import (
    ActiveAlertsResponse,
    HealthCheckResponse,
    LiveTransactionResponse,
    RealtimeStatsResponse,
)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])



# ─── Realtime Stats ──────────────────────────────────────────────

@router.get("/realtime-stats", response_model=RealtimeStatsResponse)
async def realtime_stats(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("monitoring.view")),
):
    utc_now = datetime.now(timezone.utc)
    today_start = datetime.combine(utc_now.date(), datetime.min.time(), tzinfo=timezone.utc)

    active_threshold = utc_now - timedelta(minutes=30)
    active_users = (await session.execute(
        select(func.count()).where(
            User.status == "active",
            User.last_login_at >= active_threshold,
        )
    )).scalar() or 0

    # Pending deposits count
    pending_deposits = (await session.execute(
        select(func.count()).where(
            Transaction.status == "pending",
            Transaction.type == "deposit",
        )
    )).scalar() or 0

    # Pending withdrawals count
    pending_withdrawals = (await session.execute(
        select(func.count()).where(
            Transaction.status == "pending",
            Transaction.type == "withdrawal",
        )
    )).scalar() or 0

    # Today's approved deposit/withdrawal sums
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

    today_revenue = tx_sums.deposits - tx_sums.withdrawals

    return RealtimeStatsResponse(
        active_users=active_users,
        pending_deposits=pending_deposits,
        pending_withdrawals=pending_withdrawals,
        today_revenue=today_revenue,
        today_deposits=tx_sums.deposits,
        today_withdrawals=tx_sums.withdrawals,
    )


# ─── Live Transactions ───────────────────────────────────────────

@router.get("/transactions/live", response_model=list[LiveTransactionResponse])
async def live_transactions(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("monitoring.view")),
):
    stmt = (
        select(Transaction, User.username.label("user_username"))
        .outerjoin(User, User.id == Transaction.user_id)
        .order_by(Transaction.created_at.desc())
        .limit(20)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        LiveTransactionResponse(
            id=tx.id,
            user_id=tx.user_id,
            user_username=uname,
            type=tx.type,
            action=tx.action,
            amount=tx.amount,
            status=tx.status,
            coin_type=tx.coin_type,
            created_at=tx.created_at,
        )
        for tx, uname in rows
    ]


# ─── Active Alerts ───────────────────────────────────────────────

@router.get("/alerts/active", response_model=ActiveAlertsResponse)
async def active_alerts(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("monitoring.view")),
):
    # Count active (non-resolved) alerts
    active_count = (await session.execute(
        select(func.count()).where(
            FraudAlert.status.in_(["open", "investigating"])
        )
    )).scalar() or 0

    # Top 5 most recent active alerts
    stmt = (
        select(FraudAlert)
        .where(FraudAlert.status.in_(["open", "investigating"]))
        .order_by(FraudAlert.detected_at.desc())
        .limit(5)
    )
    result = await session.execute(stmt)
    alerts = result.scalars().all()

    recent_alerts = [
        {
            "id": a.id,
            "user_id": a.user_id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "description": a.description,
            "detected_at": a.detected_at.isoformat() if a.detected_at else None,
        }
        for a in alerts
    ]

    return ActiveAlertsResponse(active_count=active_count, recent_alerts=recent_alerts)


# ─── Health Check ────────────────────────────────────────────────

@router.get("/health", response_model=HealthCheckResponse)
async def health_check(
    current_user: AdminUser = Depends(PermissionChecker("monitoring.view")),
):
    from app.database import async_session

    checks = {"db": "unknown", "redis": "unknown"}

    # DB check
    try:
        async with async_session() as session:
            await session.execute(select(1))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {e!s}"

    # Redis check
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e!s}"

    all_ok = all(v == "ok" for v in checks.values())
    return HealthCheckResponse(
        status="ok" if all_ok else "degraded",
        version="0.1.0",
        service="admin-panel-backend",
        checks=checks,
    )
