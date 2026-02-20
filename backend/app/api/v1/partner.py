"""Partner dashboard endpoints - all data scoped to current user's subtree.

MLM model: AdminUser logs into admin panel, but commissions are tracked
via recipient_user_id (User.id). We resolve AdminUser → User by username match,
then query CommissionLedger using the User tree.
"""

from datetime import date, datetime, time as time_type, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser, AdminUserTree
from app.models.commission import CommissionLedger
from app.models.game import GameRound
from app.models.settlement import Settlement
from app.models.user import User
from app.schemas.partner import (
    PartnerCommissionItem,
    PartnerCommissionListResponse,
    PartnerDashboardStats,
    PartnerSettlementItem,
    PartnerSettlementListResponse,
    PartnerTreeNode,
    PartnerUserItem,
    PartnerUserListResponse,
)
from app.services.user_tree_service import get_descendants as get_user_descendants

router = APIRouter(prefix="/partner", tags=["partner"])


async def _resolve_user_id(session: AsyncSession, admin_user: AdminUser) -> int:
    """Resolve AdminUser → User.id by username match."""
    result = await session.execute(
        select(User.id).where(User.username == admin_user.username).limit(1)
    )
    user_id = result.scalar_one_or_none()
    if user_id is None:
        raise HTTPException(status_code=404, detail="Matching user account not found")
    return user_id


async def _get_user_descendant_ids(session: AsyncSession, user_id: int) -> list[int]:
    """Get all descendant User IDs (excluding self) from UserTree."""
    descendants = await get_user_descendants(session, user_id)
    return [d["user"].id for d in descendants]


# ─── Dashboard Stats ────────────────────────────────────────────

@router.get("/dashboard", response_model=PartnerDashboardStats)
async def get_partner_dashboard(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("partner.view")),
) -> PartnerDashboardStats:
    user_id = await _resolve_user_id(session, current_user)
    descendant_ids = await _get_user_descendant_ids(session, user_id)
    all_ids = [user_id] + descendant_ids

    # Count sub-agents (excluding self)
    total_sub_agents = len(descendant_ids)

    # Count unique bettors from commission ledger under this subtree
    total_sub_users = (await session.execute(
        select(func.count(func.distinct(CommissionLedger.user_id))).where(
            CommissionLedger.recipient_user_id.in_(all_ids)
        )
    )).scalar() or 0

    # Total bet amount from commission ledger (source_amount for rolling type)
    total_bet_amount = (await session.execute(
        select(func.coalesce(func.sum(CommissionLedger.source_amount), 0)).where(
            CommissionLedger.recipient_user_id.in_(all_ids),
            CommissionLedger.type == "rolling",
        )
    )).scalar() or 0

    # Total commission earned (own only)
    total_commission = (await session.execute(
        select(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).where(
            CommissionLedger.recipient_user_id == user_id,
        )
    )).scalar() or 0

    # This month's data
    month_start = datetime.combine(date.today().replace(day=1), time_type.min, tzinfo=timezone.utc)

    # Settlement.agent_id now stores recipient_user_id
    month_settlement = (await session.execute(
        select(func.coalesce(func.sum(Settlement.net_total), 0)).where(
            Settlement.agent_id == user_id,
            Settlement.created_at >= month_start,
        )
    )).scalar() or 0

    month_bet_amount = (await session.execute(
        select(func.coalesce(func.sum(CommissionLedger.source_amount), 0)).where(
            CommissionLedger.recipient_user_id.in_(all_ids),
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
    # Tree view still uses AdminUserTree (admin hierarchy display)
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
    user_id = await _resolve_user_id(session, current_user)
    descendant_ids = await _get_user_descendant_ids(session, user_id)
    all_ids = [user_id] + descendant_ids

    # Get bettor IDs associated with this user subtree via commission ledger
    user_ids_stmt = (
        select(func.distinct(CommissionLedger.user_id)).where(
            CommissionLedger.recipient_user_id.in_(all_ids)
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

    # Batch query: get bet/win totals for all users at once
    fetched_user_ids = [u.id for u in users]
    stats_map: dict[int, tuple[float, float]] = {}
    if fetched_user_ids:
        bet_stats = (await session.execute(
            select(
                GameRound.user_id,
                func.coalesce(func.sum(GameRound.bet_amount), 0),
                func.coalesce(func.sum(GameRound.win_amount), 0),
            )
            .where(GameRound.user_id.in_(fetched_user_ids))
            .group_by(GameRound.user_id)
        )).all()
        stats_map = {row[0]: (float(row[1]), float(row[2])) for row in bet_stats}

    items = []
    for u in users:
        bet_sum, win_sum = stats_map.get(u.id, (0.0, 0.0))
        items.append(PartnerUserItem(
            id=u.id,
            username=u.username,
            status=u.status,
            balance=float(u.balance),
            total_bet=bet_sum,
            total_win=win_sum,
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
    user_id = await _resolve_user_id(session, current_user)

    base = select(CommissionLedger).where(
        CommissionLedger.recipient_user_id == user_id
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
    ).where(CommissionLedger.recipient_user_id == user_id)
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
    # Settlement.agent_id now stores recipient_user_id
    user_id = await _resolve_user_id(session, current_user)

    base = select(Settlement).where(
        Settlement.agent_id == user_id
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
