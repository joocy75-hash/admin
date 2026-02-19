"""Backup management endpoints."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.setting import Setting
from app.schemas.backup import (
    BackupCreateResponse,
    BackupListResponse,
    BackupSettingsResponse,
    BackupSettingsUpdate,
)

router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_GROUP = "backup"
BACKUP_KEY = "settings"

DEFAULT_BACKUP_SETTINGS = {
    "auto_backup_enabled": False,
    "schedule": "daily_02:00",
    "retention_days": 30,
    "backup_path": "/var/backups/admin-panel",
}


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

async def _get_backup_settings(session: AsyncSession) -> dict:
    stmt = select(Setting).where(
        Setting.group_name == BACKUP_GROUP, Setting.key == BACKUP_KEY
    )
    result = await session.execute(stmt)
    setting = result.scalar_one_or_none()
    if setting:
        return setting.value
    return DEFAULT_BACKUP_SETTINGS.copy()


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


# ═══════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════

# ─── List Backups ───────────────────────────────────────────────

@router.get("/list", response_model=BackupListResponse)
async def list_backups(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    return BackupListResponse(items=[])


# ─── Create Backup ─────────────────────────────────────────────

@router.post("/create", response_model=BackupCreateResponse)
async def create_backup(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    now = datetime.now(timezone.utc)
    backup_id = uuid4().hex[:12]
    filename = f"backup_{now.strftime('%Y%m%d_%H%M%S')}_{backup_id}.sql.gz"

    return BackupCreateResponse(
        backup_id=backup_id,
        filename=filename,
        size_bytes=0,
        created_at=now,
        status="queued",
    )


# ─── Get Backup Settings ───────────────────────────────────────

@router.get("/settings", response_model=BackupSettingsResponse)
async def get_backup_settings(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    data = await _get_backup_settings(session)
    return BackupSettingsResponse(
        auto_backup_enabled=data.get("auto_backup_enabled", False),
        schedule=data.get("schedule", "daily_02:00"),
        retention_days=data.get("retention_days", 30),
        backup_path=data.get("backup_path", "/var/backups/admin-panel"),
    )


# ─── Update Backup Settings ────────────────────────────────────

@router.put("/settings", response_model=BackupSettingsResponse)
async def update_backup_settings(
    body: BackupSettingsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    stmt = select(Setting).where(
        Setting.group_name == BACKUP_GROUP, Setting.key == BACKUP_KEY
    )
    result = await session.execute(stmt)
    setting = result.scalar_one_or_none()

    current_data = setting.value.copy() if setting else DEFAULT_BACKUP_SETTINGS.copy()

    update_data = body.model_dump(exclude_unset=True)
    current_data.update(update_data)

    if setting:
        setting.value = current_data
        setting.updated_by = current_user.id
        setting.updated_at = datetime.now(timezone.utc)
        session.add(setting)
    else:
        new_setting = Setting(
            group_name=BACKUP_GROUP,
            key=BACKUP_KEY,
            value=current_data,
            description="Backup configuration settings",
            updated_by=current_user.id,
        )
        session.add(new_setting)

    await session.commit()

    return BackupSettingsResponse(
        auto_backup_enabled=current_data.get("auto_backup_enabled", False),
        schedule=current_data.get("schedule", "daily_02:00"),
        retention_days=current_data.get("retention_days", 30),
        backup_path=current_data.get("backup_path", "/var/backups/admin-panel"),
    )
