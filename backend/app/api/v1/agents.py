"""Agent CRUD and tree management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker, get_current_user
from app.models.admin_user import AdminUser, AdminUserTree
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
from app.utils.security import hash_password

router = APIRouter(prefix="/agents", tags=["agents"])


async def _build_agent_response(session: AsyncSession, user: AdminUser) -> AgentResponse:
    children_count = await get_descendant_count(session, user.id)
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

    items = []
    for u in users:
        items.append(await _build_agent_response(session, u))

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
        parent = await session.get(AdminUser, body.parent_id)
        if not parent:
            raise HTTPException(status_code=400, detail="Parent not found")
        if parent.depth >= 5:
            raise HTTPException(status_code=400, detail="Maximum tree depth (6 levels) exceeded")
        # Check sub-agent limit
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
    user.updated_at = datetime.utcnow()

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
    user.updated_at = datetime.utcnow()
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
    user.updated_at = datetime.utcnow()
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
    items = []
    for c in children:
        items.append(await _build_agent_response(session, c))
    return items


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
