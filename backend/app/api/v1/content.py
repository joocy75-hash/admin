"""Announcement (notice/popup/banner) management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.setting import Announcement
from app.schemas.content import (
    AnnouncementCreate,
    AnnouncementListResponse,
    AnnouncementResponse,
    AnnouncementUpdate,
)

router = APIRouter(prefix="/content", tags=["content"])


# ─── List Announcements ───────────────────────────────────────────

@router.get("/announcements", response_model=AnnouncementListResponse)
async def list_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    target: str | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None, max_length=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("announcement.view")),
):
    base = select(Announcement)

    if type_filter:
        base = base.where(Announcement.type == type_filter)
    if target:
        base = base.where(Announcement.target == target)
    if is_active is not None:
        base = base.where(Announcement.is_active == is_active)
    if search:
        base = base.where(
            or_(
                Announcement.title.ilike(f"%{search}%"),
                Announcement.content.ilike(f"%{search}%"),
            )
        )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Announcement.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    announcements = result.scalars().all()

    items = [
        AnnouncementResponse(
            id=a.id,
            type=a.type,
            title=a.title,
            content=a.content,
            target=a.target,
            is_active=a.is_active,
            starts_at=a.starts_at,
            ends_at=a.ends_at,
            created_by=a.created_by,
            created_at=a.created_at,
        )
        for a in announcements
    ]
    return AnnouncementListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Create Announcement ──────────────────────────────────────────

@router.post("/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    body: AnnouncementCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("announcement.create")),
):
    announcement = Announcement(
        **body.model_dump(),
        created_by=current_user.id,
    )
    session.add(announcement)
    await session.commit()
    await session.refresh(announcement)
    return AnnouncementResponse(
        id=announcement.id,
        type=announcement.type,
        title=announcement.title,
        content=announcement.content,
        target=announcement.target,
        is_active=announcement.is_active,
        starts_at=announcement.starts_at,
        ends_at=announcement.ends_at,
        created_by=announcement.created_by,
        created_at=announcement.created_at,
    )


# ─── Get Announcement ─────────────────────────────────────────────

@router.get("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("announcement.view")),
):
    announcement = await session.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return AnnouncementResponse(
        id=announcement.id,
        type=announcement.type,
        title=announcement.title,
        content=announcement.content,
        target=announcement.target,
        is_active=announcement.is_active,
        starts_at=announcement.starts_at,
        ends_at=announcement.ends_at,
        created_by=announcement.created_by,
        created_at=announcement.created_at,
    )


# ─── Update Announcement ──────────────────────────────────────────

@router.put("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: int,
    body: AnnouncementUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("announcement.update")),
):
    announcement = await session.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(announcement, field, value)

    session.add(announcement)
    await session.commit()
    await session.refresh(announcement)
    return AnnouncementResponse(
        id=announcement.id,
        type=announcement.type,
        title=announcement.title,
        content=announcement.content,
        target=announcement.target,
        is_active=announcement.is_active,
        starts_at=announcement.starts_at,
        ends_at=announcement.ends_at,
        created_by=announcement.created_by,
        created_at=announcement.created_at,
    )


# ─── Delete Announcement (soft) ───────────────────────────────────

@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("announcement.delete")),
):
    announcement = await session.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    announcement.is_active = False
    session.add(announcement)
    await session.commit()
