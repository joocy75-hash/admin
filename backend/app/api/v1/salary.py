"""Agent salary config and payment management endpoints."""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.agent_salary_payment import AgentSalaryPayment
from app.models.setting import AgentSalaryConfig
from app.schemas.salary import (
    PaymentActionBody,
    PaymentSummaryResponse,
    SalaryConfigCreate,
    SalaryConfigListResponse,
    SalaryConfigResponse,
    SalaryConfigUpdate,
    SalaryPaymentCreate,
    SalaryPaymentListResponse,
    SalaryPaymentResponse,
)

router = APIRouter(prefix="/salary", tags=["salary"])


# ─── Helpers ─────────────────────────────────────────────────────────

async def _config_response(session: AsyncSession, config: AgentSalaryConfig) -> SalaryConfigResponse:
    agent = await session.get(AdminUser, config.admin_user_id)
    return SalaryConfigResponse(
        id=config.id,
        admin_user_id=config.admin_user_id,
        agent_username=agent.username if agent else None,
        salary_type=config.salary_type,
        base_rate=config.base_rate,
        min_threshold=config.min_threshold,
        active=config.active,
        created_at=config.created_at,
    )


async def _payment_response(session: AsyncSession, payment: AgentSalaryPayment) -> SalaryPaymentResponse:
    agent = await session.get(AdminUser, payment.agent_id)
    approver = await session.get(AdminUser, payment.approved_by) if payment.approved_by else None
    return SalaryPaymentResponse(
        id=payment.id,
        agent_id=payment.agent_id,
        agent_username=agent.username if agent else None,
        config_id=payment.config_id,
        salary_type=payment.salary_type,
        period_start=payment.period_start,
        period_end=payment.period_end,
        base_amount=payment.base_amount,
        performance_bonus=payment.performance_bonus,
        deductions=payment.deductions,
        total_amount=payment.total_amount,
        status=payment.status,
        memo=payment.memo,
        approved_by=payment.approved_by,
        approved_by_username=approver.username if approver else None,
        approved_at=payment.approved_at,
        paid_at=payment.paid_at,
        created_at=payment.created_at,
    )


# ═══════════════════════════════════════════════════════════════════════
# Salary Configs
# ═══════════════════════════════════════════════════════════════════════


@router.get("/configs", response_model=SalaryConfigListResponse)
async def list_salary_configs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    agent_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.view")),
):
    base = select(AgentSalaryConfig)
    if agent_id:
        base = base.where(AgentSalaryConfig.admin_user_id == agent_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(AgentSalaryConfig.admin_user_id, AgentSalaryConfig.salary_type).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    configs = result.scalars().all()

    items = [await _config_response(session, c) for c in configs]
    return SalaryConfigListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/configs", response_model=SalaryConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_salary_config(
    body: SalaryConfigCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    # Validate agent exists
    agent = await session.get(AdminUser, body.admin_user_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Check duplicate (unique constraint: admin_user_id + salary_type)
    stmt = select(AgentSalaryConfig).where(
        AgentSalaryConfig.admin_user_id == body.admin_user_id,
        AgentSalaryConfig.salary_type == body.salary_type,
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Salary config for type '{body.salary_type}' already exists for this agent",
        )

    config = AgentSalaryConfig(
        admin_user_id=body.admin_user_id,
        salary_type=body.salary_type,
        base_rate=body.base_rate,
        min_threshold=body.min_threshold,
        active=body.active,
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)

    return await _config_response(session, config)


@router.put("/configs/{config_id}", response_model=SalaryConfigResponse)
async def update_salary_config(
    config_id: int,
    body: SalaryConfigUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    config = await session.get(AgentSalaryConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Salary config not found")

    update_data = body.model_dump(exclude_unset=True)

    # If salary_type changes, check uniqueness
    if "salary_type" in update_data and update_data["salary_type"] != config.salary_type:
        dup_stmt = select(AgentSalaryConfig).where(
            AgentSalaryConfig.admin_user_id == config.admin_user_id,
            AgentSalaryConfig.salary_type == update_data["salary_type"],
            AgentSalaryConfig.id != config_id,
        )
        if (await session.execute(dup_stmt)).scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Salary config for type '{update_data['salary_type']}' already exists",
            )

    for field, value in update_data.items():
        setattr(config, field, value)

    session.add(config)
    await session.commit()
    await session.refresh(config)

    return await _config_response(session, config)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_salary_config(
    config_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    config = await session.get(AgentSalaryConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Salary config not found")

    # Check for pending/approved payments referencing this config
    stmt = select(func.count()).where(
        AgentSalaryPayment.config_id == config_id,
        AgentSalaryPayment.status.in_(["pending", "approved"]),
    )
    active_payments = (await session.execute(stmt)).scalar() or 0
    if active_payments > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete config with {active_payments} pending/approved payments",
        )

    await session.delete(config)
    await session.commit()


# ═══════════════════════════════════════════════════════════════════════
# Salary Payments
# ═══════════════════════════════════════════════════════════════════════

# NOTE: summary must come before {payment_id} to avoid path conflict
@router.get("/payments/summary", response_model=PaymentSummaryResponse)
async def payment_summary(
    agent_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.view")),
):
    base = select(AgentSalaryPayment)
    if agent_id:
        base = base.where(AgentSalaryPayment.agent_id == agent_id)

    # Count by status
    count_stmt = (
        select(AgentSalaryPayment.status, func.count(), func.coalesce(func.sum(AgentSalaryPayment.total_amount), 0))
        .group_by(AgentSalaryPayment.status)
    )
    if agent_id:
        count_stmt = count_stmt.where(AgentSalaryPayment.agent_id == agent_id)

    result = await session.execute(count_stmt)
    rows = result.all()

    stats = {
        "pending": (0, Decimal("0")),
        "approved": (0, Decimal("0")),
        "paid": (0, Decimal("0")),
        "rejected": (0, Decimal("0")),
    }
    for row_status, count, amount in rows:
        if row_status in stats:
            stats[row_status] = (count, amount)

    return PaymentSummaryResponse(
        total_pending=stats["pending"][0],
        total_approved=stats["approved"][0],
        total_paid=stats["paid"][0],
        total_rejected=stats["rejected"][0],
        pending_amount=stats["pending"][1],
        approved_amount=stats["approved"][1],
        paid_amount=stats["paid"][1],
    )


@router.get("/payments", response_model=SalaryPaymentListResponse)
async def list_salary_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    agent_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.view")),
):
    base = select(AgentSalaryPayment)
    if agent_id:
        base = base.where(AgentSalaryPayment.agent_id == agent_id)
    if status_filter:
        base = base.where(AgentSalaryPayment.status == status_filter)
    if start_date:
        start_dt = datetime.combine(
            datetime.strptime(start_date, "%Y-%m-%d").date(),
            datetime.min.time(),
        )
        base = base.where(AgentSalaryPayment.period_start >= start_dt)
    if end_date:
        end_dt = datetime.combine(
            datetime.strptime(end_date, "%Y-%m-%d").date(),
            datetime.max.time(),
        )
        base = base.where(AgentSalaryPayment.period_end <= end_dt)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(AgentSalaryPayment.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    payments = result.scalars().all()

    items = [await _payment_response(session, p) for p in payments]
    return SalaryPaymentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/payments", response_model=SalaryPaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_salary_payment(
    body: SalaryPaymentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    # Validate agent
    agent = await session.get(AdminUser, body.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Validate config
    config = await session.get(AgentSalaryConfig, body.config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Salary config not found")
    if config.admin_user_id != body.agent_id:
        raise HTTPException(status_code=400, detail="Config does not belong to this agent")
    if not config.active:
        raise HTTPException(status_code=400, detail="Salary config is inactive")

    # Validate period
    if body.period_start >= body.period_end:
        raise HTTPException(status_code=400, detail="period_start must be before period_end")

    # Check for overlapping payment with same config
    overlap_stmt = select(AgentSalaryPayment).where(
        AgentSalaryPayment.agent_id == body.agent_id,
        AgentSalaryPayment.config_id == body.config_id,
        AgentSalaryPayment.status.notin_(["rejected"]),
        AgentSalaryPayment.period_start < body.period_end,
        AgentSalaryPayment.period_end > body.period_start,
    )
    if (await session.execute(overlap_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Overlapping payment period exists for this config")

    total_amount = body.base_amount + body.performance_bonus - body.deductions
    if total_amount < 0:
        raise HTTPException(status_code=400, detail="Total amount cannot be negative")

    payment = AgentSalaryPayment(
        agent_id=body.agent_id,
        config_id=body.config_id,
        salary_type=config.salary_type,
        period_start=body.period_start,
        period_end=body.period_end,
        base_amount=body.base_amount,
        performance_bonus=body.performance_bonus,
        deductions=body.deductions,
        total_amount=total_amount,
        memo=body.memo,
    )
    session.add(payment)
    await session.commit()
    await session.refresh(payment)

    return await _payment_response(session, payment)


@router.post("/payments/{payment_id}/approve", response_model=SalaryPaymentResponse)
async def approve_payment(
    payment_id: int,
    body: PaymentActionBody = PaymentActionBody(),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    payment = await session.get(AgentSalaryPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve payment with status '{payment.status}'")

    payment.status = "approved"
    payment.approved_by = current_user.id
    payment.approved_at = datetime.now(timezone.utc)
    if body.memo:
        payment.memo = body.memo

    session.add(payment)
    await session.commit()
    await session.refresh(payment)

    return await _payment_response(session, payment)


@router.post("/payments/{payment_id}/pay", response_model=SalaryPaymentResponse)
async def pay_payment(
    payment_id: int,
    body: PaymentActionBody = PaymentActionBody(),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    payment = await session.get(AgentSalaryPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != "approved":
        raise HTTPException(status_code=400, detail=f"Cannot pay payment with status '{payment.status}'")

    # Lock agent row and update balance
    agent_stmt = select(AdminUser).where(AdminUser.id == payment.agent_id).with_for_update()
    agent = (await session.execute(agent_stmt)).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.balance += payment.total_amount
    agent.updated_at = datetime.now(timezone.utc)
    session.add(agent)

    payment.status = "paid"
    payment.paid_at = datetime.now(timezone.utc)
    if body.memo:
        payment.memo = body.memo

    session.add(payment)
    await session.commit()
    await session.refresh(payment)

    return await _payment_response(session, payment)


@router.post("/payments/{payment_id}/reject", response_model=SalaryPaymentResponse)
async def reject_payment(
    payment_id: int,
    body: PaymentActionBody = PaymentActionBody(),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("agents.update")),
):
    payment = await session.get(AgentSalaryPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail=f"Cannot reject payment with status '{payment.status}'")

    payment.status = "rejected"
    if body.memo:
        payment.memo = body.memo

    session.add(payment)
    await session.commit()
    await session.refresh(payment)

    return await _payment_response(session, payment)
