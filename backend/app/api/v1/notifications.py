"""Notification management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.notification import AdminNotification
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── List Notifications ──────────────────────────────────────────

@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    is_read: bool | None = Query(None),
    priority: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("notification.view")),
):
    base = select(AdminNotification).where(
        AdminNotification.admin_user_id == current_user.id
    )

    if type_filter:
        base = base.where(AdminNotification.type == type_filter)
    if is_read is not None:
        base = base.where(AdminNotification.is_read == is_read)
    if priority:
        base = base.where(AdminNotification.priority == priority)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(AdminNotification.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    notifications = result.scalars().all()

    items = [NotificationResponse.model_validate(n) for n in notifications]
    return NotificationListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Unread Count ────────────────────────────────────────────────

@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("notification.view")),
):
    stmt = select(func.count()).where(
        AdminNotification.admin_user_id == current_user.id,
        AdminNotification.is_read == False,  # noqa: E712
    )
    count = (await session.execute(stmt)).scalar() or 0
    return UnreadCountResponse(count=count)


# ─── Mark as Read ────────────────────────────────────────────────

@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("notification.view")),
):
    notification = await session.get(AdminNotification, notification_id)
    if not notification or notification.admin_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    session.add(notification)
    await session.commit()
    await session.refresh(notification)
    return NotificationResponse.model_validate(notification)


# ─── Mark All as Read ────────────────────────────────────────────

@router.post("/read-all")
async def mark_all_as_read(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("notification.view")),
) -> dict:
    from sqlalchemy import update

    stmt = (
        update(AdminNotification)
        .where(
            AdminNotification.admin_user_id == current_user.id,
            AdminNotification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    result = await session.execute(stmt)
    await session.commit()
    return {"updated": result.rowcount}


# ─── Delete Notification ─────────────────────────────────────────

@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("notification.view")),
):
    notification = await session.get(AdminNotification, notification_id)
    if not notification or notification.admin_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    await session.delete(notification)
    await session.commit()
