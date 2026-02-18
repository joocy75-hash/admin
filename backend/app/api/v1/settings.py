"""System settings management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.setting import Setting
from app.schemas.setting import (
    BulkSettingUpdate,
    SettingGroupResponse,
    SettingResponse,
    SettingUpdate,
)

router = APIRouter(prefix="/settings", tags=["settings"])


def _to_response(s: Setting) -> SettingResponse:
    return SettingResponse(
        id=s.id,
        group_name=s.group_name,
        key=s.key,
        value=s.value,
        description=s.description,
        updated_by=s.updated_by,
        updated_at=s.updated_at,
    )


# ─── List All Settings (grouped) ──────────────────────────────────

@router.get("", response_model=list[SettingGroupResponse])
async def list_settings(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    result = await session.execute(
        select(Setting).order_by(Setting.group_name, Setting.key)
    )
    settings = result.scalars().all()

    groups: dict[str, list[SettingResponse]] = {}
    for s in settings:
        if s.group_name not in groups:
            groups[s.group_name] = []
        groups[s.group_name].append(_to_response(s))

    return [
        SettingGroupResponse(group_name=name, settings=items)
        for name, items in groups.items()
    ]


# ─── Get Settings by Group ────────────────────────────────────────

@router.get("/{group}", response_model=SettingGroupResponse)
async def get_settings_by_group(
    group: str,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    result = await session.execute(
        select(Setting).where(Setting.group_name == group).order_by(Setting.key)
    )
    settings = result.scalars().all()

    if not settings:
        raise HTTPException(status_code=404, detail=f"Setting group '{group}' not found")

    return SettingGroupResponse(
        group_name=group,
        settings=[_to_response(s) for s in settings],
    )


# ─── Update Single Setting ────────────────────────────────────────

@router.put("/{group}/{key}", response_model=SettingResponse)
async def update_setting(
    group: str,
    key: str,
    body: SettingUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    result = await session.execute(
        select(Setting).where(Setting.group_name == group, Setting.key == key)
    )
    setting = result.scalar_one_or_none()

    if not setting:
        # Create new setting if not exists
        setting = Setting(
            group_name=group,
            key=key,
            value=body.value,
            updated_by=current_user.id,
            updated_at=datetime.utcnow(),
        )
        session.add(setting)
    else:
        setting.value = body.value
        setting.updated_by = current_user.id
        setting.updated_at = datetime.utcnow()
        session.add(setting)

    await session.commit()
    await session.refresh(setting)
    return _to_response(setting)


# ─── Bulk Update Settings ─────────────────────────────────────────

@router.post("/bulk", response_model=list[SettingResponse], status_code=status.HTTP_200_OK)
async def bulk_update_settings(
    body: BulkSettingUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    results = []
    for item in body.items:
        result = await session.execute(
            select(Setting).where(
                Setting.group_name == item.group_name,
                Setting.key == item.key,
            )
        )
        setting = result.scalar_one_or_none()

        if not setting:
            setting = Setting(
                group_name=item.group_name,
                key=item.key,
                value=item.value,
                updated_by=current_user.id,
                updated_at=datetime.utcnow(),
            )
            session.add(setting)
        else:
            setting.value = item.value
            setting.updated_by = current_user.id
            setting.updated_at = datetime.utcnow()
            session.add(setting)

        await session.flush()
        await session.refresh(setting)
        results.append(_to_response(setting))

    await session.commit()
    return results
