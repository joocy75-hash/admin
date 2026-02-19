from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from pydantic import Field as PydanticField
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.popup_notice import PopupNotice

router = APIRouter(prefix="/popups", tags=["popups"])


# ─── Schemas ─────────────────────────────────────────────────────

class PopupCreate(BaseModel):
    title: str = PydanticField(max_length=200)
    content: str | None = None
    image_url: str | None = PydanticField(default=None, max_length=500, pattern=r"^https?://")
    display_type: str = PydanticField(default="always", pattern="^(once|always|once_per_day)$")
    target: str = PydanticField(default="all", pattern="^(all|new_user|vip)$")
    priority: int = PydanticField(default=0, ge=0, le=9999)
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PopupUpdate(BaseModel):
    title: str | None = PydanticField(default=None, max_length=200)
    content: str | None = None
    image_url: str | None = PydanticField(default=None, max_length=500, pattern=r"^https?://")
    display_type: str | None = PydanticField(default=None, pattern="^(once|always|once_per_day)$")
    target: str | None = PydanticField(default=None, pattern="^(all|new_user|vip)$")
    priority: int | None = PydanticField(default=None, ge=0, le=9999)
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PopupResponse(BaseModel):
    id: int
    title: str
    content: str | None
    image_url: str | None
    display_type: str
    target: str
    priority: int
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PopupListResponse(BaseModel):
    items: list[PopupResponse]
    total: int
    page: int
    page_size: int


# ─── List Popups ─────────────────────────────────────────────────

@router.get("", response_model=PopupListResponse)
async def list_popups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: bool | None = Query(None),
    target: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("popup.view")),
):
    base = select(PopupNotice)
    if is_active is not None:
        base = base.where(PopupNotice.is_active == is_active)
    if target:
        base = base.where(PopupNotice.target == target)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(
        PopupNotice.priority.desc(), PopupNotice.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    popups = result.scalars().all()

    return PopupListResponse(items=popups, total=total, page=page, page_size=page_size)


# ─── Get Popup ───────────────────────────────────────────────────

@router.get("/{popup_id}", response_model=PopupResponse)
async def get_popup(
    popup_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("popup.view")),
):
    popup = await session.get(PopupNotice, popup_id)
    if not popup:
        raise HTTPException(status_code=404, detail="Popup not found")
    return popup


# ─── Create Popup ────────────────────────────────────────────────

@router.post("", response_model=PopupResponse, status_code=status.HTTP_201_CREATED)
async def create_popup(
    body: PopupCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("popup.manage")),
):
    if body.starts_at and body.ends_at and body.starts_at >= body.ends_at:
        raise HTTPException(status_code=400, detail="starts_at must be before ends_at")

    popup = PopupNotice(**body.model_dump())
    session.add(popup)
    await session.commit()
    await session.refresh(popup)
    return popup


# ─── Update Popup ────────────────────────────────────────────────

@router.put("/{popup_id}", response_model=PopupResponse)
async def update_popup(
    popup_id: int,
    body: PopupUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("popup.manage")),
):
    popup = await session.get(PopupNotice, popup_id)
    if not popup:
        raise HTTPException(status_code=404, detail="Popup not found")

    update_data = body.model_dump(exclude_unset=True)

    new_starts = update_data.get("starts_at", popup.starts_at)
    new_ends = update_data.get("ends_at", popup.ends_at)
    if new_starts and new_ends and new_starts >= new_ends:
        raise HTTPException(status_code=400, detail="starts_at must be before ends_at")

    for field, value in update_data.items():
        setattr(popup, field, value)

    popup.updated_at = datetime.now(timezone.utc)
    session.add(popup)
    await session.commit()
    await session.refresh(popup)
    return popup


# ─── Delete Popup (soft) ─────────────────────────────────────────

@router.delete("/{popup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_popup(
    popup_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("popup.manage")),
):
    popup = await session.get(PopupNotice, popup_id)
    if not popup:
        raise HTTPException(status_code=404, detail="Popup not found")

    popup.is_active = False
    popup.updated_at = datetime.now(timezone.utc)
    session.add(popup)
    await session.commit()
