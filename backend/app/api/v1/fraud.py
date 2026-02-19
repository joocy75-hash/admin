"""Fraud Detection System (FDS) endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.fraud_alert import FraudAlert, FraudRule
from app.models.user import User
from app.schemas.fraud import (
    FraudAlertListResponse,
    FraudAlertResponse,
    FraudAlertStatsResponse,
    FraudAlertStatusUpdate,
    FraudRuleCreate,
    FraudRuleListResponse,
    FraudRuleResponse,
    FraudRuleUpdate,
)

router = APIRouter(prefix="/fraud", tags=["fraud"])


# ═══════════════════════════════════════════════════════════════════
# Alert endpoints
# ═══════════════════════════════════════════════════════════════════

async def _build_alert_response(session: AsyncSession, alert: FraudAlert) -> FraudAlertResponse:
    user = await session.get(User, alert.user_id)
    reviewer = await session.get(AdminUser, alert.reviewed_by) if alert.reviewed_by else None
    return FraudAlertResponse(
        id=alert.id,
        user_id=alert.user_id,
        user_username=user.username if user else None,
        alert_type=alert.alert_type,
        severity=alert.severity,
        status=alert.status,
        description=alert.description,
        data=alert.data,
        detected_at=alert.detected_at,
        reviewed_by=alert.reviewed_by,
        reviewed_by_username=reviewer.username if reviewer else None,
        reviewed_at=alert.reviewed_at,
        resolution_note=alert.resolution_note,
    )


# ─── Alert Stats (fixed path, must be before /{alert_id}) ───────

@router.get("/alerts/stats", response_model=FraudAlertStatsResponse)
async def alert_stats(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.view")),
):
    # Count by severity
    severity_stmt = select(
        FraudAlert.severity, func.count().label("cnt")
    ).group_by(FraudAlert.severity)
    severity_result = await session.execute(severity_stmt)
    by_severity = {r.severity: r.cnt for r in severity_result.all()}

    # Count by status
    status_stmt = select(
        FraudAlert.status, func.count().label("cnt")
    ).group_by(FraudAlert.status)
    status_result = await session.execute(status_stmt)
    by_status = {r.status: r.cnt for r in status_result.all()}

    # Count by type
    type_stmt = select(
        FraudAlert.alert_type, func.count().label("cnt")
    ).group_by(FraudAlert.alert_type)
    type_result = await session.execute(type_stmt)
    by_type = {r.alert_type: r.cnt for r in type_result.all()}

    total_stmt = select(func.count()).select_from(FraudAlert)
    total = (await session.execute(total_stmt)).scalar() or 0

    return FraudAlertStatsResponse(
        by_severity=by_severity,
        by_status=by_status,
        by_type=by_type,
        total=total,
    )


# ─── List Alerts ─────────────────────────────────────────────────

@router.get("/alerts", response_model=FraudAlertListResponse)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    alert_type: str | None = Query(None),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.view")),
):
    base = select(FraudAlert)

    if severity:
        base = base.where(FraudAlert.severity == severity)
    if status_filter:
        base = base.where(FraudAlert.status == status_filter)
    if alert_type:
        base = base.where(FraudAlert.alert_type == alert_type)
    if start_date:
        start_dt = datetime.combine(
            datetime.strptime(start_date, "%Y-%m-%d").date(),
            datetime.min.time(),
        )
        base = base.where(FraudAlert.detected_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(
            datetime.strptime(end_date, "%Y-%m-%d").date(),
            datetime.max.time(),
        )
        base = base.where(FraudAlert.detected_at <= end_dt)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(FraudAlert.detected_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    alerts = result.scalars().all()

    items = [await _build_alert_response(session, a) for a in alerts]
    return FraudAlertListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Get Alert Detail ────────────────────────────────────────────

@router.get("/alerts/{alert_id}", response_model=FraudAlertResponse)
async def get_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.view")),
):
    alert = await session.get(FraudAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Fraud alert not found")
    return await _build_alert_response(session, alert)


# ─── Update Alert Status ─────────────────────────────────────────

@router.patch("/alerts/{alert_id}/status", response_model=FraudAlertResponse)
async def update_alert_status(
    alert_id: int,
    body: FraudAlertStatusUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.update")),
):
    alert = await session.get(FraudAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Fraud alert not found")

    alert.status = body.status
    alert.reviewed_by = current_user.id
    alert.reviewed_at = datetime.now(timezone.utc)
    if body.resolution_note:
        alert.resolution_note = body.resolution_note

    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return await _build_alert_response(session, alert)


# ═══════════════════════════════════════════════════════════════════
# Rule endpoints
# ═══════════════════════════════════════════════════════════════════

async def _build_rule_response(session: AsyncSession, rule: FraudRule) -> FraudRuleResponse:
    creator = await session.get(AdminUser, rule.created_by)
    return FraudRuleResponse(
        id=rule.id,
        name=rule.name,
        rule_type=rule.rule_type,
        condition=rule.condition,
        severity=rule.severity,
        is_active=rule.is_active,
        created_by=rule.created_by,
        created_by_username=creator.username if creator else None,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


# ─── List Rules ──────────────────────────────────────────────────

@router.get("/rules", response_model=FraudRuleListResponse)
async def list_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.view")),
):
    base = select(FraudRule)

    if is_active is not None:
        base = base.where(FraudRule.is_active == is_active)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(FraudRule.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    rules = result.scalars().all()

    items = [await _build_rule_response(session, r) for r in rules]
    return FraudRuleListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Create Rule ─────────────────────────────────────────────────

@router.post("/rules", response_model=FraudRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    body: FraudRuleCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.update")),
):
    rule = FraudRule(
        **body.model_dump(),
        created_by=current_user.id,
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return await _build_rule_response(session, rule)


# ─── Update Rule ─────────────────────────────────────────────────

@router.put("/rules/{rule_id}", response_model=FraudRuleResponse)
async def update_rule(
    rule_id: int,
    body: FraudRuleUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.update")),
):
    rule = await session.get(FraudRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Fraud rule not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)
    rule.updated_at = datetime.now(timezone.utc)

    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return await _build_rule_response(session, rule)


# ─── Delete Rule ─────────────────────────────────────────────────

@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.update")),
):
    rule = await session.get(FraudRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Fraud rule not found")

    await session.delete(rule)
    await session.commit()


# ─── Toggle Rule Active/Inactive ─────────────────────────────────

@router.post("/rules/{rule_id}/toggle", response_model=FraudRuleResponse)
async def toggle_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("fraud.update")),
):
    rule = await session.get(FraudRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Fraud rule not found")

    rule.is_active = not rule.is_active
    rule.updated_at = datetime.now(timezone.utc)

    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return await _build_rule_response(session, rule)
