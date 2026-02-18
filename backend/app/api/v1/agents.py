"""Agent CRUD, tree management, and commission rate endpoints."""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker, get_current_user
from app.models.admin_user import AdminUser, AdminUserTree
from app.models.agent_commission_rate import AgentCommissionRate
from app.models.role import AdminUserRole, Role
from app.schemas.agent import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentListResponse,
    AgentAncestor,
    AgentMoveRequest,
    AgentTreeResponse,
    PasswordResetRequest,
)
from app.schemas.commission import (
    AgentCommissionRateResponse,
    AgentCommissionRateUpdate,
    AgentCommissionRateBulkUpdate,
)
from app.services.tree_service import (
    insert_node,
    get_descendants,
    get_children,
    get_ancestors,
    get_descendant_count,
    get_subtree_for_tree_view,
    move_node,
    is_ancestor,
)
from app.services.commission_engine import (
    validate_rate_against_parent,
    validate_rate_against_children,
)
from app.utils.security import hash_password

router = APIRouter(prefix="/agents", tags=["agents"])


def _to_agent_response(user: AdminUser, children_count: int = 0) -> AgentResponse:
    return AgentResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        agent_code=user.agent_code,
        status=user.status,
        depth=user.depth,
        parent_id=user.parent_id,
        max_sub_agents=user.max_sub_agents,
        rolling_rate=user.rolling_rate,
        losing_rate=user.losing_rate,
        deposit_rate=user.deposit_rate,
        balance=user.balance,
        pending_balance=user.pending_balance,
        two_factor_enabled=user.two_factor_enabled,
        last_login_at=user.last_login_at,
        memo=user.memo,
        created_at=user.created_at,
        updated_at=user.updated_at,
        children_count=children_count,
    )


async def _build_agent_response(session: AsyncSession, user: AdminUser) -> AgentResponse:
    children_count = await get_descendant_count(session, user.id)
    return _to_agent_response(user, children_count)


async def _batch_descendant_counts(session: AsyncSession, user_ids: list[int]) -> dict[int, int]:
    """Batch query descendant counts for multiple agents via Closure Table."""
    if not user_ids:
        return {}
    result = await session.execute(
        select(
            AdminUserTree.ancestor_id,
            func.count(),
        )
        .where(
            AdminUserTree.ancestor_id.in_(user_ids),
            AdminUserTree.depth > 0,
        )
        .group_by(AdminUserTree.ancestor_id)
    )
    return {row[0]: row[1] for row in result.all()}


# ─── List ────────────────────────────────────────────────────────────

@router.get("", response_model=AgentListResponse)
async def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    role: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    parent_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.view")),
):
    base = select(AdminUser).where(AdminUser.role != "super_admin")

    if search:
        base = base.where(
            or_(
                AdminUser.username.ilike(f"%{search}%"),
                AdminUser.agent_code.ilike(f"%{search}%"),
                AdminUser.email.ilike(f"%{search}%"),
            )
        )
    if role:
        base = base.where(AdminUser.role == role)
    if status_filter:
        base = base.where(AdminUser.status == status_filter)
    if parent_id is not None:
        base = base.where(AdminUser.parent_id == parent_id)

    # Count
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Paginated results
    stmt = base.order_by(AdminUser.depth, AdminUser.agent_code).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    users = result.scalars().all()

    user_ids = [u.id for u in users]
    counts_map = await _batch_descendant_counts(session, user_ids)
    items = [_to_agent_response(u, counts_map.get(u.id, 0)) for u in users]

    return AgentListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Create ──────────────────────────────────────────────────────────

@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    body: AgentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.create")),
):
    # Check uniqueness
    existing = await session.execute(
        select(AdminUser).where(
            or_(AdminUser.username == body.username, AdminUser.agent_code == body.agent_code)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or agent_code already exists")

    # Validate parent
    parent_depth = 0
    if body.parent_id:
        # Lock parent row to prevent race condition on max_sub_agents check
        parent_stmt = (
            select(AdminUser)
            .where(AdminUser.id == body.parent_id)
            .with_for_update()
        )
        parent = (await session.execute(parent_stmt)).scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent not found")
        if parent.depth >= 5:
            raise HTTPException(status_code=400, detail="Maximum tree depth (6 levels) exceeded")
        # Check sub-agent limit with locked parent
        children = await get_children(session, body.parent_id)
        if len(children) >= parent.max_sub_agents:
            raise HTTPException(status_code=400, detail="Parent max_sub_agents limit reached")
        parent_depth = parent.depth + 1

    user = AdminUser(
        username=body.username,
        password_hash=hash_password(body.password),
        email=body.email,
        role=body.role,
        parent_id=body.parent_id,
        depth=parent_depth,
        agent_code=body.agent_code,
        max_sub_agents=body.max_sub_agents,
        rolling_rate=body.rolling_rate,
        losing_rate=body.losing_rate,
        deposit_rate=body.deposit_rate,
        memo=body.memo,
    )
    session.add(user)
    await session.flush()  # Get user.id

    # Insert into closure table
    await insert_node(session, user.id, body.parent_id)

    # Assign role
    role_obj = await session.execute(select(Role).where(Role.name == body.role))
    role_row = role_obj.scalar_one_or_none()
    if role_row:
        session.add(AdminUserRole(admin_user_id=user.id, role_id=role_row.id))

    await session.commit()
    await session.refresh(user)

    return await _build_agent_response(session, user)


# ─── Get One ─────────────────────────────────────────────────────────

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.view")),
):
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")
    return await _build_agent_response(session, user)


# ─── Update ──────────────────────────────────────────────────────────

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: int,
    body: AgentUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    user.updated_at = datetime.now(timezone.utc)

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return await _build_agent_response(session, user)


# ─── Delete (soft: status → banned) ─────────────────────────────────

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.delete")),
):
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")
    if user.role == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete super_admin")

    user.status = "banned"
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()


# ─── Password Reset (by admin) ──────────────────────────────────────

@router.post("/{agent_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_agent_password(
    agent_id: int,
    body: PasswordResetRequest,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    user.password_hash = hash_password(body.new_password)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    return {"detail": "Password reset successfully"}


# ─── Tree: Descendants ───────────────────────────────────────────────

@router.get("/{agent_id}/tree", response_model=AgentTreeResponse)
async def get_agent_tree(
    agent_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.tree")),
):
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    nodes = await get_subtree_for_tree_view(session, agent_id)
    return AgentTreeResponse(nodes=nodes)


# ─── Tree: Ancestors ─────────────────────────────────────────────────

@router.get("/{agent_id}/ancestors")
async def get_agent_ancestors(
    agent_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.view")),
):
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    ancestors = await get_ancestors(session, agent_id)
    return [
        AgentAncestor(
            id=a["user"].id,
            username=a["user"].username,
            agent_code=a["user"].agent_code,
            role=a["user"].role,
            depth=a["depth"],
        )
        for a in ancestors
    ]


# ─── Tree: Children ──────────────────────────────────────────────────

@router.get("/{agent_id}/children")
async def get_agent_children(
    agent_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.view")),
):
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    children = await get_children(session, agent_id)
    child_ids = [c.id for c in children]
    counts_map = await _batch_descendant_counts(session, child_ids)
    return [_to_agent_response(c, counts_map.get(c.id, 0)) for c in children]


# ─── Tree: Move ──────────────────────────────────────────────────────

@router.post("/{agent_id}/move", status_code=status.HTTP_200_OK)
async def move_agent(
    agent_id: int,
    body: AgentMoveRequest,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    node = await session.get(AdminUser, agent_id)
    if not node:
        raise HTTPException(status_code=404, detail="Agent not found")

    new_parent = await session.get(AdminUser, body.new_parent_id)
    if not new_parent:
        raise HTTPException(status_code=400, detail="New parent not found")

    # Prevent circular reference
    if await is_ancestor(session, agent_id, body.new_parent_id):
        raise HTTPException(status_code=400, detail="Cannot move: would create circular reference")

    if agent_id == body.new_parent_id:
        raise HTTPException(status_code=400, detail="Cannot move agent under itself")

    await move_node(session, agent_id, body.new_parent_id)
    await session.commit()

    return {"detail": "Agent moved successfully"}


# ─── Commission Rates (Hierarchical) ─────────────────────────────

GAME_CATEGORIES = ["casino", "slot", "mini_game", "virtual_soccer", "sports", "esports", "holdem"]
COMMISSION_TYPES = ["rolling", "losing"]


@router.get("/{agent_id}/commission-rates", response_model=list[AgentCommissionRateResponse])
async def get_agent_commission_rates(
    agent_id: int,
    commission_type: str | None = Query(None, pattern=r"^(rolling|losing)$"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.view")),
):
    """Get all commission rates for an agent, grouped by game category and type."""
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    stmt = (
        select(AgentCommissionRate)
        .where(AgentCommissionRate.agent_id == agent_id)
    )
    if commission_type:
        stmt = stmt.where(AgentCommissionRate.commission_type == commission_type)

    stmt = stmt.order_by(AgentCommissionRate.game_category, AgentCommissionRate.commission_type)
    result = await session.execute(stmt)
    rates = result.scalars().all()

    return [
        AgentCommissionRateResponse(
            id=r.id,
            agent_id=r.agent_id,
            game_category=r.game_category,
            commission_type=r.commission_type,
            rate=r.rate,
            updated_at=r.updated_at,
            agent_username=user.username,
            agent_code=user.agent_code,
        )
        for r in rates
    ]


@router.put("/{agent_id}/commission-rates", response_model=AgentCommissionRateResponse)
async def set_agent_commission_rate(
    agent_id: int,
    body: AgentCommissionRateUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.update")),
):
    """Set a single commission rate for an agent.
    Validates: rate <= parent's rate for same category/type."""
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Validate against parent ceiling
    is_valid, error_msg = await validate_rate_against_parent(
        session, agent_id, body.game_category, body.commission_type, body.rate
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Validate against children floor
    is_valid, error_msg = await validate_rate_against_children(
        session, agent_id, body.game_category, body.commission_type, body.rate
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Upsert
    stmt = select(AgentCommissionRate).where(
        and_(
            AgentCommissionRate.agent_id == agent_id,
            AgentCommissionRate.game_category == body.game_category,
            AgentCommissionRate.commission_type == body.commission_type,
        )
    )
    result = await session.execute(stmt)
    rate_row = result.scalar_one_or_none()

    if rate_row:
        rate_row.rate = body.rate
        rate_row.updated_at = datetime.now(timezone.utc)
        rate_row.updated_by = current_user.id
    else:
        rate_row = AgentCommissionRate(
            agent_id=agent_id,
            game_category=body.game_category,
            commission_type=body.commission_type,
            rate=body.rate,
            updated_by=current_user.id,
        )
        session.add(rate_row)

    await session.commit()
    await session.refresh(rate_row)

    return AgentCommissionRateResponse(
        id=rate_row.id,
        agent_id=rate_row.agent_id,
        game_category=rate_row.game_category,
        commission_type=rate_row.commission_type,
        rate=rate_row.rate,
        updated_at=rate_row.updated_at,
        agent_username=user.username,
        agent_code=user.agent_code,
    )


@router.put("/{agent_id}/commission-rates/bulk", response_model=list[AgentCommissionRateResponse])
async def set_agent_commission_rates_bulk(
    agent_id: int,
    body: AgentCommissionRateBulkUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.update")),
):
    """Set multiple commission rates at once. All-or-nothing validation."""
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Validate all rates first
    for item in body.rates:
        is_valid, error_msg = await validate_rate_against_parent(
            session, agent_id, item.game_category, item.commission_type, item.rate
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        is_valid, error_msg = await validate_rate_against_children(
            session, agent_id, item.game_category, item.commission_type, item.rate
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

    # Apply all
    results = []
    for item in body.rates:
        stmt = select(AgentCommissionRate).where(
            and_(
                AgentCommissionRate.agent_id == agent_id,
                AgentCommissionRate.game_category == item.game_category,
                AgentCommissionRate.commission_type == item.commission_type,
            )
        )
        result = await session.execute(stmt)
        rate_row = result.scalar_one_or_none()

        if rate_row:
            rate_row.rate = item.rate
            rate_row.updated_at = datetime.now(timezone.utc)
            rate_row.updated_by = current_user.id
        else:
            rate_row = AgentCommissionRate(
                agent_id=agent_id,
                game_category=item.game_category,
                commission_type=item.commission_type,
                rate=item.rate,
                updated_by=current_user.id,
            )
            session.add(rate_row)

        await session.flush()
        await session.refresh(rate_row)
        results.append(rate_row)

    await session.commit()

    return [
        AgentCommissionRateResponse(
            id=r.id,
            agent_id=r.agent_id,
            game_category=r.game_category,
            commission_type=r.commission_type,
            rate=r.rate,
            updated_at=r.updated_at,
            agent_username=user.username,
            agent_code=user.agent_code,
        )
        for r in results
    ]


@router.get("/{agent_id}/sub-agent-rates")
async def get_sub_agent_rates(
    agent_id: int,
    game_category: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.view")),
):
    """Get commission rates for all direct children of an agent.
    Useful for viewing what rates the agent has assigned to sub-agents."""
    user = await session.get(AdminUser, agent_id)
    if not user:
        raise HTTPException(status_code=404, detail="Agent not found")

    children = await get_children(session, agent_id)
    if not children:
        return []

    child_ids = [c.id for c in children]
    stmt = (
        select(AgentCommissionRate, AdminUser.username, AdminUser.agent_code)
        .join(AdminUser, AdminUser.id == AgentCommissionRate.agent_id)
        .where(AgentCommissionRate.agent_id.in_(child_ids))
    )
    if game_category:
        stmt = stmt.where(AgentCommissionRate.game_category == game_category)

    stmt = stmt.order_by(AdminUser.agent_code, AgentCommissionRate.game_category)
    result = await session.execute(stmt)
    rows = result.all()

    return [
        AgentCommissionRateResponse(
            id=row[0].id,
            agent_id=row[0].agent_id,
            game_category=row[0].game_category,
            commission_type=row[0].commission_type,
            rate=row[0].rate,
            updated_at=row[0].updated_at,
            agent_username=row[1],
            agent_code=row[2],
        )
        for row in rows
    ]
