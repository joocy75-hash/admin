"""VIP level management and user level control endpoints."""

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
from app.models.user import User
from app.models.vip_level import UserLevelHistory, VipLevel

router = APIRouter(prefix="/vip", tags=["vip"])


# ─── Schemas ─────────────────────────────────────────────────────────

class VipLevelCreate(BaseModel):
    level: int
    name: str = PydanticField(max_length=50)
    min_total_deposit: Decimal = Decimal("0")
    min_total_bet: Decimal = Decimal("0")
    rolling_bonus_rate: Decimal = Decimal("0")
    losing_bonus_rate: Decimal = Decimal("0")
    deposit_limit_daily: Decimal = Decimal("0")
    withdrawal_limit_daily: Decimal = Decimal("0")
    withdrawal_limit_monthly: Decimal = Decimal("0")
    max_single_bet: Decimal = Decimal("0")
    benefits: dict = PydanticField(default_factory=dict)
    color: str | None = None
    icon: str | None = None
    sort_order: int = 0
    is_active: bool = True


class VipLevelUpdate(BaseModel):
    name: str | None = PydanticField(default=None, max_length=50)
    min_total_deposit: Decimal | None = None
    min_total_bet: Decimal | None = None
    rolling_bonus_rate: Decimal | None = None
    losing_bonus_rate: Decimal | None = None
    deposit_limit_daily: Decimal | None = None
    withdrawal_limit_daily: Decimal | None = None
    withdrawal_limit_monthly: Decimal | None = None
    max_single_bet: Decimal | None = None
    benefits: dict | None = None
    color: str | None = None
    icon: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class VipLevelResponse(BaseModel):
    id: int
    level: int
    name: str
    min_total_deposit: Decimal
    min_total_bet: Decimal
    rolling_bonus_rate: Decimal
    losing_bonus_rate: Decimal
    deposit_limit_daily: Decimal
    withdrawal_limit_daily: Decimal
    withdrawal_limit_monthly: Decimal
    max_single_bet: Decimal
    benefits: dict
    color: str | None
    icon: str | None
    sort_order: int
    is_active: bool
    user_count: int = 0
    created_at: datetime
    updated_at: datetime


class UserLevelHistoryResponse(BaseModel):
    id: int
    user_id: int
    from_level: int
    to_level: int
    reason: str
    changed_by: int | None
    changed_by_username: str | None = None
    changed_at: datetime


class UserLevelHistoryListResponse(BaseModel):
    items: list[UserLevelHistoryResponse]
    total: int
    page: int
    page_size: int


class UserBriefResponse(BaseModel):
    id: int
    username: str
    nickname: str | None
    balance: Decimal
    total_deposit: Decimal
    total_bet: Decimal
    status: str


class UserListAtLevelResponse(BaseModel):
    items: list[UserBriefResponse]
    total: int
    page: int
    page_size: int


class LevelChangeRequest(BaseModel):
    reason: str = PydanticField(max_length=100)


class AutoCheckResult(BaseModel):
    total_checked: int
    total_upgraded: int
    upgrades: list[dict]


# ─── Helpers ─────────────────────────────────────────────────────────

async def _vip_response(session: AsyncSession, vip: VipLevel) -> VipLevelResponse:
    count_stmt = select(func.count()).where(User.level == vip.level)
    user_count = (await session.execute(count_stmt)).scalar() or 0

    return VipLevelResponse(
        id=vip.id,
        level=vip.level,
        name=vip.name,
        min_total_deposit=vip.min_total_deposit,
        min_total_bet=vip.min_total_bet,
        rolling_bonus_rate=vip.rolling_bonus_rate,
        losing_bonus_rate=vip.losing_bonus_rate,
        deposit_limit_daily=vip.deposit_limit_daily,
        withdrawal_limit_daily=vip.withdrawal_limit_daily,
        withdrawal_limit_monthly=vip.withdrawal_limit_monthly,
        max_single_bet=vip.max_single_bet,
        benefits=vip.benefits,
        color=vip.color,
        icon=vip.icon,
        sort_order=vip.sort_order,
        is_active=vip.is_active,
        user_count=user_count,
        created_at=vip.created_at,
        updated_at=vip.updated_at,
    )


# ═══════════════════════════════════════════════════════════════════════
# VIP Level CRUD
# ═══════════════════════════════════════════════════════════════════════


@router.get("/levels", response_model=list[VipLevelResponse])
async def list_vip_levels(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    stmt = select(VipLevel).order_by(VipLevel.level)
    result = await session.execute(stmt)
    levels = result.scalars().all()

    return [await _vip_response(session, vip) for vip in levels]


@router.post("/levels", response_model=VipLevelResponse, status_code=status.HTTP_201_CREATED)
async def create_vip_level(
    body: VipLevelCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    # Check unique level number
    existing_stmt = select(VipLevel).where(VipLevel.level == body.level)
    if (await session.execute(existing_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"VIP level {body.level} already exists")

    # Check unique name
    name_stmt = select(VipLevel).where(VipLevel.name == body.name)
    if (await session.execute(name_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"VIP level name '{body.name}' already exists")

    vip = VipLevel(
        level=body.level,
        name=body.name,
        min_total_deposit=body.min_total_deposit,
        min_total_bet=body.min_total_bet,
        rolling_bonus_rate=body.rolling_bonus_rate,
        losing_bonus_rate=body.losing_bonus_rate,
        deposit_limit_daily=body.deposit_limit_daily,
        withdrawal_limit_daily=body.withdrawal_limit_daily,
        withdrawal_limit_monthly=body.withdrawal_limit_monthly,
        max_single_bet=body.max_single_bet,
        benefits=body.benefits,
        color=body.color,
        icon=body.icon,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    session.add(vip)
    await session.commit()
    await session.refresh(vip)

    return await _vip_response(session, vip)


@router.get("/levels/{level_id}", response_model=VipLevelResponse)
async def get_vip_level(
    level_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    vip = await session.get(VipLevel, level_id)
    if not vip:
        raise HTTPException(status_code=404, detail="VIP level not found")

    return await _vip_response(session, vip)


@router.put("/levels/{level_id}", response_model=VipLevelResponse)
async def update_vip_level(
    level_id: int,
    body: VipLevelUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    vip = await session.get(VipLevel, level_id)
    if not vip:
        raise HTTPException(status_code=404, detail="VIP level not found")

    update_data = body.model_dump(exclude_unset=True)

    # Validate name uniqueness if changing
    if "name" in update_data and update_data["name"] != vip.name:
        name_stmt = select(VipLevel).where(VipLevel.name == update_data["name"], VipLevel.id != level_id)
        if (await session.execute(name_stmt)).scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"VIP level name '{update_data['name']}' already exists")

    for field, value in update_data.items():
        setattr(vip, field, value)
    vip.updated_at = datetime.now(timezone.utc)

    session.add(vip)
    await session.commit()
    await session.refresh(vip)

    return await _vip_response(session, vip)


@router.delete("/levels/{level_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vip_level(
    level_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    vip = await session.get(VipLevel, level_id)
    if not vip:
        raise HTTPException(status_code=404, detail="VIP level not found")

    # Prevent deletion if users are at this level
    count_stmt = select(func.count()).where(User.level == vip.level)
    user_count = (await session.execute(count_stmt)).scalar() or 0
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete VIP level with {user_count} active users. Reassign users first.",
        )

    await session.delete(vip)
    await session.commit()


# ═══════════════════════════════════════════════════════════════════════
# Users at VIP Level
# ═══════════════════════════════════════════════════════════════════════


@router.get("/levels/{level_num}/users", response_model=UserListAtLevelResponse)
async def list_users_at_level(
    level_num: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    # Verify the VIP level exists
    level_stmt = select(VipLevel).where(VipLevel.level == level_num)
    vip = (await session.execute(level_stmt)).scalar_one_or_none()
    if not vip:
        raise HTTPException(status_code=404, detail=f"VIP level {level_num} not found")

    base = select(User).where(User.level == level_num)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    users = result.scalars().all()

    items = [
        UserBriefResponse(
            id=u.id,
            username=u.username,
            nickname=u.nickname,
            balance=u.balance,
            total_deposit=u.total_deposit,
            total_bet=u.total_bet,
            status=u.status,
        )
        for u in users
    ]

    return UserListAtLevelResponse(items=items, total=total, page=page, page_size=page_size)


# ═══════════════════════════════════════════════════════════════════════
# User Level Management
# ═══════════════════════════════════════════════════════════════════════


@router.post("/users/{user_id}/upgrade", response_model=UserLevelHistoryResponse)
async def upgrade_user_level(
    user_id: int,
    body: LevelChangeRequest,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find the next level up
    next_level_stmt = (
        select(VipLevel)
        .where(VipLevel.level > user.level, VipLevel.is_active.is_(True))
        .order_by(VipLevel.level)
        .limit(1)
    )
    next_level = (await session.execute(next_level_stmt)).scalar_one_or_none()
    if not next_level:
        raise HTTPException(status_code=400, detail="No higher VIP level available")

    from_level = user.level
    user.level = next_level.level
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)

    history = UserLevelHistory(
        user_id=user_id,
        from_level=from_level,
        to_level=next_level.level,
        reason=body.reason,
        changed_by=current_user.id,
    )
    session.add(history)

    await session.commit()
    await session.refresh(history)

    return UserLevelHistoryResponse(
        id=history.id,
        user_id=history.user_id,
        from_level=history.from_level,
        to_level=history.to_level,
        reason=history.reason,
        changed_by=history.changed_by,
        changed_by_username=current_user.username,
        changed_at=history.changed_at,
    )


@router.post("/users/{user_id}/downgrade", response_model=UserLevelHistoryResponse)
async def downgrade_user_level(
    user_id: int,
    body: LevelChangeRequest,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find the next level down
    prev_level_stmt = (
        select(VipLevel)
        .where(VipLevel.level < user.level, VipLevel.is_active.is_(True))
        .order_by(VipLevel.level.desc())
        .limit(1)
    )
    prev_level = (await session.execute(prev_level_stmt)).scalar_one_or_none()
    if not prev_level:
        raise HTTPException(status_code=400, detail="No lower VIP level available")

    from_level = user.level
    user.level = prev_level.level
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)

    history = UserLevelHistory(
        user_id=user_id,
        from_level=from_level,
        to_level=prev_level.level,
        reason=body.reason,
        changed_by=current_user.id,
    )
    session.add(history)

    await session.commit()
    await session.refresh(history)

    return UserLevelHistoryResponse(
        id=history.id,
        user_id=history.user_id,
        from_level=history.from_level,
        to_level=history.to_level,
        reason=history.reason,
        changed_by=history.changed_by,
        changed_by_username=current_user.username,
        changed_at=history.changed_at,
    )


@router.get("/users/{user_id}/history", response_model=UserLevelHistoryListResponse)
async def get_user_level_history(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    base = select(UserLevelHistory).where(UserLevelHistory.user_id == user_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(UserLevelHistory.changed_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    entries = result.scalars().all()

    items = []
    for entry in entries:
        changer = await session.get(AdminUser, entry.changed_by) if entry.changed_by else None
        items.append(
            UserLevelHistoryResponse(
                id=entry.id,
                user_id=entry.user_id,
                from_level=entry.from_level,
                to_level=entry.to_level,
                reason=entry.reason,
                changed_by=entry.changed_by,
                changed_by_username=changer.username if changer else None,
                changed_at=entry.changed_at,
            )
        )

    return UserLevelHistoryListResponse(items=items, total=total, page=page, page_size=page_size)


# ═══════════════════════════════════════════════════════════════════════
# Auto-Check (Batch Upgrade)
# ═══════════════════════════════════════════════════════════════════════


@router.post("/auto-check", response_model=AutoCheckResult)
async def run_auto_upgrade_check(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    # Load all active VIP levels sorted ascending
    levels_stmt = select(VipLevel).where(VipLevel.is_active.is_(True)).order_by(VipLevel.level)
    levels = (await session.execute(levels_stmt)).scalars().all()

    if not levels:
        return AutoCheckResult(total_checked=0, total_upgraded=0, upgrades=[])

    # Load all active users
    users_stmt = select(User).where(User.status == "active")
    users = (await session.execute(users_stmt)).scalars().all()

    total_checked = len(users)
    upgrades = []

    for user in users:
        # Determine the highest level this user qualifies for
        qualified_level = None
        for vip in levels:
            if user.total_deposit >= vip.min_total_deposit and user.total_bet >= vip.min_total_bet:
                qualified_level = vip

        if not qualified_level:
            continue

        # Only upgrade (never downgrade via auto-check)
        if qualified_level.level > user.level:
            from_level = user.level
            user.level = qualified_level.level
            user.updated_at = datetime.now(timezone.utc)
            session.add(user)

            history = UserLevelHistory(
                user_id=user.id,
                from_level=from_level,
                to_level=qualified_level.level,
                reason="auto-check: threshold qualification",
                changed_by=current_user.id,
            )
            session.add(history)

            upgrades.append({
                "user_id": user.id,
                "username": user.username,
                "from_level": from_level,
                "to_level": qualified_level.level,
                "level_name": qualified_level.name,
            })

    if upgrades:
        await session.commit()

    return AutoCheckResult(
        total_checked=total_checked,
        total_upgraded=len(upgrades),
        upgrades=upgrades,
    )
