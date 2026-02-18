"""Game management endpoints: providers, games, rounds."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.game import Game, GameProvider, GameRound
from app.models.user import User
from app.schemas.game import (
    GameCreate,
    GameListResponse,
    GameProviderCreate,
    GameProviderListResponse,
    GameProviderResponse,
    GameProviderUpdate,
    GameResponse,
    GameRoundListResponse,
    GameRoundResponse,
    GameUpdate,
)
from app.services.cache_service import cache_get, cache_set, cache_delete_pattern

router = APIRouter(prefix="/games", tags=["games"])


# ═══════════════════════════════════════════════════════════════════
# GameProvider endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/providers", response_model=GameProviderListResponse)
async def list_providers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.view")),
):
    base = select(GameProvider)

    if category:
        base = base.where(GameProvider.category == category)
    if is_active is not None:
        base = base.where(GameProvider.is_active == is_active)
    if search:
        base = base.where(
            or_(
                GameProvider.name.ilike(f"%{search}%"),
                GameProvider.code.ilike(f"%{search}%"),
            )
        )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(GameProvider.category, GameProvider.name).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    providers = result.scalars().all()

    items = [GameProviderResponse.model_validate(p) for p in providers]
    return GameProviderListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/providers", response_model=GameProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    body: GameProviderCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.create")),
):
    existing = await session.execute(
        select(GameProvider).where(
            or_(GameProvider.name == body.name, GameProvider.code == body.code)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Provider name or code already exists")

    provider = GameProvider(**body.model_dump())
    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return GameProviderResponse.model_validate(provider)


@router.get("/providers/{provider_id}", response_model=GameProviderResponse)
async def get_provider(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.view")),
):
    provider = await session.get(GameProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return GameProviderResponse.model_validate(provider)


@router.put("/providers/{provider_id}", response_model=GameProviderResponse)
async def update_provider(
    provider_id: int,
    body: GameProviderUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.update")),
):
    provider = await session.get(GameProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(provider, field, value)
    provider.updated_at = datetime.utcnow()

    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return GameProviderResponse.model_validate(provider)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.delete")),
):
    provider = await session.get(GameProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Soft delete
    provider.is_active = False
    provider.updated_at = datetime.utcnow()
    session.add(provider)
    await session.commit()


# ═══════════════════════════════════════════════════════════════════
# GameRound endpoints (MUST be before /{game_id} to avoid route conflict)
# ═══════════════════════════════════════════════════════════════════

async def _build_round_response(session: AsyncSession, round: GameRound) -> GameRoundResponse:
    game = await session.get(Game, round.game_id)
    user = await session.get(User, round.user_id)
    return GameRoundResponse(
        id=round.id,
        game_id=round.game_id,
        user_id=round.user_id,
        round_id=round.round_id,
        bet_amount=round.bet_amount,
        win_amount=round.win_amount,
        result=round.result,
        started_at=round.started_at,
        ended_at=round.ended_at,
        created_at=round.created_at,
        game_name=game.name if game else None,
        user_username=user.username if user else None,
    )


@router.get("/rounds", response_model=GameRoundListResponse)
async def list_rounds(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    game_id: int | None = Query(None),
    user_id: int | None = Query(None),
    result_filter: str | None = Query(None, alias="result"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game.view")),
):
    base = select(GameRound)

    if game_id:
        base = base.where(GameRound.game_id == game_id)
    if user_id:
        base = base.where(GameRound.user_id == user_id)
    if result_filter:
        base = base.where(GameRound.result == result_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Aggregate bet/win
    sum_stmt = select(
        func.coalesce(func.sum(GameRound.bet_amount), 0),
        func.coalesce(func.sum(GameRound.win_amount), 0),
    ).select_from(base.subquery())
    sums = (await session.execute(sum_stmt)).one()
    total_bet, total_win = sums[0], sums[1]

    stmt = base.order_by(GameRound.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    rounds = result.scalars().all()

    items = [await _build_round_response(session, r) for r in rounds]
    return GameRoundListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_bet=total_bet, total_win=total_win,
    )


@router.get("/rounds/{round_id}", response_model=GameRoundResponse)
async def get_round(
    round_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game.view")),
):
    game_round = await session.get(GameRound, round_id)
    if not game_round:
        raise HTTPException(status_code=404, detail="Game round not found")
    return await _build_round_response(session, game_round)


# ═══════════════════════════════════════════════════════════════════
# Game endpoints
# ═══════════════════════════════════════════════════════════════════

async def _build_game_response(session: AsyncSession, game: Game) -> GameResponse:
    provider = await session.get(GameProvider, game.provider_id)
    return GameResponse(
        id=game.id,
        provider_id=game.provider_id,
        name=game.name,
        code=game.code,
        category=game.category,
        is_active=game.is_active,
        sort_order=game.sort_order,
        thumbnail_url=game.thumbnail_url,
        created_at=game.created_at,
        updated_at=game.updated_at,
        provider_name=provider.name if provider else None,
    )


@router.get("", response_model=GameListResponse)
async def list_games(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    provider_id: int | None = Query(None),
    search: str | None = Query(None, max_length=100),
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game.view")),
):
    # Cache key based on query params (60s TTL)
    cache_key = f"games:list:{page}:{page_size}:{category}:{provider_id}:{search}:{is_active}"
    cached = await cache_get(cache_key)
    if cached:
        return GameListResponse(**cached)

    base = select(Game)

    if category:
        base = base.where(Game.category == category)
    if provider_id:
        base = base.where(Game.provider_id == provider_id)
    if is_active is not None:
        base = base.where(Game.is_active == is_active)
    if search:
        base = base.where(
            or_(
                Game.name.ilike(f"%{search}%"),
                Game.code.ilike(f"%{search}%"),
            )
        )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Game.category, Game.sort_order, Game.name).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    games = result.scalars().all()

    items = [await _build_game_response(session, g) for g in games]
    result = GameListResponse(items=items, total=total, page=page, page_size=page_size)
    await cache_set(cache_key, result.model_dump(), ttl=60)
    return result


@router.post("", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def create_game(
    body: GameCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game.create")),
):
    # Validate provider
    provider = await session.get(GameProvider, body.provider_id)
    if not provider:
        raise HTTPException(status_code=400, detail="Provider not found")

    # Check code uniqueness
    existing = await session.execute(
        select(Game).where(Game.code == body.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Game code already exists")

    game = Game(**body.model_dump())
    session.add(game)
    await session.commit()
    await session.refresh(game)
    await cache_delete_pattern("games:list")
    return await _build_game_response(session, game)


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game.view")),
):
    game = await session.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return await _build_game_response(session, game)


@router.put("/{game_id}", response_model=GameResponse)
async def update_game(
    game_id: int,
    body: GameUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game.update")),
):
    game = await session.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(game, field, value)
    game.updated_at = datetime.utcnow()

    session.add(game)
    await session.commit()
    await session.refresh(game)
    await cache_delete_pattern("games:list")
    return await _build_game_response(session, game)


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game(
    game_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game.delete")),
):
    game = await session.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Soft delete
    game.is_active = False
    game.updated_at = datetime.utcnow()
    session.add(game)
    await session.commit()
    await cache_delete_pattern("games:list")
