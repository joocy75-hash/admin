"""Shared API dependencies: auth, permission checks, DB session."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.role import AdminUserRole, Permission, RolePermission
from app.utils.security import decode_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> AdminUser:
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = await session.get(AdminUser, int(user_id))
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


async def get_user_permissions(
    user: AdminUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    stmt = (
        select(Permission.name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(AdminUserRole, AdminUserRole.role_id == RolePermission.role_id)
        .where(AdminUserRole.admin_user_id == user.id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


class PermissionChecker:
    """Dependency that checks if the current user has a specific permission."""

    def __init__(self, required: str):
        self.required = required

    async def __call__(
        self,
        user: AdminUser = Depends(get_current_user),
        permissions: list[str] = Depends(get_user_permissions),
    ) -> AdminUser:
        # super_admin bypasses all permission checks
        if user.role == "super_admin":
            return user
        if self.required not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {self.required}",
            )
        return user
