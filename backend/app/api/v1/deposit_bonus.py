"""Deposit bonus config management endpoints."""

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
from app.models.deposit_bonus_config import DepositBonusConfig

router = APIRouter(prefix="/deposit-bonus", tags=["deposit-bonus"])


# ─── Schemas ─────────────────────────────────────────────────────────

class DepositBonusCreate(BaseModel):
    type: str = PydanticField(pattern=r"^(first_deposit|every_deposit)$")
    bonus_percent: Decimal = PydanticField(ge=0, le=100)
    max_bonus_amount: Decimal = PydanticField(ge=0)
    min_deposit_amount: Decimal = PydanticField(ge=0)
    rollover_multiplier: int = PydanticField(default=1, ge=1)
    is_active: bool = True


class DepositBonusUpdate(BaseModel):
    type: str | None = PydanticField(default=None, pattern=r"^(first_deposit|every_deposit)$")
    bonus_percent: Decimal | None = PydanticField(default=None, ge=0, le=100)
    max_bonus_amount: Decimal | None = PydanticField(default=None, ge=0)
    min_deposit_amount: Decimal | None = PydanticField(default=None, ge=0)
    rollover_multiplier: int | None = PydanticField(default=None, ge=1)
    is_active: bool | None = None


class DepositBonusResponse(BaseModel):
    id: int
    type: str
    bonus_percent: Decimal
    max_bonus_amount: Decimal
    min_deposit_amount: Decimal
    rollover_multiplier: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DepositBonusListResponse(BaseModel):
    items: list[DepositBonusResponse]
    total: int
    page: int
    page_size: int


# ─── List Configs ────────────────────────────────────────────────────

@router.get("/configs", response_model=DepositBonusListResponse)
async def list_deposit_bonus_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("deposit_bonus.view")),
):
    base = select(DepositBonusConfig)
    if type_filter is not None:
        base = base.where(DepositBonusConfig.type == type_filter)
    if is_active is not None:
        base = base.where(DepositBonusConfig.is_active == is_active)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(DepositBonusConfig.type, DepositBonusConfig.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    configs = result.scalars().all()

    items = [DepositBonusResponse.model_validate(c) for c in configs]
    return DepositBonusListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Get Config ──────────────────────────────────────────────────────

@router.get("/configs/{config_id}", response_model=DepositBonusResponse)
async def get_deposit_bonus_config(
    config_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("deposit_bonus.view")),
):
    config = await session.get(DepositBonusConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Deposit bonus config not found")

    return DepositBonusResponse.model_validate(config)


# ─── Create Config ───────────────────────────────────────────────────

@router.post("/configs", response_model=DepositBonusResponse, status_code=status.HTTP_201_CREATED)
async def create_deposit_bonus_config(
    body: DepositBonusCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("deposit_bonus.manage")),
):
    config = DepositBonusConfig(
        type=body.type,
        bonus_percent=body.bonus_percent,
        max_bonus_amount=body.max_bonus_amount,
        min_deposit_amount=body.min_deposit_amount,
        rollover_multiplier=body.rollover_multiplier,
        is_active=body.is_active,
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)

    return DepositBonusResponse.model_validate(config)


# ─── Update Config ───────────────────────────────────────────────────

@router.put("/configs/{config_id}", response_model=DepositBonusResponse)
async def update_deposit_bonus_config(
    config_id: int,
    body: DepositBonusUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("deposit_bonus.manage")),
):
    config = await session.get(DepositBonusConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Deposit bonus config not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    config.updated_at = datetime.now(timezone.utc)

    session.add(config)
    await session.commit()
    await session.refresh(config)

    return DepositBonusResponse.model_validate(config)
