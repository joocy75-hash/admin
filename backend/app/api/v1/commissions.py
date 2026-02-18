"""Commission management: policies, overrides, ledger, webhooks."""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.commission import (
    AgentCommissionOverride,
    CommissionLedger,
    CommissionPolicy,
)
from app.schemas.commission import (
    BetWebhook,
    CommissionPolicyCreate,
    CommissionPolicyListResponse,
    CommissionPolicyResponse,
    CommissionPolicyUpdate,
    LedgerListResponse,
    LedgerResponse,
    LedgerSummary,
    OverrideCreate,
    OverrideResponse,
    OverrideUpdate,
    RoundResultWebhook,
)
from app.services.commission_engine import (
    calculate_losing_commission,
    calculate_rolling_commission,
)

router = APIRouter(prefix="/commissions", tags=["commissions"])


# ─── Policy CRUD ──────────────────────────────────────────────────

@router.get("/policies", response_model=CommissionPolicyListResponse)
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    game_category: str | None = Query(None),
    active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.view")),
):
    base = select(CommissionPolicy)
    if type_filter:
        base = base.where(CommissionPolicy.type == type_filter)
    if game_category:
        base = base.where(CommissionPolicy.game_category == game_category)
    if active is not None:
        base = base.where(CommissionPolicy.active == active)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(CommissionPolicy.type, CommissionPolicy.priority.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    policies = result.scalars().all()

    return CommissionPolicyListResponse(
        items=[CommissionPolicyResponse.model_validate(p) for p in policies],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/policies", response_model=CommissionPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    body: CommissionPolicyCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.create")),
):
    policy = CommissionPolicy(
        name=body.name,
        type=body.type,
        level_rates=body.level_rates,
        game_category=body.game_category,
        min_bet_amount=body.min_bet_amount,
        active=body.active,
        priority=body.priority,
    )
    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return CommissionPolicyResponse.model_validate(policy)


@router.get("/policies/{policy_id}", response_model=CommissionPolicyResponse)
async def get_policy(
    policy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.view")),
):
    policy = await session.get(CommissionPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return CommissionPolicyResponse.model_validate(policy)


@router.put("/policies/{policy_id}", response_model=CommissionPolicyResponse)
async def update_policy(
    policy_id: int,
    body: CommissionPolicyUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.update")),
):
    policy = await session.get(CommissionPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)
    policy.updated_at = datetime.utcnow()

    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return CommissionPolicyResponse.model_validate(policy)


@router.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.delete")),
):
    policy = await session.get(CommissionPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    # Check if ledger entries exist
    ledger_count = (await session.execute(
        select(func.count()).where(CommissionLedger.policy_id == policy_id)
    )).scalar() or 0

    if ledger_count > 0:
        # Soft delete (deactivate) if ledger entries exist
        policy.active = False
        policy.updated_at = datetime.utcnow()
        session.add(policy)
        await session.commit()
    else:
        await session.delete(policy)
        await session.commit()


# ─── Agent Override CRUD ──────────────────────────────────────────

@router.get("/overrides", response_model=list[OverrideResponse])
async def list_overrides(
    agent_id: int | None = Query(None),
    policy_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.view")),
):
    stmt = (
        select(
            AgentCommissionOverride,
            AdminUser.username,
            AdminUser.agent_code,
            CommissionPolicy.name.label("policy_name"),
        )
        .join(AdminUser, AdminUser.id == AgentCommissionOverride.admin_user_id)
        .join(CommissionPolicy, CommissionPolicy.id == AgentCommissionOverride.policy_id)
    )
    if agent_id:
        stmt = stmt.where(AgentCommissionOverride.admin_user_id == agent_id)
    if policy_id:
        stmt = stmt.where(AgentCommissionOverride.policy_id == policy_id)

    stmt = stmt.order_by(AgentCommissionOverride.id.desc())
    result = await session.execute(stmt)
    rows = result.all()

    return [
        OverrideResponse(
            id=row[0].id,
            admin_user_id=row[0].admin_user_id,
            policy_id=row[0].policy_id,
            custom_rates=row[0].custom_rates,
            active=row[0].active,
            created_at=row[0].created_at,
            agent_username=row[1],
            agent_code=row[2],
            policy_name=row[3],
        )
        for row in rows
    ]


@router.post("/overrides", response_model=OverrideResponse, status_code=status.HTTP_201_CREATED)
async def create_override(
    body: OverrideCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.update")),
):
    # Validate agent and policy exist
    agent = await session.get(AdminUser, body.admin_user_id)
    if not agent:
        raise HTTPException(status_code=400, detail="Agent not found")
    policy = await session.get(CommissionPolicy, body.policy_id)
    if not policy:
        raise HTTPException(status_code=400, detail="Policy not found")

    # Check for existing override
    existing = await session.execute(
        select(AgentCommissionOverride).where(
            and_(
                AgentCommissionOverride.admin_user_id == body.admin_user_id,
                AgentCommissionOverride.policy_id == body.policy_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Override already exists for this agent+policy")

    override = AgentCommissionOverride(
        admin_user_id=body.admin_user_id,
        policy_id=body.policy_id,
        custom_rates=body.custom_rates,
        active=body.active,
    )
    session.add(override)
    await session.commit()
    await session.refresh(override)

    return OverrideResponse(
        id=override.id,
        admin_user_id=override.admin_user_id,
        policy_id=override.policy_id,
        custom_rates=override.custom_rates,
        active=override.active,
        created_at=override.created_at,
        agent_username=agent.username,
        agent_code=agent.agent_code,
        policy_name=policy.name,
    )


@router.put("/overrides/{override_id}", response_model=OverrideResponse)
async def update_override(
    override_id: int,
    body: OverrideUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.update")),
):
    override = await session.get(AgentCommissionOverride, override_id)
    if not override:
        raise HTTPException(status_code=404, detail="Override not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(override, field, value)

    session.add(override)
    await session.commit()
    await session.refresh(override)

    agent = await session.get(AdminUser, override.admin_user_id)
    policy = await session.get(CommissionPolicy, override.policy_id)

    return OverrideResponse(
        id=override.id,
        admin_user_id=override.admin_user_id,
        policy_id=override.policy_id,
        custom_rates=override.custom_rates,
        active=override.active,
        created_at=override.created_at,
        agent_username=agent.username if agent else None,
        agent_code=agent.agent_code if agent else None,
        policy_name=policy.name if policy else None,
    )


@router.delete("/overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_override(
    override_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.update")),
):
    override = await session.get(AgentCommissionOverride, override_id)
    if not override:
        raise HTTPException(status_code=404, detail="Override not found")
    await session.delete(override)
    await session.commit()


# ─── Commission Ledger ────────────────────────────────────────────

@router.get("/ledger", response_model=LedgerListResponse)
async def list_ledger(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    agent_id: int | None = Query(None),
    type_filter: str | None = Query(None, alias="type"),
    status_filter: str | None = Query(None, alias="status"),
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.view")),
):
    base = select(CommissionLedger)
    if agent_id:
        base = base.where(CommissionLedger.agent_id == agent_id)
    if type_filter:
        base = base.where(CommissionLedger.type == type_filter)
    if status_filter:
        base = base.where(CommissionLedger.status == status_filter)
    if date_from:
        base = base.where(CommissionLedger.created_at >= datetime.fromisoformat(f"{date_from}T00:00:00"))
    if date_to:
        base = base.where(CommissionLedger.created_at <= datetime.fromisoformat(f"{date_to}T23:59:59"))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Total commission sum
    sum_stmt = select(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).select_from(base.subquery())
    total_commission = (await session.execute(sum_stmt)).scalar() or Decimal("0")

    # Paginated results with agent join
    stmt = (
        base.join(AdminUser, AdminUser.id == CommissionLedger.agent_id, isouter=True)
        .add_columns(AdminUser.username, AdminUser.agent_code)
        .order_by(CommissionLedger.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    rows = result.all()

    items = []
    for row in rows:
        ledger = row[0]
        items.append(LedgerResponse(
            id=ledger.id,
            uuid=str(ledger.uuid),
            agent_id=ledger.agent_id,
            user_id=ledger.user_id,
            policy_id=ledger.policy_id,
            type=ledger.type,
            level=ledger.level,
            source_amount=ledger.source_amount,
            rate=ledger.rate,
            commission_amount=ledger.commission_amount,
            status=ledger.status,
            reference_type=ledger.reference_type,
            reference_id=ledger.reference_id,
            settlement_id=ledger.settlement_id,
            settled_at=ledger.settled_at,
            description=ledger.description,
            created_at=ledger.created_at,
            agent_username=row[1],
            agent_code=row[2],
        ))

    return LedgerListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_commission=total_commission,
    )


@router.get("/ledger/summary", response_model=list[LedgerSummary])
async def ledger_summary(
    agent_id: int | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("commissions.view")),
):
    """Aggregate commission totals by type."""
    base = select(
        CommissionLedger.type,
        func.sum(CommissionLedger.commission_amount).label("total_amount"),
        func.count().label("count"),
    )
    if agent_id:
        base = base.where(CommissionLedger.agent_id == agent_id)
    if date_from:
        base = base.where(CommissionLedger.created_at >= datetime.fromisoformat(f"{date_from}T00:00:00"))
    if date_to:
        base = base.where(CommissionLedger.created_at <= datetime.fromisoformat(f"{date_to}T23:59:59"))

    stmt = base.group_by(CommissionLedger.type)
    result = await session.execute(stmt)

    return [
        LedgerSummary(type=row[0], total_amount=row[1] or Decimal("0"), count=row[2])
        for row in result.all()
    ]


# ─── Webhooks (External Game Events) ─────────────────────────────

@router.post("/webhook/bet", status_code=status.HTTP_201_CREATED)
async def receive_bet_webhook(
    body: BetWebhook,
    session: AsyncSession = Depends(get_session),
):
    """Receive bet event from game backend. Generates rolling commissions."""
    # Verify agent exists
    agent = await session.get(AdminUser, body.agent_id)
    if not agent:
        raise HTTPException(status_code=400, detail="Agent not found")

    # Check duplicate round_id
    existing = await session.execute(
        select(CommissionLedger).where(
            and_(
                CommissionLedger.reference_id == body.round_id,
                CommissionLedger.reference_type == "bet",
            )
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        return {"detail": "Already processed", "entries": 0}

    entries = await calculate_rolling_commission(
        session=session,
        agent_id=body.agent_id,
        user_id=body.user_id,
        game_category=body.game_category,
        bet_amount=body.bet_amount,
        round_id=body.round_id,
        game_code=body.game_code,
    )
    await session.commit()

    return {
        "detail": "Rolling commission processed",
        "entries": len(entries),
        "total": str(sum(e.commission_amount for e in entries)),
    }


@router.post("/webhook/round-result", status_code=status.HTTP_201_CREATED)
async def receive_round_result_webhook(
    body: RoundResultWebhook,
    session: AsyncSession = Depends(get_session),
):
    """Receive game round result from game backend. Generates losing commissions on losses."""
    agent = await session.get(AdminUser, body.agent_id)
    if not agent:
        raise HTTPException(status_code=400, detail="Agent not found")

    if body.result != "lose":
        return {"detail": "No losing commission (not a loss)", "entries": 0}

    # Check duplicate
    existing = await session.execute(
        select(CommissionLedger).where(
            and_(
                CommissionLedger.reference_id == body.round_id,
                CommissionLedger.reference_type == "round_result",
            )
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        return {"detail": "Already processed", "entries": 0}

    entries = await calculate_losing_commission(
        session=session,
        agent_id=body.agent_id,
        user_id=body.user_id,
        game_category=body.game_category,
        bet_amount=body.bet_amount,
        win_amount=body.win_amount,
        round_id=body.round_id,
        game_code=body.game_code,
    )
    await session.commit()

    return {
        "detail": "Losing commission processed",
        "entries": len(entries),
        "total": str(sum(e.commission_amount for e in entries)),
    }
