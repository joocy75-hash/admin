"""Spin config management endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from pydantic import Field as PydanticField
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.spin_config import SpinConfig

router = APIRouter(prefix="/spin", tags=["spin"])


# ─── Schemas ─────────────────────────────────────────────────────────

class SpinPrize(BaseModel):
    label: str = PydanticField(max_length=50)
    value: int | float = PydanticField(ge=0)
    type: str = PydanticField(pattern=r"^(cash|bonus|point|nothing)$")
    probability: int | float = PydanticField(ge=0, le=100)


def _validate_prizes(prizes: list[SpinPrize]) -> list[SpinPrize]:
    if len(prizes) < 2:
        raise ValueError("At least 2 prizes required")
    total_prob = sum(p.probability for p in prizes)
    if abs(total_prob - 100) > 0.01:
        raise ValueError(f"Prize probabilities must sum to 100 (got {total_prob})")
    return prizes


class SpinConfigCreate(BaseModel):
    name: str = PydanticField(max_length=100)
    prizes: list[SpinPrize] = PydanticField(default=[
        {"label": "꽝", "value": 0, "type": "nothing", "probability": 70},
        {"label": "보너스", "value": 1000, "type": "bonus", "probability": 30},
    ])
    max_spins_daily: int = PydanticField(default=1, ge=1)
    is_active: bool = True

    @field_validator("prizes")
    @classmethod
    def check_prizes(cls, v: list[SpinPrize]) -> list[SpinPrize]:
        return _validate_prizes(v)


class SpinConfigUpdate(BaseModel):
    name: str | None = PydanticField(default=None, max_length=100)
    prizes: list[SpinPrize] | None = None
    max_spins_daily: int | None = PydanticField(default=None, ge=1)
    is_active: bool | None = None

    @field_validator("prizes")
    @classmethod
    def check_prizes(cls, v: list[SpinPrize] | None) -> list[SpinPrize] | None:
        if v is not None:
            return _validate_prizes(v)
        return v


class SpinConfigResponse(BaseModel):
    id: int
    name: str
    prizes: list
    max_spins_daily: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SpinConfigListResponse(BaseModel):
    items: list[SpinConfigResponse]
    total: int
    page: int
    page_size: int


# ─── List Configs ────────────────────────────────────────────────────

@router.get("/configs", response_model=SpinConfigListResponse)
async def list_spin_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("spin.view")),
):
    base = select(SpinConfig)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(SpinConfig.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    configs = result.scalars().all()

    items = [SpinConfigResponse.model_validate(c) for c in configs]
    return SpinConfigListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Get Config ──────────────────────────────────────────────────────

@router.get("/configs/{config_id}", response_model=SpinConfigResponse)
async def get_spin_config(
    config_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("spin.view")),
):
    config = await session.get(SpinConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Spin config not found")

    return SpinConfigResponse.model_validate(config)


# ─── Create Config ───────────────────────────────────────────────────

@router.post("/configs", response_model=SpinConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_spin_config(
    body: SpinConfigCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("spin.manage")),
):
    config = SpinConfig(
        name=body.name,
        prizes=[p.model_dump() for p in body.prizes],
        max_spins_daily=body.max_spins_daily,
        is_active=body.is_active,
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)

    return SpinConfigResponse.model_validate(config)


# ─── Update Config ───────────────────────────────────────────────────

@router.put("/configs/{config_id}", response_model=SpinConfigResponse)
async def update_spin_config(
    config_id: int,
    body: SpinConfigUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("spin.manage")),
):
    config = await session.get(SpinConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Spin config not found")

    update_data = body.model_dump(exclude_unset=True)
    if "prizes" in update_data and update_data["prizes"] is not None:
        update_data["prizes"] = [p if isinstance(p, dict) else p.model_dump() for p in update_data["prizes"]]
    for field, value in update_data.items():
        setattr(config, field, value)
    config.updated_at = datetime.now(timezone.utc)

    session.add(config)
    await session.commit()
    await session.refresh(config)

    return SpinConfigResponse.model_validate(config)
