from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from pydantic import Field as PydanticField
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.exchange_rate import ExchangeRate

router = APIRouter(prefix="/exchange-rates", tags=["exchange-rates"])


# ─── Schemas ─────────────────────────────────────────────────────

class ExchangeRateCreate(BaseModel):
    pair: str = PydanticField(max_length=20)
    rate: Decimal = PydanticField(ge=0)
    source: str | None = PydanticField(default=None, max_length=50)
    is_active: bool = True


class ExchangeRateUpdate(BaseModel):
    pair: str | None = PydanticField(default=None, max_length=20)
    rate: Decimal | None = PydanticField(default=None, ge=0)
    source: str | None = PydanticField(default=None, max_length=50)
    is_active: bool | None = None


class ExchangeRateResponse(BaseModel):
    id: int
    pair: str
    rate: Decimal
    source: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── List Exchange Rates ─────────────────────────────────────────

@router.get("", response_model=list[ExchangeRateResponse])
async def list_exchange_rates(
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    base = select(ExchangeRate)
    if is_active is not None:
        base = base.where(ExchangeRate.is_active == is_active)

    stmt = base.order_by(ExchangeRate.pair)
    result = await session.execute(stmt)
    rates = result.scalars().all()
    return rates


# ─── Get Exchange Rate ───────────────────────────────────────────

@router.get("/{rate_id}", response_model=ExchangeRateResponse)
async def get_exchange_rate(
    rate_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    rate = await session.get(ExchangeRate, rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="Exchange rate not found")
    return rate


# ─── Create Exchange Rate ────────────────────────────────────────

@router.post("", response_model=ExchangeRateResponse, status_code=status.HTTP_201_CREATED)
async def create_exchange_rate(
    body: ExchangeRateCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    existing = await session.execute(
        select(ExchangeRate).where(ExchangeRate.pair == body.pair)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f'Exchange rate pair "{body.pair}" already exists')

    rate = ExchangeRate(**body.model_dump())
    session.add(rate)
    await session.commit()
    await session.refresh(rate)
    return rate


# ─── Update Exchange Rate ────────────────────────────────────────

@router.put("/{rate_id}", response_model=ExchangeRateResponse)
async def update_exchange_rate(
    rate_id: int,
    body: ExchangeRateUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    rate = await session.get(ExchangeRate, rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="Exchange rate not found")

    update_data = body.model_dump(exclude_unset=True)

    if "pair" in update_data:
        existing = await session.execute(
            select(ExchangeRate).where(
                ExchangeRate.pair == update_data["pair"],
                ExchangeRate.id != rate_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f'Exchange rate pair "{update_data["pair"]}" already exists')

    for field, value in update_data.items():
        setattr(rate, field, value)

    rate.updated_at = datetime.now(timezone.utc)
    session.add(rate)
    await session.commit()
    await session.refresh(rate)
    return rate
