"""Role and permission management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.role import Permission, Role, RolePermission
from app.schemas.role import (
    PermissionGroupResponse,
    PermissionResponse,
    RoleCreate,
    RoleListResponse,
    RolePermissionUpdate,
    RoleResponse,
    RoleUpdate,
)

router = APIRouter(prefix="/roles", tags=["roles"])


async def _build_role_response(session: AsyncSession, role: Role) -> RoleResponse:
    stmt = (
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role.id)
        .order_by(Permission.module, Permission.name)
    )
    result = await session.execute(stmt)
    permissions = result.scalars().all()

    return RoleResponse(
        id=role.id,
        name=role.name,
        guard=role.guard,
        description=role.description,
        is_system=role.is_system,
        permissions=[
            PermissionResponse(
                id=p.id,
                name=p.name,
                module=p.module,
                description=p.description,
            )
            for p in permissions
        ],
        created_at=role.created_at,
    )


# ─── List Roles ───────────────────────────────────────────────────

@router.get("", response_model=RoleListResponse)
async def list_roles(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("role.view")),
):
    result = await session.execute(
        select(Role).order_by(Role.is_system.desc(), Role.name)
    )
    roles = result.scalars().all()

    items = [await _build_role_response(session, r) for r in roles]
    return RoleListResponse(items=items, total=len(items))


# ─── Create Role ──────────────────────────────────────────────────

@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    body: RoleCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("role.create")),
):
    existing = await session.execute(
        select(Role).where(Role.name == body.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role name already exists")

    role = Role(name=body.name, description=body.description)
    session.add(role)
    await session.commit()
    await session.refresh(role)
    return await _build_role_response(session, role)


# ─── Get Role ─────────────────────────────────────────────────────

@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("role.view")),
):
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return await _build_role_response(session, role)


# ─── Update Role ──────────────────────────────────────────────────

@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    body: RoleUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("role.update")),
):
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot modify system role")

    update_data = body.model_dump(exclude_unset=True)
    if "name" in update_data:
        existing = await session.execute(
            select(Role).where(Role.name == update_data["name"], Role.id != role_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Role name already exists")

    for field, value in update_data.items():
        setattr(role, field, value)

    session.add(role)
    await session.commit()
    await session.refresh(role)
    return await _build_role_response(session, role)


# ─── Delete Role ──────────────────────────────────────────────────

@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("role.delete")),
):
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system role")

    # Remove role-permission mappings first
    await session.execute(
        delete(RolePermission).where(RolePermission.role_id == role_id)
    )
    await session.delete(role)
    await session.commit()


# ─── Assign Permissions to Role ───────────────────────────────────

@router.put("/{role_id}/permissions", response_model=RoleResponse)
async def assign_permissions(
    role_id: int,
    body: RolePermissionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("role.update")),
):
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Validate all permission_ids exist
    if body.permission_ids:
        existing_count = (await session.execute(
            select(func.count()).where(Permission.id.in_(body.permission_ids))
        )).scalar() or 0
        if existing_count != len(body.permission_ids):
            raise HTTPException(status_code=400, detail="Some permission IDs are invalid")

    # Clear existing and reassign
    await session.execute(
        delete(RolePermission).where(RolePermission.role_id == role_id)
    )
    for perm_id in body.permission_ids:
        session.add(RolePermission(role_id=role_id, permission_id=perm_id))

    await session.commit()
    await session.refresh(role)
    return await _build_role_response(session, role)


# ─── List All Permissions (grouped by module) ─────────────────────

@router.get("/permissions/all", response_model=list[PermissionGroupResponse])
async def list_permissions(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("role.view")),
):
    result = await session.execute(
        select(Permission).order_by(Permission.module, Permission.name)
    )
    permissions = result.scalars().all()

    # Group by module
    groups: dict[str, list[PermissionResponse]] = {}
    for p in permissions:
        if p.module not in groups:
            groups[p.module] = []
        groups[p.module].append(
            PermissionResponse(
                id=p.id,
                name=p.name,
                module=p.module,
                description=p.description,
            )
        )

    return [
        PermissionGroupResponse(module=module, permissions=perms)
        for module, perms in groups.items()
    ]
