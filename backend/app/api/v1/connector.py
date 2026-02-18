"""External game API connector endpoints: status, test, sync, webhook."""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.game import Game, GameProvider
from app.connectors import get_connector
from app.schemas.connector import (
    ConnectorStatusResponse,
    ConnectorTestResponse,
    GameSyncResponse,
    WebhookPayload,
)

router = APIRouter(prefix="/connectors", tags=["connectors"])


# ─── List all connectors with status ────────────────────────────

@router.get("", response_model=list[ConnectorStatusResponse])
async def list_connectors(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.view")),
):
    stmt = select(GameProvider).where(GameProvider.is_active == True).order_by(
        GameProvider.category, GameProvider.name
    )
    result = await session.execute(stmt)
    providers = result.scalars().all()

    items = []
    for p in providers:
        count_stmt = select(func.count()).where(
            Game.provider_id == p.id, Game.is_active == True
        )
        game_count = (await session.execute(count_stmt)).scalar() or 0

        items.append(
            ConnectorStatusResponse(
                provider_id=p.id,
                name=p.name,
                code=p.code,
                category=p.category,
                is_connected=bool(p.api_url and p.api_key),
                last_sync=p.updated_at,
                game_count=game_count,
            )
        )
    return items


# ─── Test connection ─────────────────────────────────────────────

@router.post("/{provider_id}/test", response_model=ConnectorTestResponse)
async def test_connection(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.update")),
):
    provider = await session.get(GameProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if not provider.api_url or not provider.api_key:
        return ConnectorTestResponse(
            success=False,
            message="API URL or API key not configured",
            latency_ms=0,
        )

    connector = get_connector(
        category=provider.category,
        provider_id=provider.id,
        api_url=provider.api_url,
        api_key=provider.api_key,
    )

    start = time.monotonic()
    try:
        authenticated = await connector.authenticate()
        latency = (time.monotonic() - start) * 1000
        return ConnectorTestResponse(
            success=authenticated,
            message="Connection successful" if authenticated else "Authentication failed",
            latency_ms=round(latency, 2),
        )
    except Exception as e:
        latency = (time.monotonic() - start) * 1000
        return ConnectorTestResponse(
            success=False,
            message=f"Connection failed: {str(e)[:200]}",
            latency_ms=round(latency, 2),
        )
    finally:
        await connector.close()


# ─── Sync games from external API ────────────────────────────────

@router.post("/{provider_id}/sync-games", response_model=GameSyncResponse)
async def sync_games(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.update")),
):
    provider = await session.get(GameProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if not provider.api_url or not provider.api_key:
        raise HTTPException(status_code=400, detail="API URL or API key not configured")

    connector = get_connector(
        category=provider.category,
        provider_id=provider.id,
        api_url=provider.api_url,
        api_key=provider.api_key,
    )

    try:
        external_games = await connector.get_games()
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch games from provider: {str(e)[:200]}",
        )
    finally:
        await connector.close()

    new_count = 0
    updated_count = 0

    for eg in external_games:
        code = eg.get("code", "")
        if not code:
            continue

        # Prefix with provider code to ensure uniqueness
        full_code = f"{provider.code}_{code}"

        existing = await session.execute(
            select(Game).where(Game.code == full_code)
        )
        game = existing.scalar_one_or_none()

        if game:
            # Update existing game
            game.name = eg.get("name", game.name)
            game.is_active = eg.get("is_active", game.is_active)
            game.thumbnail_url = eg.get("thumbnail_url", game.thumbnail_url)
            game.updated_at = datetime.now(timezone.utc)
            session.add(game)
            updated_count += 1
        else:
            # Create new game
            game = Game(
                provider_id=provider.id,
                name=eg.get("name", code),
                code=full_code,
                category=eg.get("category", provider.category),
                is_active=eg.get("is_active", True),
                thumbnail_url=eg.get("thumbnail_url"),
            )
            session.add(game)
            new_count += 1

    # Update provider last sync time
    provider.updated_at = datetime.now(timezone.utc)
    session.add(provider)
    await session.commit()

    return GameSyncResponse(
        synced_count=new_count + updated_count,
        new_count=new_count,
        updated_count=updated_count,
    )


# ─── Receive webhook from external provider ──────────────────────

@router.post("/webhook/{provider_code}")
async def receive_webhook(
    provider_code: str,
    body: WebhookPayload,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    # Find provider by code
    stmt = select(GameProvider).where(GameProvider.code == provider_code)
    result = await session.execute(stmt)
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Verify HMAC signature (api_key used as secret for webhook verification)
    signature = request.headers.get("X-Signature", "")
    if provider.api_key:
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing X-Signature header",
            )
        raw_body = await request.body()
        connector = get_connector(
            category=provider.category,
            provider_id=provider.id,
            api_url=provider.api_url or "",
            api_key=provider.api_key,
            api_secret=provider.api_key,
        )
        if not connector.verify_webhook_signature(raw_body, signature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid webhook signature",
            )

    return {
        "status": "received",
        "provider": provider_code,
        "event_type": body.event_type,
    }


# ─── Detailed connector status ───────────────────────────────────

@router.get("/{provider_id}/status", response_model=ConnectorStatusResponse)
async def get_connector_status(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("game_provider.view")),
):
    provider = await session.get(GameProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    count_stmt = select(func.count()).where(
        Game.provider_id == provider.id, Game.is_active == True
    )
    game_count = (await session.execute(count_stmt)).scalar() or 0

    return ConnectorStatusResponse(
        provider_id=provider.id,
        name=provider.name,
        code=provider.code,
        category=provider.category,
        is_connected=bool(provider.api_url and provider.api_key),
        last_sync=provider.updated_at,
        game_count=game_count,
    )
