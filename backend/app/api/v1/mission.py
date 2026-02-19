from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from pydantic import Field as PydanticField
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.mission import Mission

router = APIRouter(prefix="/missions", tags=["missions"])


# ─── Schemas ─────────────────────────────────────────────────────

class MissionCreate(BaseModel):
    name: str = PydanticField(max_length=200)
    description: str | None = None
    rules: str | None = None
    type: str = PydanticField(default="daily", pattern="^(daily|weekly|monthly|special)$")
    bonus_amount: Decimal = PydanticField(default=Decimal("0"), ge=0)
    max_participants: int = PydanticField(default=0, ge=0)
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class MissionUpdate(BaseModel):
    name: str | None = PydanticField(default=None, max_length=200)
    description: str | None = None
    rules: str | None = None
    type: str | None = PydanticField(default=None, pattern="^(daily|weekly|monthly|special)$")
    bonus_amount: Decimal | None = PydanticField(default=None, ge=0)
    max_participants: int | None = PydanticField(default=None, ge=0)
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class MissionResponse(BaseModel):
    id: int
    name: str
    description: str | None
    rules: str | None
    type: str
    bonus_amount: Decimal
    max_participants: int
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MissionListResponse(BaseModel):
    items: list[MissionResponse]
    total: int
    page: int
    page_size: int


# ─── List Missions ───────────────────────────────────────────────

@router.get("", response_model=MissionListResponse)
async def list_missions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("mission.view")),
):
    base = select(Mission)
    if type_filter:
        base = base.where(Mission.type == type_filter)
    if is_active is not None:
        base = base.where(Mission.is_active == is_active)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Mission.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    missions = result.scalars().all()

    return MissionListResponse(items=missions, total=total, page=page, page_size=page_size)


# ─── Get Mission ─────────────────────────────────────────────────

@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(
    mission_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("mission.view")),
):
    mission = await session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


# ─── Create Mission ──────────────────────────────────────────────

@router.post("", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(
    body: MissionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("mission.manage")),
):
    if body.starts_at and body.ends_at and body.starts_at >= body.ends_at:
        raise HTTPException(status_code=400, detail="starts_at must be before ends_at")

    mission = Mission(**body.model_dump())
    session.add(mission)
    await session.commit()
    await session.refresh(mission)
    return mission


# ─── Update Mission ──────────────────────────────────────────────

@router.put("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: int,
    body: MissionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("mission.manage")),
):
    mission = await session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    update_data = body.model_dump(exclude_unset=True)

    new_starts = update_data.get("starts_at", mission.starts_at)
    new_ends = update_data.get("ends_at", mission.ends_at)
    if new_starts and new_ends and new_starts >= new_ends:
        raise HTTPException(status_code=400, detail="starts_at must be before ends_at")

    for field, value in update_data.items():
        setattr(mission, field, value)

    mission.updated_at = datetime.now(timezone.utc)
    session.add(mission)
    await session.commit()
    await session.refresh(mission)
    return mission


# ─── Delete Mission (soft) ───────────────────────────────────────

@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mission(
    mission_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("mission.manage")),
):
    mission = await session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission.is_active = False
    mission.updated_at = datetime.now(timezone.utc)
    session.add(mission)
    await session.commit()
