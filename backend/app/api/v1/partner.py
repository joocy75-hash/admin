"""Partner dashboard endpoints - all data scoped to current user's subtree."""

from datetime import datetime, date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser, AdminUserTree
from app.models.user import User
from app.models.commission import CommissionLedger
from app.models.settlement import Settlement
from app.models.game import GameRound
from app.schemas.partner import (
    PartnerDashboardStats,
    PartnerTreeNode,
    PartnerUserItem,
    PartnerUserListResponse,
    PartnerCommissionItem,
    PartnerCommissionListResponse,
    PartnerSettlementItem,
    PartnerSettlementListResponse,
)
from app.services.tree_service import get_descendants

router = APIRouter(prefix="/partner", tags=["partner"])


async def _get_descendant_ids(session: AsyncSession, user_id: int) -> list[int]:
    """Get all descendant admin user IDs (excluding self)."""
    descendants = await get_descendants(session, user_id)
    return [d["user"].id for d in descendants]


# ─── Dashboard Stats ────────────────────────────────────────────

@router.get("/dashboard", response_model=PartnerDashboardStats)
async def get_partner_dashboard(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("partner.view")),
) -> PartnerDashboardStats:
    descendant_ids = await _get_descendant_ids(session, current_user.id)
    all_ids = [current_user.id] + descendant_ids

    # Count sub-agents (excluding self)
    total_sub_agents = len(descendant_ids)

    # Count unique users from commission ledger under this subtree
    total_sub_users = (await session.execute(
        select(func.count(func.distinct(CommissionLedger.user_id))).where(
            CommissionLedger.agent_id.in_(all_ids)
        )
    )).scalar() or 0

    # Total bet amount from commission ledger (source_amount for rolling type)
    total_bet_amount = (await session.execute(
        select(func.coalesce(func.sum(CommissionLedger.source_amount), 0)).where(
            CommissionLedger.agent_id.in_(all_ids),
            CommissionLedger.type == "rolling",
        )
    )).scalar() or 0

    # Total commission earned
    total_commission = (await session.execute(
        select(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).where(
            CommissionLedger.agent_id == current_user.id,
        )
    )).scalar() or 0

    # This month's data
    month_start = datetime.combine(date.today().replace(day=1), datetime.min.time())

    month_settlement = (await session.execute(
        select(func.coalesce(func.sum(Settlement.net_total), 0)).where(
            Settlement.agent_id == current_user.id,
            Settlement.created_at >= month_start,
        )
    )).scalar() or 0

    month_bet_amount = (await session.execute(
        select(func.coalesce(func.sum(CommissionLedger.source_amount), 0)).where(
            CommissionLedger.agent_id.in_(all_ids),
            CommissionLedger.type == "rolling",
            CommissionLedger.created_at >= month_start,
        )
    )).scalar() or 0

    return PartnerDashboardStats(
        total_sub_users=total_sub_users,
        total_sub_agents=total_sub_agents,
        total_bet_amount=float(total_bet_amount),
        total_commission=float(total_commission),
        month_settlement=float(month_settlement),
        month_bet_amount=float(month_bet_amount),
    )


# ─── Tree ────────────────────────────────────────────────────────

@router.get("/tree", response_model=list[PartnerTreeNode])
async def get_partner_tree(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("partner.view")),
) -> list[PartnerTreeNode]:
    # Get full subtree including self
    stmt = (
        select(AdminUser, AdminUserTree.depth)
        .join(AdminUserTree, AdminUserTree.descendant_id == AdminUser.id)
        .where(AdminUserTree.ancestor_id == current_user.id)
        .order_by(AdminUserTree.depth, AdminUser.agent_code)
    )
    result = await session.execute(stmt)

    return [
        PartnerTreeNode(
            id=user.id,
            username=user.username,
            role=user.role,
            level=depth,
            status=user.status,
            agent_code=user.agent_code,
        )
        for user, depth in result.all()
    ]


# ─── Users (unique users from commission ledger) ────────────────

@router.get("/users", response_model=PartnerUserListResponse)
async def get_partner_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("partner.view")),
) -> PartnerUserListResponse:
    descendant_ids = await _get_descendant_ids(session, current_user.id)
    all_ids = [current_user.id] + descendant_ids

    # Get user IDs associated with this agent subtree via commission ledger
    user_ids_stmt = (
        select(func.distinct(CommissionLedger.user_id)).where(
            CommissionLedger.agent_id.in_(all_ids)
        )
    )

    base = select(User).where(User.id.in_(user_ids_stmt))

    if search:
        base = base.where(User.username.ilike(f"%{search}%"))
    if status_filter:
        base = base.where(User.status == status_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(User.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    users = result.scalars().all()

    # Get bet/win totals per user
    items = []
    for u in users:
        bet_sum = (await session.execute(
            select(func.coalesce(func.sum(GameRound.bet_amount), 0)).where(
                GameRound.user_id == u.id
            )
        )).scalar() or 0
        win_sum = (await session.execute(
            select(func.coalesce(func.sum(GameRound.win_amount), 0)).where(
                GameRound.user_id == u.id
            )
        )).scalar() or 0

        items.append(PartnerUserItem(
            id=u.id,
            username=u.username,
            status=u.status,
            balance=float(u.balance),
            total_bet=float(bet_sum),
            total_win=float(win_sum),
            created_at=u.created_at,
        ))

    return PartnerUserListResponse(
        items=items, total=total, page=page, page_size=page_size
    )


# ─── Commissions ────────────────────────────────────────────────

@router.get("/commissions", response_model=PartnerCommissionListResponse)
async def get_partner_commissions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("partner.view")),
) -> PartnerCommissionListResponse:
    base = select(CommissionLedger).where(
        CommissionLedger.agent_id == current_user.id
    )

    if type_filter:
        base = base.where(CommissionLedger.type == type_filter)
    if date_from:
        base = base.where(CommissionLedger.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        base = base.where(CommissionLedger.created_at <= datetime.fromisoformat(date_to))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Total commission for filtered results
    total_comm_stmt = select(
        func.coalesce(func.sum(CommissionLedger.commission_amount), 0)
    ).where(CommissionLedger.agent_id == current_user.id)
    if type_filter:
        total_comm_stmt = total_comm_stmt.where(CommissionLedger.type == type_filter)
    if date_from:
        total_comm_stmt = total_comm_stmt.where(
            CommissionLedger.created_at >= datetime.fromisoformat(date_from)
        )
    if date_to:
        total_comm_stmt = total_comm_stmt.where(
            CommissionLedger.created_at <= datetime.fromisoformat(date_to)
        )
    total_commission = (await session.execute(total_comm_stmt)).scalar() or 0

    stmt = base.order_by(CommissionLedger.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    ledgers = result.scalars().all()

    items = [
        PartnerCommissionItem(
            id=cl.id,
            type=cl.type,
            source_amount=float(cl.source_amount),
            rate=float(cl.rate),
            commission_amount=float(cl.commission_amount),
            status=cl.status,
            reference_id=cl.reference_id,
            created_at=cl.created_at,
        )
        for cl in ledgers
    ]

    return PartnerCommissionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_commission=float(total_commission),
    )


# ─── Settlements ────────────────────────────────────────────────

@router.get("/settlements", response_model=PartnerSettlementListResponse)
async def get_partner_settlements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("partner.view")),
) -> PartnerSettlementListResponse:
    base = select(Settlement).where(
        Settlement.agent_id == current_user.id
    )

    if status_filter:
        base = base.where(Settlement.status == status_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Settlement.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    settlements = result.scalars().all()

    items = [
        PartnerSettlementItem(
            id=s.id,
            period_start=s.period_start,
            period_end=s.period_end,
            total_commission=float(s.net_total),
            status=s.status,
            paid_at=s.paid_at,
            created_at=s.created_at,
        )
        for s in settlements
    ]

    return PartnerSettlementListResponse(
        items=items, total=total, page=page, page_size=page_size
    )
