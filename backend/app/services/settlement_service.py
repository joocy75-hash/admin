"""Settlement service: preview, create, confirm, reject, pay."""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser
from app.models.commission import CommissionLedger
from app.models.settlement import Settlement


async def _check_duplicate_settlement(
    session: AsyncSession,
    agent_id: int,
    period_start: datetime,
    period_end: datetime,
) -> None:
    stmt = select(Settlement).where(
        and_(
            Settlement.agent_id == agent_id,
            Settlement.status.in_(["draft", "confirmed"]),
            Settlement.period_start <= period_end,
            Settlement.period_end >= period_start,
        )
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        raise ValueError(
            f"Overlapping settlement already exists (id={existing.id}, "
            f"period={existing.period_start.date()}~{existing.period_end.date()})"
        )


async def preview_settlement(
    session: AsyncSession,
    agent_id: int,
    period_start: datetime,
    period_end: datetime,
) -> dict:
    agent = await session.get(AdminUser, agent_id)
    if not agent:
        raise ValueError("Agent not found")

    base = select(
        CommissionLedger.type,
        func.sum(CommissionLedger.commission_amount).label("total"),
        func.count().label("cnt"),
    ).where(
        and_(
            CommissionLedger.agent_id == agent_id,
            CommissionLedger.status == "pending",
            CommissionLedger.created_at >= period_start,
            CommissionLedger.created_at <= period_end,
        )
    ).group_by(CommissionLedger.type)

    result = await session.execute(base)
    rows = result.all()

    totals = {"rolling": Decimal("0"), "losing": Decimal("0"), "deposit": Decimal("0")}
    total_entries = 0
    for row in rows:
        totals[row[0]] = row[1] or Decimal("0")
        total_entries += row[2]

    gross = sum(totals.values())

    return {
        "agent_id": agent_id,
        "agent_username": agent.username,
        "period_start": period_start.strftime("%Y-%m-%d"),
        "period_end": period_end.strftime("%Y-%m-%d"),
        "rolling_total": totals["rolling"],
        "losing_total": totals["losing"],
        "deposit_total": totals["deposit"],
        "gross_total": gross,
        "pending_entries": total_entries,
    }


async def create_settlement(
    session: AsyncSession,
    agent_id: int,
    period_start: datetime,
    period_end: datetime,
    memo: str | None = None,
) -> Settlement:
    await _check_duplicate_settlement(session, agent_id, period_start, period_end)

    # Lock pending ledger entries to prevent concurrent settlement creation
    lock_stmt = (
        select(CommissionLedger)
        .where(
            and_(
                CommissionLedger.agent_id == agent_id,
                CommissionLedger.status == "pending",
                CommissionLedger.settlement_id.is_(None),
                CommissionLedger.created_at >= period_start,
                CommissionLedger.created_at <= period_end,
            )
        )
        .with_for_update()
    )
    locked_result = await session.execute(lock_stmt)
    locked_entries = locked_result.scalars().all()

    if not locked_entries:
        raise ValueError("No pending commissions in this period")

    totals: dict[str, Decimal] = {"rolling": Decimal("0"), "losing": Decimal("0"), "deposit": Decimal("0")}
    for entry in locked_entries:
        if entry.type in totals:
            totals[entry.type] += entry.commission_amount

    gross = sum(totals.values())

    settlement = Settlement(
        agent_id=agent_id,
        period_start=period_start,
        period_end=period_end,
        rolling_total=totals["rolling"],
        losing_total=totals["losing"],
        deposit_total=totals["deposit"],
        gross_total=gross,
        net_total=gross,
        status="draft",
        memo=memo,
    )
    session.add(settlement)
    await session.flush()

    # Link locked entries to this settlement
    entry_ids = [e.id for e in locked_entries]
    stmt = (
        update(CommissionLedger)
        .where(CommissionLedger.id.in_(entry_ids))
        .values(settlement_id=settlement.id)
    )
    await session.execute(stmt)

    return settlement


async def confirm_settlement(
    session: AsyncSession,
    settlement_id: int,
    confirmed_by: int,
) -> Settlement:
    """Confirm a draft settlement."""
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise ValueError("Settlement not found")
    if settlement.status != "draft":
        raise ValueError(f"Cannot confirm: status is '{settlement.status}'")

    settlement.status = "confirmed"
    settlement.confirmed_by = confirmed_by
    settlement.confirmed_at = datetime.now(timezone.utc)
    session.add(settlement)

    return settlement


async def reject_settlement(
    session: AsyncSession,
    settlement_id: int,
) -> Settlement:
    """Reject a draft settlement. Unlinks ledger entries."""
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise ValueError("Settlement not found")
    if settlement.status != "draft":
        raise ValueError(f"Cannot reject: status is '{settlement.status}'")

    settlement.status = "rejected"
    session.add(settlement)

    # Unlink ledger entries
    stmt = (
        update(CommissionLedger)
        .where(CommissionLedger.settlement_id == settlement_id)
        .values(settlement_id=None)
    )
    await session.execute(stmt)

    return settlement


async def pay_settlement(
    session: AsyncSession,
    settlement_id: int,
) -> Settlement:
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise ValueError("Settlement not found")
    if settlement.status != "confirmed":
        raise ValueError(f"Cannot pay: status is '{settlement.status}'")

    now = datetime.now(timezone.utc)
    stmt = (
        update(CommissionLedger)
        .where(CommissionLedger.settlement_id == settlement_id)
        .values(status="settled", settled_at=now)
    )
    await session.execute(stmt)

    # Lock agent row to prevent concurrent balance updates
    agent_stmt = (
        select(AdminUser)
        .where(AdminUser.id == settlement.agent_id)
        .with_for_update()
    )
    agent = (await session.execute(agent_stmt)).scalar_one_or_none()
    if agent:
        agent.balance += settlement.net_total
        agent.pending_balance -= settlement.net_total
        if agent.pending_balance < 0:
            agent.pending_balance = Decimal("0")
        session.add(agent)

    settlement.status = "paid"
    settlement.paid_at = now
    session.add(settlement)

    return settlement
