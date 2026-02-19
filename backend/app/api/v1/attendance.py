"""Attendance config management endpoints."""

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
from app.models.attendance_config import AttendanceConfig

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ─── Schemas ─────────────────────────────────────────────────────────

class AttendanceConfigCreate(BaseModel):
    day_number: int = PydanticField(ge=1, le=30)
    reward_amount: Decimal = PydanticField(ge=0)
    reward_type: str = PydanticField(pattern=r"^(cash|bonus|point)$")
    is_active: bool = True


class AttendanceConfigUpdate(BaseModel):
    day_number: int | None = PydanticField(default=None, ge=1, le=30)
    reward_amount: Decimal | None = PydanticField(default=None, ge=0)
    reward_type: str | None = PydanticField(default=None, pattern=r"^(cash|bonus|point)$")
    is_active: bool | None = None


class AttendanceConfigResponse(BaseModel):
    id: int
    day_number: int
    reward_amount: Decimal
    reward_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AttendanceConfigListResponse(BaseModel):
    items: list[AttendanceConfigResponse]
    total: int
    page: int
    page_size: int


# ─── List Configs ────────────────────────────────────────────────────

@router.get("/configs", response_model=AttendanceConfigListResponse)
async def list_attendance_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("attendance.view")),
):
    base = select(AttendanceConfig)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(AttendanceConfig.day_number).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    configs = result.scalars().all()

    items = [AttendanceConfigResponse.model_validate(c) for c in configs]
    return AttendanceConfigListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Get Config ──────────────────────────────────────────────────────

@router.get("/configs/{config_id}", response_model=AttendanceConfigResponse)
async def get_attendance_config(
    config_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("attendance.view")),
):
    config = await session.get(AttendanceConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Attendance config not found")

    return AttendanceConfigResponse.model_validate(config)


# ─── Create Config ───────────────────────────────────────────────────

@router.post("/configs", response_model=AttendanceConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_config(
    body: AttendanceConfigCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("attendance.manage")),
):
    existing_stmt = select(AttendanceConfig).where(AttendanceConfig.day_number == body.day_number)
    if (await session.execute(existing_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Day {body.day_number} config already exists")

    config = AttendanceConfig(
        day_number=body.day_number,
        reward_amount=body.reward_amount,
        reward_type=body.reward_type,
        is_active=body.is_active,
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)

    return AttendanceConfigResponse.model_validate(config)


# ─── Update Config ───────────────────────────────────────────────────

@router.put("/configs/{config_id}", response_model=AttendanceConfigResponse)
async def update_attendance_config(
    config_id: int,
    body: AttendanceConfigUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("attendance.manage")),
):
    config = await session.get(AttendanceConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Attendance config not found")

    update_data = body.model_dump(exclude_unset=True)

    if "day_number" in update_data and update_data["day_number"] != config.day_number:
        dup_stmt = select(AttendanceConfig).where(
            AttendanceConfig.day_number == update_data["day_number"],
            AttendanceConfig.id != config_id,
        )
        if (await session.execute(dup_stmt)).scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Day {update_data['day_number']} config already exists")

    for field, value in update_data.items():
        setattr(config, field, value)
    config.updated_at = datetime.now(timezone.utc)

    session.add(config)
    await session.commit()
    await session.refresh(config)

    return AttendanceConfigResponse.model_validate(config)
