"""IP restriction management endpoints."""

from datetime import datetime, timezone
from ipaddress import ip_address as parse_ip, ip_network

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.ip_restriction import IpRestriction
from app.schemas.ip_management import (
    BulkIpCreate,
    IpCheckResponse,
    IpRestrictionCreate,
    IpRestrictionListResponse,
    IpRestrictionResponse,
    IpRestrictionUpdate,
    IpStatsResponse,
)

router = APIRouter(prefix="/ip-management", tags=["ip-management"])


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

async def _build_restriction_response(
    session: AsyncSession, restriction: IpRestriction,
) -> IpRestrictionResponse:
    creator = await session.get(AdminUser, restriction.created_by) if restriction.created_by else None
    return IpRestrictionResponse(
        id=restriction.id,
        type=restriction.type,
        ip_address=restriction.ip_address,
        description=restriction.description,
        is_active=restriction.is_active,
        created_by=restriction.created_by,
        created_by_username=creator.username if creator else None,
        created_at=restriction.created_at,
        updated_at=restriction.updated_at,
    )


def _ip_matches(ip_str: str, rule_ip: str) -> bool:
    """Check if an IP matches a rule (exact or CIDR)."""
    try:
        addr = parse_ip(ip_str)
        if "/" in rule_ip:
            return addr in ip_network(rule_ip, strict=False)
        return addr == parse_ip(rule_ip)
    except ValueError:
        return False


# ═══════════════════════════════════════════════════════════════════
# Stats (fixed path, must be before /{id})
# ═══════════════════════════════════════════════════════════════════

@router.get("/stats", response_model=IpStatsResponse)
async def ip_stats(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    stmt = select(
        func.count(case((IpRestriction.type == "whitelist", 1))).label("whitelist_total"),
        func.count(case((IpRestriction.type == "blacklist", 1))).label("blacklist_total"),
        func.count(case((IpRestriction.is_active.is_(True), 1))).label("active"),
        func.count(case((IpRestriction.is_active.is_(False), 1))).label("inactive"),
    )
    result = await session.execute(stmt)
    row = result.one()
    return IpStatsResponse(
        whitelist_total=row.whitelist_total,
        blacklist_total=row.blacklist_total,
        active=row.active,
        inactive=row.inactive,
    )


# ═══════════════════════════════════════════════════════════════════
# Check IP
# ═══════════════════════════════════════════════════════════════════

@router.get("/check/{ip_address:path}", response_model=IpCheckResponse)
async def check_ip(
    ip_address: str,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    # Validate IP format
    try:
        parse_ip(ip_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address format")

    # Check whitelist first
    whitelist_stmt = select(IpRestriction).where(
        IpRestriction.type == "whitelist",
        IpRestriction.is_active.is_(True),
    )
    whitelist_result = await session.execute(whitelist_stmt)
    whitelist_rules = whitelist_result.scalars().all()

    if whitelist_rules:
        for rule in whitelist_rules:
            if _ip_matches(ip_address, rule.ip_address):
                return IpCheckResponse(
                    allowed=True,
                    matched_rule=await _build_restriction_response(session, rule),
                )
        return IpCheckResponse(allowed=False, matched_rule=None)

    # Check blacklist
    blacklist_stmt = select(IpRestriction).where(
        IpRestriction.type == "blacklist",
        IpRestriction.is_active.is_(True),
    )
    blacklist_result = await session.execute(blacklist_stmt)
    blacklist_rules = blacklist_result.scalars().all()

    for rule in blacklist_rules:
        if _ip_matches(ip_address, rule.ip_address):
            return IpCheckResponse(
                allowed=False,
                matched_rule=await _build_restriction_response(session, rule),
            )

    return IpCheckResponse(allowed=True, matched_rule=None)


# ═══════════════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════════════

# ─── List Restrictions ──────────────────────────────────────────

@router.get("/restrictions", response_model=IpRestrictionListResponse)
async def list_restrictions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    is_active: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.view")),
):
    base = select(IpRestriction)

    if type_filter:
        base = base.where(IpRestriction.type == type_filter)
    if is_active is not None:
        base = base.where(IpRestriction.is_active == is_active)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(IpRestriction.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    restrictions = result.scalars().all()

    items = [await _build_restriction_response(session, r) for r in restrictions]
    return IpRestrictionListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Create Restriction ────────────────────────────────────────

@router.post("/restrictions", response_model=IpRestrictionResponse, status_code=status.HTTP_201_CREATED)
async def create_restriction(
    body: IpRestrictionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    restriction = IpRestriction(
        **body.model_dump(),
        created_by=current_user.id,
    )
    session.add(restriction)
    await session.commit()
    await session.refresh(restriction)
    return await _build_restriction_response(session, restriction)


# ─── Update Restriction ────────────────────────────────────────

@router.put("/restrictions/{restriction_id}", response_model=IpRestrictionResponse)
async def update_restriction(
    restriction_id: int,
    body: IpRestrictionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    restriction = await session.get(IpRestriction, restriction_id)
    if not restriction:
        raise HTTPException(status_code=404, detail="IP restriction not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(restriction, field, value)
    restriction.updated_at = datetime.now(timezone.utc)

    session.add(restriction)
    await session.commit()
    await session.refresh(restriction)
    return await _build_restriction_response(session, restriction)


# ─── Delete Restriction ────────────────────────────────────────

@router.delete("/restrictions/{restriction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_restriction(
    restriction_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    restriction = await session.get(IpRestriction, restriction_id)
    if not restriction:
        raise HTTPException(status_code=404, detail="IP restriction not found")

    await session.delete(restriction)
    await session.commit()


# ─── Toggle Restriction ────────────────────────────────────────

@router.post("/restrictions/{restriction_id}/toggle", response_model=IpRestrictionResponse)
async def toggle_restriction(
    restriction_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    restriction = await session.get(IpRestriction, restriction_id)
    if not restriction:
        raise HTTPException(status_code=404, detail="IP restriction not found")

    restriction.is_active = not restriction.is_active
    restriction.updated_at = datetime.now(timezone.utc)

    session.add(restriction)
    await session.commit()
    await session.refresh(restriction)
    return await _build_restriction_response(session, restriction)


# ─── Bulk Add ───────────────────────────────────────────────────

@router.post("/bulk-add", response_model=list[IpRestrictionResponse], status_code=status.HTTP_201_CREATED)
async def bulk_add_restrictions(
    body: BulkIpCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("setting.update")),
):
    created = []
    for item in body.ips:
        restriction = IpRestriction(
            type=item.type,
            ip_address=item.ip_address,
            description=item.description,
            created_by=current_user.id,
        )
        session.add(restriction)
        created.append(restriction)

    await session.commit()
    for r in created:
        await session.refresh(r)

    return [await _build_restriction_response(session, r) for r in created]
