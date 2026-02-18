"""BI Dashboard analytics endpoints."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, extract, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser, AdminUserTree
from app.models.bet_record import BetRecord
from app.models.commission import CommissionLedger
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.bi import (
    AgentPerformanceItem,
    AgentPerformanceResponse,
    CohortItem,
    CohortResponse,
    GamePerformanceItem,
    GamePerformanceResponse,
    OverviewResponse,
    RevenueSummaryResponse,
    RevenueTrendItem,
    RevenueTrendResponse,
    UserRetentionResponse,
)

router = APIRouter(prefix="/bi", tags=["bi"])

ZERO = Decimal("0")


def _period_range(period: str) -> tuple[datetime, datetime]:
    """Return (start, end) datetime pair for named period."""
    today = date.today()
    if period == "today":
        start = today
        end = today + timedelta(days=1)
    elif period == "week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=7)
    elif period == "month":
        start = today.replace(day=1)
        if today.month == 12:
            end = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end = today.replace(month=today.month + 1, day=1)
    elif period == "year":
        start = today.replace(month=1, day=1)
        end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        start = today - timedelta(days=30)
        end = today + timedelta(days=1)

    from datetime import time as time_type
    return (
        datetime.combine(start, time_type.min, tzinfo=timezone.utc),
        datetime.combine(end, time_type.min, tzinfo=timezone.utc),
    )


def _pct_change(current: Decimal, previous: Decimal) -> float:
    if previous == ZERO:
        return 0.0 if current == ZERO else 100.0
    return round(float((current - previous) / previous * 100), 2)


# ═══════════════════════════════════════════════════════════════════
# Revenue
# ═══════════════════════════════════════════════════════════════════

@router.get("/revenue", response_model=RevenueSummaryResponse)
async def revenue_summary(
    period: str = Query("month", pattern=r"^(today|week|month|year)$"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    cur_start, cur_end = _period_range(period)
    duration = cur_end - cur_start
    prev_start = cur_start - duration
    prev_end = cur_start

    async def _sum_by_type(start: datetime, end: datetime):
        stmt = select(
            func.coalesce(func.sum(
                case((Transaction.type == "deposit", Transaction.amount), else_=ZERO)
            ), ZERO).label("deposits"),
            func.coalesce(func.sum(
                case((Transaction.type == "withdrawal", Transaction.amount), else_=ZERO)
            ), ZERO).label("withdrawals"),
        ).where(
            Transaction.status == "approved",
            Transaction.created_at >= start,
            Transaction.created_at < end,
        )
        row = (await session.execute(stmt)).one()
        return row.deposits, row.withdrawals

    cur_dep, cur_wth = await _sum_by_type(cur_start, cur_end)
    prev_dep, prev_wth = await _sum_by_type(prev_start, prev_end)

    cur_net = cur_dep - cur_wth
    prev_net = prev_dep - prev_wth

    return RevenueSummaryResponse(
        total_deposits=cur_dep,
        total_withdrawals=cur_wth,
        net_revenue=cur_net,
        period=period,
        prev_deposits=prev_dep,
        prev_withdrawals=prev_wth,
        prev_net=prev_net,
        deposit_change_pct=_pct_change(cur_dep, prev_dep),
        withdrawal_change_pct=_pct_change(cur_wth, prev_wth),
        revenue_change_pct=_pct_change(cur_net, prev_net),
    )


@router.get("/revenue/trend", response_model=RevenueTrendResponse)
async def revenue_trend(
    days: int = Query(30, ge=1, le=365),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    start = datetime.combine(date.today() - timedelta(days=days - 1), datetime.min.time())

    stmt = select(
        func.date(Transaction.created_at).label("day"),
        func.coalesce(func.sum(
            case((Transaction.type == "deposit", Transaction.amount), else_=ZERO)
        ), ZERO).label("deposits"),
        func.coalesce(func.sum(
            case((Transaction.type == "withdrawal", Transaction.amount), else_=ZERO)
        ), ZERO).label("withdrawals"),
    ).where(
        Transaction.status == "approved",
        Transaction.created_at >= start,
    ).group_by(func.date(Transaction.created_at)).order_by(func.date(Transaction.created_at))

    result = await session.execute(stmt)
    rows = result.all()

    items: list[RevenueTrendItem] = []
    cumulative = ZERO
    for row in rows:
        net = row.deposits - row.withdrawals
        cumulative += net
        items.append(RevenueTrendItem(
            date=row.day,
            deposits=row.deposits,
            withdrawals=row.withdrawals,
            net=net,
            cumulative_net=cumulative,
        ))

    return RevenueTrendResponse(items=items, days=days)


# ═══════════════════════════════════════════════════════════════════
# Users
# ═══════════════════════════════════════════════════════════════════

@router.get("/users/retention", response_model=UserRetentionResponse)
async def user_retention(
    period: str = Query("month", pattern=r"^(today|week|month|year)$"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    cur_start, cur_end = _period_range(period)

    total_stmt = select(func.count()).select_from(User)
    total_users = (await session.execute(total_stmt)).scalar() or 0

    new_stmt = select(func.count()).select_from(User).where(
        User.created_at >= cur_start, User.created_at < cur_end
    )
    new_users = (await session.execute(new_stmt)).scalar() or 0

    active_subq = (
        select(BetRecord.user_id)
        .where(BetRecord.bet_at >= cur_start, BetRecord.bet_at < cur_end)
        .distinct()
        .subquery()
    )
    active_stmt = select(func.count()).select_from(active_subq)
    active_users = (await session.execute(active_stmt)).scalar() or 0

    active_ratio = round(active_users / total_users, 4) if total_users > 0 else 0.0
    churn_rate = round(1.0 - active_ratio, 4)

    return UserRetentionResponse(
        new_users=new_users,
        active_users=active_users,
        total_users=total_users,
        active_ratio=active_ratio,
        churn_rate=churn_rate,
        period=period,
    )


@router.get("/users/cohort", response_model=CohortResponse)
async def user_cohort(
    months: int = Query(6, ge=1, le=12),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    today = date.today()
    items: list[CohortItem] = []

    for i in range(months - 1, -1, -1):
        ref = today.replace(day=1)
        for _ in range(i):
            ref = (ref - timedelta(days=1)).replace(day=1)

        month_start = datetime.combine(ref, datetime.min.time())
        if ref.month == 12:
            next_month = ref.replace(year=ref.year + 1, month=1, day=1)
        else:
            next_month = ref.replace(month=ref.month + 1, day=1)
        month_end = datetime.combine(next_month, datetime.min.time())

        reg_stmt = select(User.id).where(
            User.created_at >= month_start, User.created_at < month_end
        )
        reg_result = await session.execute(reg_stmt)
        registered_ids = [r[0] for r in reg_result.all()]
        reg_count = len(registered_ids)

        if reg_count == 0:
            items.append(CohortItem(
                registration_month=ref.strftime("%Y-%m"),
                month_0_pct=0.0, month_1_pct=0.0,
                month_2_pct=0.0, month_3_pct=0.0,
            ))
            continue

        pcts = []
        for m_offset in range(4):
            check_ref = ref
            for _ in range(m_offset):
                if check_ref.month == 12:
                    check_ref = check_ref.replace(year=check_ref.year + 1, month=1)
                else:
                    check_ref = check_ref.replace(month=check_ref.month + 1)
            c_start = datetime.combine(check_ref, datetime.min.time())
            if check_ref.month == 12:
                c_next = check_ref.replace(year=check_ref.year + 1, month=1, day=1)
            else:
                c_next = check_ref.replace(month=check_ref.month + 1, day=1)
            c_end = datetime.combine(c_next, datetime.min.time())

            if c_start > datetime.combine(today, datetime.min.time()):
                pcts.append(0.0)
                continue

            active_stmt = (
                select(func.count(func.distinct(BetRecord.user_id)))
                .where(
                    BetRecord.user_id.in_(registered_ids),
                    BetRecord.bet_at >= c_start,
                    BetRecord.bet_at < c_end,
                )
            )
            active_count = (await session.execute(active_stmt)).scalar() or 0
            pcts.append(round(active_count / reg_count * 100, 2))

        items.append(CohortItem(
            registration_month=ref.strftime("%Y-%m"),
            month_0_pct=pcts[0], month_1_pct=pcts[1],
            month_2_pct=pcts[2], month_3_pct=pcts[3],
        ))

    return CohortResponse(items=items)


# ═══════════════════════════════════════════════════════════════════
# Games
# ═══════════════════════════════════════════════════════════════════

@router.get("/games/performance", response_model=GamePerformanceResponse)
async def game_performance(
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    base_filters = []
    if start_date:
        base_filters.append(
            BetRecord.bet_at >= datetime.combine(
                datetime.strptime(start_date, "%Y-%m-%d").date(), datetime.min.time()
            )
        )
    if end_date:
        base_filters.append(
            BetRecord.bet_at <= datetime.combine(
                datetime.strptime(end_date, "%Y-%m-%d").date(), datetime.max.time()
            )
        )

    stmt = select(
        BetRecord.game_category.label("game_name"),
        func.coalesce(func.sum(BetRecord.bet_amount), ZERO).label("total_bet"),
        func.coalesce(func.sum(BetRecord.win_amount), ZERO).label("total_win"),
        func.count(func.distinct(BetRecord.user_id)).label("player_count"),
        func.coalesce(func.avg(BetRecord.bet_amount), ZERO).label("avg_bet"),
    ).where(*base_filters).group_by(
        BetRecord.game_category
    ).order_by(func.sum(BetRecord.bet_amount).desc()).limit(limit)

    result = await session.execute(stmt)
    rows = result.all()

    items = []
    for row in rows:
        total_bet = row.total_bet or ZERO
        total_win = row.total_win or ZERO
        rtp = float(total_win / total_bet * 100) if total_bet > ZERO else 0.0
        items.append(GamePerformanceItem(
            game_id=None,
            game_name=row.game_name or "unknown",
            total_bet=total_bet,
            total_win=total_win,
            rtp_pct=round(rtp, 2),
            player_count=row.player_count,
            avg_bet=round(row.avg_bet, 2),
        ))

    return GamePerformanceResponse(items=items)


# ═══════════════════════════════════════════════════════════════════
# Agents
# ═══════════════════════════════════════════════════════════════════

@router.get("/agents/performance", response_model=AgentPerformanceResponse)
async def agent_performance(
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    # Downline count per agent
    downline_stmt = select(
        AdminUserTree.ancestor_id.label("agent_id"),
        func.count(AdminUserTree.descendant_id).label("downline_count"),
    ).where(AdminUserTree.depth > 0).group_by(AdminUserTree.ancestor_id)
    downline_result = await session.execute(downline_stmt)
    downline_map = {r.agent_id: r.downline_count for r in downline_result.all()}

    # Commission earned per agent
    comm_filters = [CommissionLedger.status.in_(["settled", "pending"])]
    if start_date:
        comm_filters.append(
            CommissionLedger.created_at >= datetime.combine(
                datetime.strptime(start_date, "%Y-%m-%d").date(), datetime.min.time()
            )
        )
    if end_date:
        comm_filters.append(
            CommissionLedger.created_at <= datetime.combine(
                datetime.strptime(end_date, "%Y-%m-%d").date(), datetime.max.time()
            )
        )

    comm_stmt = select(
        CommissionLedger.agent_id,
        func.coalesce(func.sum(CommissionLedger.commission_amount), ZERO).label("commission_earned"),
    ).where(*comm_filters).group_by(CommissionLedger.agent_id)
    comm_result = await session.execute(comm_stmt)
    comm_map = {r.agent_id: r.commission_earned for r in comm_result.all()}

    # Get all agents
    agents_stmt = select(AdminUser).where(AdminUser.status == "active").limit(limit)
    agents_result = await session.execute(agents_stmt)
    agents = agents_result.scalars().all()

    items = []
    for agent in agents:
        downline = downline_map.get(agent.id, 0)
        commission = comm_map.get(agent.id, ZERO)
        items.append(AgentPerformanceItem(
            agent_id=agent.id,
            agent_name=agent.username,
            downline_count=downline,
            total_deposit=ZERO,
            total_bet=ZERO,
            commission_earned=commission,
            net_revenue=commission,
        ))

    items.sort(key=lambda x: x.net_revenue, reverse=True)
    return AgentPerformanceResponse(items=items[:limit])


# ═══════════════════════════════════════════════════════════════════
# Overview (8 KPI cards)
# ═══════════════════════════════════════════════════════════════════

@router.get("/overview", response_model=OverviewResponse)
async def executive_overview(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("report.view")),
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today() + timedelta(days=1), datetime.min.time())

    # Total users
    total_users = (await session.execute(
        select(func.count()).select_from(User)
    )).scalar() or 0

    # Active today (users with bets today)
    active_subq = (
        select(BetRecord.user_id)
        .where(BetRecord.bet_at >= today_start, BetRecord.bet_at < today_end)
        .distinct()
        .subquery()
    )
    active_today = (await session.execute(
        select(func.count()).select_from(active_subq)
    )).scalar() or 0

    # Deposits/Withdrawals today
    txn_stmt = select(
        func.coalesce(func.sum(
            case((Transaction.type == "deposit", Transaction.amount), else_=ZERO)
        ), ZERO).label("deposits"),
        func.coalesce(func.sum(
            case((Transaction.type == "withdrawal", Transaction.amount), else_=ZERO)
        ), ZERO).label("withdrawals"),
    ).where(
        Transaction.status == "approved",
        Transaction.created_at >= today_start,
        Transaction.created_at < today_end,
    )
    txn_row = (await session.execute(txn_stmt)).one()

    # Bets today
    bets_stmt = select(
        func.coalesce(func.sum(BetRecord.bet_amount), ZERO)
    ).where(BetRecord.bet_at >= today_start, BetRecord.bet_at < today_end)
    bets_today = (await session.execute(bets_stmt)).scalar() or ZERO

    # New registrations today
    new_reg = (await session.execute(
        select(func.count()).select_from(User).where(
            User.created_at >= today_start, User.created_at < today_end
        )
    )).scalar() or 0

    # Pending withdrawals count
    pending_wth = (await session.execute(
        select(func.count()).select_from(Transaction).where(
            Transaction.type == "withdrawal", Transaction.status == "pending"
        )
    )).scalar() or 0

    return OverviewResponse(
        total_users=total_users,
        active_today=active_today,
        deposits_today=txn_row.deposits,
        withdrawals_today=txn_row.withdrawals,
        net_revenue_today=txn_row.deposits - txn_row.withdrawals,
        bets_today=bets_today,
        new_registrations_today=new_reg,
        pending_withdrawals=pending_wth,
    )
