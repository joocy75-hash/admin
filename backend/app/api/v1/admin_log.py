from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_login_log import AdminLoginLog
from app.models.admin_user import AdminUser

router = APIRouter(prefix="/admin-logs", tags=["admin-logs"])


# ─── Schemas ─────────────────────────────────────────────────────

class AdminLoginLogResponse(BaseModel):
    id: int
    admin_user_id: int
    admin_username: str | None = None
    ip_address: str | None
    user_agent: str | None
    device: str | None
    os: str | None
    browser: str | None
    logged_in_at: datetime

    model_config = {"from_attributes": True}


class AdminLoginLogListResponse(BaseModel):
    items: list[AdminLoginLogResponse]
    total: int
    page: int
    page_size: int


# ─── Helpers ─────────────────────────────────────────────────────

async def _batch_admin_usernames(
    session: AsyncSession, logs: list[AdminLoginLog]
) -> dict[int, str]:
    admin_ids = {log.admin_user_id for log in logs if log.admin_user_id}
    if not admin_ids:
        return {}
    result = await session.execute(
        select(AdminUser.id, AdminUser.username).where(AdminUser.id.in_(admin_ids))
    )
    return {row[0]: row[1] for row in result.all()}


# ─── List Admin Login Logs ───────────────────────────────────────

@router.get("", response_model=AdminLoginLogListResponse)
async def list_admin_login_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin_user_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("audit_log.view")),
):
    base = select(AdminLoginLog)
    if admin_user_id is not None:
        base = base.where(AdminLoginLog.admin_user_id == admin_user_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(AdminLoginLog.logged_in_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    logs = result.scalars().all()

    username_map = await _batch_admin_usernames(session, logs)

    items = [
        AdminLoginLogResponse(
            id=log.id,
            admin_user_id=log.admin_user_id,
            admin_username=username_map.get(log.admin_user_id),
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            device=log.device,
            os=log.os,
            browser=log.browser,
            logged_in_at=log.logged_in_at,
        )
        for log in logs
    ]

    return AdminLoginLogListResponse(
        items=items, total=total, page=page, page_size=page_size
    )
