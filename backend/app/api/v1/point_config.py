"""Point config key-value management endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pydantic import Field as PydanticField
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.point_config import PointConfig

router = APIRouter(prefix="/point-config", tags=["point-config"])


# ─── Schemas ─────────────────────────────────────────────────────────

class PointConfigUpdate(BaseModel):
    value: str = PydanticField(max_length=255)
    description: str | None = None


class PointConfigResponse(BaseModel):
    id: int
    key: str
    value: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── List All Configs ────────────────────────────────────────────────

@router.get("", response_model=list[PointConfigResponse])
async def list_point_configs(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    stmt = select(PointConfig).order_by(PointConfig.key)
    result = await session.execute(stmt)
    configs = result.scalars().all()

    return [PointConfigResponse.model_validate(c) for c in configs]


# ─── Upsert Config ──────────────────────────────────────────────────

@router.put("/{key}", response_model=PointConfigResponse)
async def upsert_point_config(
    key: str,
    body: PointConfigUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    result = await session.execute(
        select(PointConfig).where(PointConfig.key == key)
    )
    config = result.scalar_one_or_none()

    if not config:
        config = PointConfig(
            key=key,
            value=body.value,
            description=body.description,
        )
        session.add(config)
    else:
        config.value = body.value
        if body.description is not None:
            config.description = body.description
        config.updated_at = datetime.now(timezone.utc)
        session.add(config)

    await session.commit()
    await session.refresh(config)

    return PointConfigResponse.model_validate(config)
