"""Payback config management endpoints."""

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
from app.models.payback_config import PaybackConfig

router = APIRouter(prefix="/payback", tags=["payback"])


# ─── Schemas ─────────────────────────────────────────────────────────

class PaybackConfigCreate(BaseModel):
    name: str = PydanticField(max_length=100)
    payback_percent: Decimal = PydanticField(ge=0, le=100)
    payback_type: str = PydanticField(default="cash", pattern=r"^(cash|bonus|point)$")
    period: str = PydanticField(default="daily", pattern=r"^(daily|weekly|monthly)$")
    min_loss_amount: Decimal = PydanticField(default=Decimal("0"), ge=0)
    max_payback_amount: Decimal = PydanticField(default=Decimal("0"), ge=0)
    is_active: bool = True


class PaybackConfigUpdate(BaseModel):
    name: str | None = PydanticField(default=None, max_length=100)
    payback_percent: Decimal | None = PydanticField(default=None, ge=0, le=100)
    payback_type: str | None = PydanticField(default=None, pattern=r"^(cash|bonus|point)$")
    period: str | None = PydanticField(default=None, pattern=r"^(daily|weekly|monthly)$")
    min_loss_amount: Decimal | None = PydanticField(default=None, ge=0)
    max_payback_amount: Decimal | None = PydanticField(default=None, ge=0)
    is_active: bool | None = None


class PaybackConfigResponse(BaseModel):
    id: int
    name: str
    payback_percent: Decimal
    payback_type: str
    period: str
    min_loss_amount: Decimal
    max_payback_amount: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaybackConfigListResponse(BaseModel):
    items: list[PaybackConfigResponse]
    total: int
    page: int
    page_size: int


# ─── List Configs ────────────────────────────────────────────────────

@router.get("/configs", response_model=PaybackConfigListResponse)
async def list_payback_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    period: str | None = Query(None),
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("payback.view")),
):
    base = select(PaybackConfig)
    if period is not None:
        base = base.where(PaybackConfig.period == period)
    if is_active is not None:
        base = base.where(PaybackConfig.is_active == is_active)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(PaybackConfig.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    configs = result.scalars().all()

    items = [PaybackConfigResponse.model_validate(c) for c in configs]
    return PaybackConfigListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Get Config ──────────────────────────────────────────────────────

@router.get("/configs/{config_id}", response_model=PaybackConfigResponse)
async def get_payback_config(
    config_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("payback.view")),
):
    config = await session.get(PaybackConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Payback config not found")

    return PaybackConfigResponse.model_validate(config)


# ─── Create Config ───────────────────────────────────────────────────

@router.post("/configs", response_model=PaybackConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_payback_config(
    body: PaybackConfigCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("payback.manage")),
):
    config = PaybackConfig(
        name=body.name,
        payback_percent=body.payback_percent,
        payback_type=body.payback_type,
        period=body.period,
        min_loss_amount=body.min_loss_amount,
        max_payback_amount=body.max_payback_amount,
        is_active=body.is_active,
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)

    return PaybackConfigResponse.model_validate(config)


# ─── Update Config ───────────────────────────────────────────────────

@router.put("/configs/{config_id}", response_model=PaybackConfigResponse)
async def update_payback_config(
    config_id: int,
    body: PaybackConfigUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("payback.manage")),
):
    config = await session.get(PaybackConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Payback config not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    config.updated_at = datetime.now(timezone.utc)

    session.add(config)
    await session.commit()
    await session.refresh(config)

    return PaybackConfigResponse.model_validate(config)
