"""Settlement management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.settlement import Settlement
from app.schemas.settlement import (
    SettlementAction,
    SettlementCreate,
    SettlementListResponse,
    SettlementPreview,
    SettlementResponse,
)
from app.services.settlement_service import (
    confirm_settlement,
    create_settlement,
    pay_settlement,
    preview_settlement,
    reject_settlement,
)

router = APIRouter(prefix="/settlements", tags=["settlements"])

ConfirmedBy = aliased(AdminUser)


def _parse_date(date_str: str) -> datetime:
    return datetime.fromisoformat(f"{date_str}T00:00:00")


def _parse_date_end(date_str: str) -> datetime:
    return datetime.fromisoformat(f"{date_str}T23:59:59")


async def _build_response(session: AsyncSession, s: Settlement) -> SettlementResponse:
    agent = await session.get(AdminUser, s.agent_id)
    confirmed_user = await session.get(AdminUser, s.confirmed_by) if s.confirmed_by else None

    return SettlementResponse(
        id=s.id,
        uuid=str(s.uuid),
        agent_id=s.agent_id,
        period_start=s.period_start,
        period_end=s.period_end,
        rolling_total=s.rolling_total,
        losing_total=s.losing_total,
        deposit_total=s.deposit_total,
        sub_level_total=s.sub_level_total,
        gross_total=s.gross_total,
        deductions=s.deductions,
        net_total=s.net_total,
        status=s.status,
        confirmed_by=s.confirmed_by,
        confirmed_at=s.confirmed_at,
        paid_at=s.paid_at,
        memo=s.memo,
        created_at=s.created_at,
        agent_username=agent.username if agent else None,
        agent_code=agent.agent_code if agent else None,
        confirmed_by_username=confirmed_user.username if confirmed_user else None,
    )


# ─── List ─────────────────────────────────────────────────────────

@router.get("", response_model=SettlementListResponse)
async def list_settlements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    agent_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("settlements.view")),
):
    base = select(Settlement)
    if agent_id:
        base = base.where(Settlement.agent_id == agent_id)
    if status_filter:
        base = base.where(Settlement.status == status_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Settlement.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    settlements = result.scalars().all()

    items = []
    for s in settlements:
        items.append(await _build_response(session, s))

    return SettlementListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Preview ──────────────────────────────────────────────────────

@router.get("/preview", response_model=SettlementPreview)
async def settlement_preview(
    agent_id: int = Query(...),
    period_start: str = Query(..., description="YYYY-MM-DD"),
    period_end: str = Query(..., description="YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("settlements.create")),
):
    try:
        data = await preview_settlement(
            session, agent_id, _parse_date(period_start), _parse_date_end(period_end)
        )
        return SettlementPreview(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Create ───────────────────────────────────────────────────────

@router.post("", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
async def create_settlement_endpoint(
    body: SettlementCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("settlements.create")),
):
    try:
        settlement = await create_settlement(
            session,
            body.agent_id,
            _parse_date(body.period_start),
            _parse_date_end(body.period_end),
            body.memo,
        )
        await session.commit()
        await session.refresh(settlement)
        return await _build_response(session, settlement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Get One ──────────────────────────────────────────────────────

@router.get("/{settlement_id}", response_model=SettlementResponse)
async def get_settlement(
    settlement_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("settlements.view")),
):
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    return await _build_response(session, settlement)


# ─── Confirm ──────────────────────────────────────────────────────

@router.post("/{settlement_id}/confirm", response_model=SettlementResponse)
async def confirm_settlement_endpoint(
    settlement_id: int,
    body: SettlementAction = SettlementAction(),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("settlements.approve")),
):
    try:
        settlement = await confirm_settlement(session, settlement_id, current_user.id)
        if body.memo:
            settlement.memo = body.memo
        await session.commit()
        await session.refresh(settlement)
        return await _build_response(session, settlement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Reject ───────────────────────────────────────────────────────

@router.post("/{settlement_id}/reject", response_model=SettlementResponse)
async def reject_settlement_endpoint(
    settlement_id: int,
    body: SettlementAction = SettlementAction(),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("settlements.approve")),
):
    try:
        settlement = await reject_settlement(session, settlement_id)
        if body.memo:
            settlement.memo = body.memo
        await session.commit()
        await session.refresh(settlement)
        return await _build_response(session, settlement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Pay ──────────────────────────────────────────────────────────

@router.post("/{settlement_id}/pay", response_model=SettlementResponse)
async def pay_settlement_endpoint(
    settlement_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("settlements.approve")),
):
    try:
        settlement = await pay_settlement(session, settlement_id)
        await session.commit()
        await session.refresh(settlement)
        return await _build_response(session, settlement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
