"""Commission calculation engine for rolling and losing commissions.

Rolling: bet_amount × rate (per ancestor level)
Losing: (bet_amount - win_amount) × rate (per ancestor level, only on user loss)
"""

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser
from app.models.commission import (
    AgentCommissionOverride,
    CommissionLedger,
    CommissionPolicy,
)
from app.services.tree_service import get_ancestors


async def _find_policy(
    session: AsyncSession,
    commission_type: str,
    game_category: str,
) -> CommissionPolicy | None:
    """Find the best matching active policy.
    Priority: category-specific > generic (no category), higher priority first."""
    # Try category-specific first
    stmt = (
        select(CommissionPolicy)
        .where(
            CommissionPolicy.type == commission_type,
            CommissionPolicy.game_category == game_category,
            CommissionPolicy.active == True,
        )
        .order_by(CommissionPolicy.priority.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    policy = result.scalar_one_or_none()
    if policy:
        return policy

    # Fallback to generic (no category)
    stmt = (
        select(CommissionPolicy)
        .where(
            CommissionPolicy.type == commission_type,
            CommissionPolicy.game_category.is_(None),
            CommissionPolicy.active == True,
        )
        .order_by(CommissionPolicy.priority.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _get_override_rates(
    session: AsyncSession,
    agent_id: int,
    policy_id: int,
) -> dict[str, float] | None:
    """Get agent-specific rate overrides for a policy."""
    stmt = select(AgentCommissionOverride).where(
        and_(
            AgentCommissionOverride.admin_user_id == agent_id,
            AgentCommissionOverride.policy_id == policy_id,
            AgentCommissionOverride.active == True,
        )
    )
    result = await session.execute(stmt)
    override = result.scalar_one_or_none()
    if override and override.custom_rates:
        return override.custom_rates
    return None


def _calc_amount(source: Decimal, rate_pct: float) -> Decimal:
    """Calculate commission: source × (rate / 100), rounded to 2 decimals."""
    return (source * Decimal(str(rate_pct)) / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


async def calculate_rolling_commission(
    session: AsyncSession,
    agent_id: int,
    user_id: int,
    game_category: str,
    bet_amount: Decimal,
    round_id: str,
    game_code: str | None = None,
) -> list[CommissionLedger]:
    """Calculate rolling commission for a bet event.
    Distributes commission up the agent tree based on level_rates."""
    policy = await _find_policy(session, "rolling", game_category)
    if not policy:
        return []

    if bet_amount < policy.min_bet_amount:
        return []

    # Get the agent and their ancestors
    ancestors = await get_ancestors(session, agent_id)

    # Build ancestor chain: level 1 = direct agent, level 2 = parent, etc.
    chain = []
    agent = await session.get(AdminUser, agent_id)
    if agent and agent.status == "active":
        chain.append({"user": agent, "level": 1})
    for anc in ancestors:
        if anc["user"].status == "active":
            chain.append({"user": anc["user"], "level": anc["depth"] + 1})

    entries = []
    for item in chain:
        level_key = str(item["level"])
        agent_user = item["user"]

        # Check override first
        override_rates = await _get_override_rates(session, agent_user.id, policy.id)
        rates = override_rates or policy.level_rates

        rate = rates.get(level_key)
        if rate is None or rate <= 0:
            continue

        amount = _calc_amount(bet_amount, rate)
        if amount <= 0:
            continue

        entry = CommissionLedger(
            agent_id=agent_user.id,
            user_id=user_id,
            policy_id=policy.id,
            type="rolling",
            level=item["level"],
            source_amount=bet_amount,
            rate=Decimal(str(rate)),
            commission_amount=amount,
            status="pending",
            reference_type="bet",
            reference_id=round_id,
            description=f"Rolling L{item['level']} {game_category} {game_code or ''}".strip(),
        )
        session.add(entry)
        entries.append(entry)

        # Update agent pending balance
        agent_user.pending_balance += amount
        session.add(agent_user)

    return entries


async def calculate_losing_commission(
    session: AsyncSession,
    agent_id: int,
    user_id: int,
    game_category: str,
    bet_amount: Decimal,
    win_amount: Decimal,
    round_id: str,
    game_code: str | None = None,
) -> list[CommissionLedger]:
    """Calculate losing (죽장) commission for a game round result.
    Only applies when user loses (bet > win). Commission based on loss amount."""
    loss_amount = bet_amount - win_amount
    if loss_amount <= 0:
        return []

    policy = await _find_policy(session, "losing", game_category)
    if not policy:
        return []

    if bet_amount < policy.min_bet_amount:
        return []

    ancestors = await get_ancestors(session, agent_id)

    chain = []
    agent = await session.get(AdminUser, agent_id)
    if agent and agent.status == "active":
        chain.append({"user": agent, "level": 1})
    for anc in ancestors:
        if anc["user"].status == "active":
            chain.append({"user": anc["user"], "level": anc["depth"] + 1})

    entries = []
    for item in chain:
        level_key = str(item["level"])
        agent_user = item["user"]

        override_rates = await _get_override_rates(session, agent_user.id, policy.id)
        rates = override_rates or policy.level_rates

        rate = rates.get(level_key)
        if rate is None or rate <= 0:
            continue

        amount = _calc_amount(loss_amount, rate)
        if amount <= 0:
            continue

        entry = CommissionLedger(
            agent_id=agent_user.id,
            user_id=user_id,
            policy_id=policy.id,
            type="losing",
            level=item["level"],
            source_amount=loss_amount,
            rate=Decimal(str(rate)),
            commission_amount=amount,
            status="pending",
            reference_type="round_result",
            reference_id=round_id,
            description=f"Losing L{item['level']} {game_category} {game_code or ''}".strip(),
        )
        session.add(entry)
        entries.append(entry)

        agent_user.pending_balance += amount
        session.add(agent_user)

    return entries
