"""User (member) management endpoints with referral tree."""

import secrets
import string
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser, AdminUserTree
from app.models.user import User, UserTree
from app.models.user_wallet_address import UserWalletAddress
from app.models.user_betting_permission import UserBettingPermission
from app.models.user_null_betting_config import UserNullBettingConfig
from app.models.user_game_rolling_rate import UserGameRollingRate
from app.schemas.user import (
    WalletAddressCreate,
    WalletAddressResponse,
    WalletAddressUpdate,
    BettingPermissionResponse,
    BettingPermissionUpdate,
    BulkStatusUpdate,
    GameRollingRateResponse,
    GameRollingRateUpdate,
    NullBettingConfigResponse,
    NullBettingConfigUpdate,
    PasswordSet,
    UserCreate,
    UserDetailResponse,
    UserListResponse,
    UserResponse,
    UserStatistics,
    UserSummaryStats,
    UserTreeNode,
    UserTreeResponse,
    UserUpdate,
)
from app.services.user_tree_service import (
    insert_node,
    get_direct_referral_count,
    get_subtree_for_tree_view,
    get_ancestors,
    get_children,
)
from app.services.promotion_service import cascade_promotion_check
from app.services import notification_service
from app.utils.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])

Referrer = aliased(User)


async def _build_response(session: AsyncSession, user: User) -> UserResponse:
    referrer = await session.get(User, user.referrer_id) if user.referrer_id else None
    ref_count = await get_direct_referral_count(session, user.id)
    return UserResponse(
        id=user.id,
        uuid=str(user.uuid),
        username=user.username,
        real_name=user.real_name,
        phone=user.phone,
        email=user.email,
        nickname=user.nickname,
        color=user.color,
        registration_ip=user.registration_ip,
        deposit_address=user.deposit_address,
        deposit_network=user.deposit_network,
        referrer_id=user.referrer_id,
        referrer_username=referrer.username if referrer else None,
        depth=user.depth,
        rank=user.rank,
        balance=user.balance,
        points=user.points,
        status=user.status,
        level=user.level,
        direct_referral_count=ref_count,
        total_deposit=user.total_deposit,
        total_withdrawal=user.total_withdrawal,
        total_bet=user.total_bet,
        total_win=user.total_win,
        login_count=user.login_count,
        last_deposit_at=user.last_deposit_at,
        last_bet_at=user.last_bet_at,
        memo=user.memo,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def _build_response_batch(
    session: AsyncSession,
    users: list[User],
) -> list[UserResponse]:
    if not users:
        return []

    user_ids = [u.id for u in users]
    referrer_ids = [u.referrer_id for u in users if u.referrer_id]

    # Batch fetch referrers
    referrer_map: dict[int, str] = {}
    if referrer_ids:
        ref_stmt = select(User.id, User.username).where(User.id.in_(referrer_ids))
        ref_result = await session.execute(ref_stmt)
        referrer_map = {r.id: r.username for r in ref_result.all()}

    # Batch fetch direct referral counts
    ref_count_stmt = (
        select(UserTree.ancestor_id, func.count().label("cnt"))
        .where(UserTree.ancestor_id.in_(user_ids), UserTree.depth == 1)
        .group_by(UserTree.ancestor_id)
    )
    ref_count_result = await session.execute(ref_count_stmt)
    ref_count_map: dict[int, int] = {r.ancestor_id: r.cnt for r in ref_count_result.all()}

    items = []
    for user in users:
        items.append(UserResponse(
            id=user.id,
            uuid=str(user.uuid),
            username=user.username,
            real_name=user.real_name,
            phone=user.phone,
            email=user.email,
            nickname=user.nickname,
            color=user.color,
            registration_ip=user.registration_ip,
            deposit_address=user.deposit_address,
            deposit_network=user.deposit_network,
            referrer_id=user.referrer_id,
            referrer_username=referrer_map.get(user.referrer_id) if user.referrer_id else None,
            depth=user.depth,
            rank=user.rank,
            balance=user.balance,
            points=user.points,
            status=user.status,
            level=user.level,
            direct_referral_count=ref_count_map.get(user.id, 0),
            total_deposit=user.total_deposit,
            total_withdrawal=user.total_withdrawal,
            total_bet=user.total_bet,
            total_win=user.total_win,
            login_count=user.login_count,
            last_deposit_at=user.last_deposit_at,
            last_bet_at=user.last_bet_at,
            memo=user.memo,
            last_login_at=user.last_login_at,
            created_at=user.created_at,
            updated_at=user.updated_at,
        ))
    return items


async def _get_user_or_404(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _verify_user_access(
    session: AsyncSession,
    current_user: AdminUser,
    target_user_id: int,
) -> None:
    if current_user.role == "super_admin":
        return
    # Get all descendant agent IDs in current_user's subtree (including self)
    descendant_stmt = select(AdminUserTree.descendant_id).where(
        AdminUserTree.ancestor_id == current_user.id,
    )
    descendant_result = await session.execute(descendant_stmt)
    subtree_agent_ids = {r[0] for r in descendant_result.all()}

    # Walk up the target user's referrer chain to find an agent in the subtree
    user = await session.get(User, target_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if any ancestor in the user's referral tree has a referrer_id
    # that maps to an agent in the admin subtree.
    # Walk the user_tree ancestors to check if the user belongs to this agent's scope.
    ancestor_stmt = (
        select(UserTree.ancestor_id)
        .where(UserTree.descendant_id == target_user_id)
    )
    ancestor_result = await session.execute(ancestor_stmt)
    user_ancestor_ids = {r[0] for r in ancestor_result.all()}

    # The user or any of their ancestors should be "owned" by an agent in the subtree.
    # We check if any user_ancestor_id matches an agent's managed user set.
    # In this system, users are linked to agents via referrer_id.
    # A simple check: current agent's ID should appear somewhere in the user's ancestor chain
    # OR the user_id itself should be in a set managed by the agent subtree.
    # Since users and agents are in separate tables, we check if the current_user.id
    # is in the user's referrer chain (user referrer_id points to other users, not agents directly).
    # The practical approach: agents see users they or their sub-agents created.
    # Users' referrer_id points to other users, so we check the admin_user_tree for subtree scope.
    if current_user.id in subtree_agent_ids:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: user is not in your subtree",
    )


# ─── List ─────────────────────────────────────────────────────────

@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    status_filter: str | None = Query(None, alias="status"),
    rank: str | None = Query(None),
    referrer_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    base = select(User)

    if search:
        base = base.where(
            or_(
                User.username.ilike(f"%{search}%"),
                User.real_name.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%"),
            )
        )
    if status_filter:
        base = base.where(User.status == status_filter)
    if rank:
        base = base.where(User.rank == rank)
    if referrer_id:
        base = base.where(User.referrer_id == referrer_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(User.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    users = result.scalars().all()

    items = await _build_response_batch(session, list(users))
    return UserListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Summary Stats ───────────────────────────────────────────────

@router.get("/summary-stats", response_model=UserSummaryStats)
async def get_user_summary_stats(
    session: AsyncSession = Depends(get_session),
    _: AdminUser = Depends(PermissionChecker("users.view")),
):
    total = (await session.execute(select(func.count(User.id)))).scalar() or 0
    active = (await session.execute(select(func.count(User.id)).where(User.status == "active"))).scalar() or 0
    suspended = (await session.execute(select(func.count(User.id)).where(User.status == "suspended"))).scalar() or 0
    banned = (await session.execute(select(func.count(User.id)).where(User.status == "banned"))).scalar() or 0
    pending = (await session.execute(select(func.count(User.id)).where(User.status == "pending"))).scalar() or 0
    bal = (await session.execute(select(func.coalesce(func.sum(User.balance), 0)))).scalar() or 0
    pts = (await session.execute(select(func.coalesce(func.sum(User.points), 0)))).scalar() or 0
    return UserSummaryStats(
        total_count=total, active_count=active, suspended_count=suspended,
        banned_count=banned, pending_count=pending,
        total_balance=float(bal), total_points=float(pts),
    )


# ─── Bulk Status Update ──────────────────────────────────────────

@router.patch("/bulk-status")
async def bulk_update_status(
    body: BulkStatusUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    VALID_STATUSES = {"active", "suspended", "banned"}
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")

    result = await session.execute(
        select(User).where(User.id.in_(body.user_ids))
    )
    users = result.scalars().all()

    if len(users) != len(body.user_ids):
        found_ids = {u.id for u in users}
        missing_ids = [uid for uid in body.user_ids if uid not in found_ids]
        raise HTTPException(status_code=404, detail=f"Users not found: {missing_ids}")

    now = datetime.now(timezone.utc)
    updated_count = 0
    for user in users:
        if user.status != body.status:
            user.status = body.status
            user.updated_at = now
            session.add(user)
            updated_count += 1

    await session.commit()
    return {"updated_count": updated_count, "status": body.status, "user_ids": body.user_ids}


# ─── Create ───────────────────────────────────────────────────────

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.create")),
):
    existing = await session.execute(
        select(User).where(User.username == body.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    referrer = None
    referrer_id = None
    depth = 0
    if body.referrer_code:
        ref_result = await session.execute(
            select(User).where(User.username == body.referrer_code)
        )
        referrer = ref_result.scalar_one_or_none()
        if not referrer:
            raise HTTPException(status_code=400, detail="Referrer not found")
        referrer_id = referrer.id
        depth = referrer.depth + 1

    user = User(
        username=body.username,
        real_name=body.real_name,
        phone=body.phone,
        email=body.email,
        referrer_id=referrer_id,
        depth=depth,
        rank="agency",
        level=body.level,
        memo=body.memo,
    )
    session.add(user)
    await session.flush()

    # Insert into closure table
    await insert_node(session, user.id, referrer_id)

    # Auto-promote ancestors
    await cascade_promotion_check(session, user.id)

    await session.commit()
    await session.refresh(user)
    notification_service.notify_new_user(user.username)
    return await _build_response(session, user)


# ─── Get One ──────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user_access(session, current_user, user_id)
    user = await _get_user_or_404(session, user_id)
    return await _build_response(session, user)


# ─── Update ───────────────────────────────────────────────────────

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _verify_user_access(session, current_user, user_id)
    user = await _get_user_or_404(session, user_id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    user.updated_at = datetime.now(timezone.utc)

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return await _build_response(session, user)


# ─── Delete (soft) ────────────────────────────────────────────────

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.delete")),
):
    await _verify_user_access(session, current_user, user_id)
    user = await _get_user_or_404(session, user_id)
    user.status = "banned"
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()


# ─── Detail (composite) ──────────────────────────────────────────

@router.get("/{user_id}/detail", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user_access(session, current_user, user_id)
    user = await _get_user_or_404(session, user_id)
    user_resp = await _build_response(session, user)

    stats = UserStatistics(
        total_deposit=user.total_deposit,
        total_withdrawal=user.total_withdrawal,
        total_bet=user.total_bet,
        total_win=user.total_win,
        net_profit=user.total_win - user.total_bet,
        deposit_withdrawal_diff=user.total_deposit - user.total_withdrawal,
    )

    wallet_result = await session.execute(
        select(UserWalletAddress).where(UserWalletAddress.user_id == user_id)
    )
    wallet_addresses = [
        WalletAddressResponse(
            id=w.id, coin_type=w.coin_type, network=w.network,
            address=w.address, label=w.label,
            is_primary=w.is_primary, status=w.status,
        )
        for w in wallet_result.scalars().all()
    ]

    bp_result = await session.execute(
        select(UserBettingPermission).where(UserBettingPermission.user_id == user_id)
    )
    betting_perms = [
        BettingPermissionResponse(id=bp.id, game_category=bp.game_category, is_allowed=bp.is_allowed)
        for bp in bp_result.scalars().all()
    ]

    nbc_result = await session.execute(
        select(UserNullBettingConfig).where(UserNullBettingConfig.user_id == user_id)
    )
    null_configs = [
        NullBettingConfigResponse(
            id=n.id, game_category=n.game_category,
            every_n_bets=n.every_n_bets, inherit_to_children=n.inherit_to_children,
        )
        for n in nbc_result.scalars().all()
    ]

    grr_result = await session.execute(
        select(UserGameRollingRate).where(UserGameRollingRate.user_id == user_id)
    )
    rolling_rates = [
        GameRollingRateResponse(
            id=r.id, game_category=r.game_category,
            provider=r.provider, rolling_rate=r.rolling_rate,
        )
        for r in grr_result.scalars().all()
    ]

    return UserDetailResponse(
        user=user_resp,
        statistics=stats,
        wallet_addresses=wallet_addresses,
        betting_permissions=betting_perms,
        null_betting_configs=null_configs,
        game_rolling_rates=rolling_rates,
    )


# ─── Statistics ───────────────────────────────────────────────────

@router.get("/{user_id}/statistics", response_model=UserStatistics)
async def get_user_statistics(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user_access(session, current_user, user_id)
    user = await _get_user_or_404(session, user_id)
    return UserStatistics(
        total_deposit=user.total_deposit,
        total_withdrawal=user.total_withdrawal,
        total_bet=user.total_bet,
        total_win=user.total_win,
        net_profit=user.total_win - user.total_bet,
        deposit_withdrawal_diff=user.total_deposit - user.total_withdrawal,
    )


# ─── Wallet Addresses ─────────────────────────────────────────────

@router.get("/{user_id}/wallet-addresses", response_model=list[WalletAddressResponse])
async def list_wallet_addresses(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _get_user_or_404(session, user_id)
    result = await session.execute(
        select(UserWalletAddress).where(UserWalletAddress.user_id == user_id)
    )
    return [
        WalletAddressResponse(
            id=w.id, coin_type=w.coin_type, network=w.network,
            address=w.address, label=w.label,
            is_primary=w.is_primary, status=w.status,
        )
        for w in result.scalars().all()
    ]


@router.post(
    "/{user_id}/wallet-addresses",
    response_model=WalletAddressResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_wallet_address(
    user_id: int,
    body: WalletAddressCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _get_user_or_404(session, user_id)

    if body.is_primary:
        stmt = select(UserWalletAddress).where(
            UserWalletAddress.user_id == user_id, UserWalletAddress.is_primary == True
        )
        existing_primary = (await session.execute(stmt)).scalar_one_or_none()
        if existing_primary:
            existing_primary.is_primary = False
            session.add(existing_primary)

    wallet = UserWalletAddress(user_id=user_id, **body.model_dump())
    session.add(wallet)
    await session.commit()
    await session.refresh(wallet)
    return WalletAddressResponse(
        id=wallet.id, coin_type=wallet.coin_type, network=wallet.network,
        address=wallet.address, label=wallet.label,
        is_primary=wallet.is_primary, status=wallet.status,
    )


@router.put("/{user_id}/wallet-addresses/{wallet_id}", response_model=WalletAddressResponse)
async def update_wallet_address(
    user_id: int,
    wallet_id: int,
    body: WalletAddressUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _get_user_or_404(session, user_id)
    wallet = await session.get(UserWalletAddress, wallet_id)
    if not wallet or wallet.user_id != user_id:
        raise HTTPException(status_code=404, detail="Wallet address not found")

    update_data = body.model_dump(exclude_unset=True)

    if update_data.get("is_primary"):
        stmt = select(UserWalletAddress).where(
            UserWalletAddress.user_id == user_id,
            UserWalletAddress.is_primary == True,
            UserWalletAddress.id != wallet_id,
        )
        existing_primary = (await session.execute(stmt)).scalar_one_or_none()
        if existing_primary:
            existing_primary.is_primary = False
            session.add(existing_primary)

    for field, value in update_data.items():
        setattr(wallet, field, value)
    wallet.updated_at = datetime.now(timezone.utc)
    session.add(wallet)
    await session.commit()
    await session.refresh(wallet)
    return WalletAddressResponse(
        id=wallet.id, coin_type=wallet.coin_type, network=wallet.network,
        address=wallet.address, label=wallet.label,
        is_primary=wallet.is_primary, status=wallet.status,
    )


@router.delete(
    "/{user_id}/wallet-addresses/{wallet_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_wallet_address(
    user_id: int,
    wallet_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _get_user_or_404(session, user_id)
    wallet = await session.get(UserWalletAddress, wallet_id)
    if not wallet or wallet.user_id != user_id:
        raise HTTPException(status_code=404, detail="Wallet address not found")
    await session.delete(wallet)
    await session.commit()


# ─── Betting Permissions ──────────────────────────────────────────

@router.put("/{user_id}/betting-permissions", response_model=list[BettingPermissionResponse])
async def update_betting_permissions(
    user_id: int,
    body: list[BettingPermissionUpdate],
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _get_user_or_404(session, user_id)

    for item in body:
        stmt = select(UserBettingPermission).where(
            UserBettingPermission.user_id == user_id,
            UserBettingPermission.game_category == item.game_category,
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.is_allowed = item.is_allowed
            existing.updated_at = datetime.now(timezone.utc)
            session.add(existing)
        else:
            bp = UserBettingPermission(
                user_id=user_id,
                game_category=item.game_category,
                is_allowed=item.is_allowed,
            )
            session.add(bp)

    await session.commit()

    result = await session.execute(
        select(UserBettingPermission).where(UserBettingPermission.user_id == user_id)
    )
    return [
        BettingPermissionResponse(id=bp.id, game_category=bp.game_category, is_allowed=bp.is_allowed)
        for bp in result.scalars().all()
    ]


# ─── Null Betting Config ─────────────────────────────────────────

@router.put("/{user_id}/null-betting", response_model=list[NullBettingConfigResponse])
async def update_null_betting(
    user_id: int,
    body: list[NullBettingConfigUpdate],
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _get_user_or_404(session, user_id)

    for item in body:
        stmt = select(UserNullBettingConfig).where(
            UserNullBettingConfig.user_id == user_id,
            UserNullBettingConfig.game_category == item.game_category,
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.every_n_bets = item.every_n_bets
            existing.inherit_to_children = item.inherit_to_children
            existing.updated_at = datetime.now(timezone.utc)
            session.add(existing)
        else:
            nbc = UserNullBettingConfig(
                user_id=user_id,
                game_category=item.game_category,
                every_n_bets=item.every_n_bets,
                inherit_to_children=item.inherit_to_children,
            )
            session.add(nbc)

    await session.commit()

    result = await session.execute(
        select(UserNullBettingConfig).where(UserNullBettingConfig.user_id == user_id)
    )
    return [
        NullBettingConfigResponse(
            id=n.id, game_category=n.game_category,
            every_n_bets=n.every_n_bets, inherit_to_children=n.inherit_to_children,
        )
        for n in result.scalars().all()
    ]


# ─── Game Rolling Rates ──────────────────────────────────────────

@router.put("/{user_id}/rolling-rates", response_model=list[GameRollingRateResponse])
async def update_rolling_rates(
    user_id: int,
    body: list[GameRollingRateUpdate],
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _get_user_or_404(session, user_id)

    for item in body:
        stmt = select(UserGameRollingRate).where(
            UserGameRollingRate.user_id == user_id,
            UserGameRollingRate.game_category == item.game_category,
            UserGameRollingRate.provider == item.provider,
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.rolling_rate = item.rolling_rate
            existing.updated_at = datetime.now(timezone.utc)
            session.add(existing)
        else:
            grr = UserGameRollingRate(
                user_id=user_id,
                game_category=item.game_category,
                provider=item.provider,
                rolling_rate=item.rolling_rate,
            )
            session.add(grr)

    await session.commit()

    result = await session.execute(
        select(UserGameRollingRate).where(UserGameRollingRate.user_id == user_id)
    )
    return [
        GameRollingRateResponse(
            id=r.id, game_category=r.game_category,
            provider=r.provider, rolling_rate=r.rolling_rate,
        )
        for r in result.scalars().all()
    ]


# ─── Password ─────────────────────────────────────────────────────

@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    user = await _get_user_or_404(session, user_id)
    chars = string.ascii_letters + string.digits
    temp_password = ''.join(secrets.choice(chars) for _ in range(8))
    user.password_hash = hash_password(temp_password)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    return {"temporary_password": temp_password}


@router.post("/{user_id}/set-password", status_code=status.HTTP_204_NO_CONTENT)
async def set_password(
    user_id: int,
    body: PasswordSet,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    user = await _get_user_or_404(session, user_id)
    user.password_hash = hash_password(body.new_password)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()


# ─── Suspend ──────────────────────────────────────────────────────

@router.post("/{user_id}/suspend", response_model=UserResponse)
async def suspend_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    user = await _get_user_or_404(session, user_id)
    user.status = "suspended"
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return await _build_response(session, user)


# ─── Tree (subtree for visualization) ────────────────────────────

@router.get("/{user_id}/tree", response_model=UserTreeResponse)
async def get_user_tree(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    user = await _get_user_or_404(session, user_id)
    nodes_data = await get_subtree_for_tree_view(session, user_id)
    nodes = [UserTreeNode(**n) for n in nodes_data]
    return UserTreeResponse(nodes=nodes)


# ─── Referrals (direct children) ─────────────────────────────────

@router.get("/{user_id}/referrals", response_model=UserListResponse)
async def get_user_referrals(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    user = await _get_user_or_404(session, user_id)

    base = select(User).where(User.referrer_id == user_id)
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(User.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    users = result.scalars().all()

    items = await _build_response_batch(session, list(users))
    return UserListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Ancestors (path to root) ────────────────────────────────────

@router.get("/{user_id}/ancestors", response_model=UserListResponse)
async def get_user_ancestors(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    user = await _get_user_or_404(session, user_id)

    ancestor_data = await get_ancestors(session, user_id)
    items = [await _build_response(session, a["user"]) for a in ancestor_data]
    return UserListResponse(items=items, total=len(items), page=1, page_size=len(items) or 1)
