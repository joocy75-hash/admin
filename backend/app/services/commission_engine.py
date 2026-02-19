"""Commission calculation engine with hierarchical waterfall distribution.

Rolling: bet_amount x agent_rate (waterfall: each ancestor earns their_rate - child_rate)
Losing: loss_amount x agent_rate (same waterfall logic, based on weekly net profit)

Hierarchy: parent assigns rates to sub-agents; sub_agent_rate <= parent_rate.
Each agent's commission = their_rate - rate_given_to_child_in_path.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import and_, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser
from app.models.agent_commission_rate import AgentCommissionRate
from app.models.commission import CommissionLedger, CommissionPolicy
from app.models.user import User
from app.services.tree_service import get_ancestors


async def get_agent_rate(
    session: AsyncSession,
    agent_id: int,
    game_category: str,
    commission_type: str,
) -> Decimal:
    """Get an agent's commission rate for a specific game category and type."""
    stmt = select(AgentCommissionRate).where(
        and_(
            AgentCommissionRate.agent_id == agent_id,
            AgentCommissionRate.game_category == game_category,
            AgentCommissionRate.commission_type == commission_type,
        )
    )
    result = await session.execute(stmt)
    rate_row = result.scalar_one_or_none()
    return rate_row.rate if rate_row else Decimal("0")


async def get_agent_rates_bulk(
    session: AsyncSession,
    agent_ids: list[int],
    game_category: str,
    commission_type: str,
) -> dict[int, Decimal]:
    """Batch fetch rates for multiple agents."""
    if not agent_ids:
        return {}
    stmt = select(AgentCommissionRate).where(
        and_(
            AgentCommissionRate.agent_id.in_(agent_ids),
            AgentCommissionRate.game_category == game_category,
            AgentCommissionRate.commission_type == commission_type,
        )
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {r.agent_id: r.rate for r in rows}


def _calc_amount(source: Decimal, rate_pct: Decimal) -> Decimal:
    """Calculate commission: source x (rate / 100), rounded to 2 decimals."""
    return (source * rate_pct / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


async def _find_policy(
    session: AsyncSession,
    commission_type: str,
    game_category: str,
) -> CommissionPolicy | None:
    """Find active policy for reference (min_bet_amount check)."""
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


async def calculate_rolling_commission(
    session: AsyncSession,
    agent_id: int,
    user_id: int,
    game_category: str,
    bet_amount: Decimal,
    round_id: str,
    game_code: str | None = None,
) -> list[CommissionLedger]:
    """Calculate rolling commission using hierarchical waterfall.

    For a bet by user under agent_id:
    - Build chain: agent -> parent -> grandparent -> ... -> root
    - Each agent earns: their_rate - next_child_in_path_rate
    - Bottom agent (direct) earns their full rate
    """
    # Check commission enabled + type must be rolling
    user = await session.get(User, user_id)
    if not user or not user.commission_enabled or user.commission_type != "rolling":
        return []

    policy = await _find_policy(session, "rolling", game_category)
    if policy and bet_amount < policy.min_bet_amount:
        return []

    # Idempotency: skip if already processed for this round
    dup_stmt = select(CommissionLedger).where(
        CommissionLedger.reference_id == round_id,
        CommissionLedger.user_id == user_id,
        CommissionLedger.type == "rolling",
    ).limit(1)
    if (await session.execute(dup_stmt)).scalar_one_or_none():
        return []

    agent = await session.get(AdminUser, agent_id)
    if not agent or agent.status != "active":
        return []

    ancestors = await get_ancestors(session, agent_id)

    # Build chain from bottom (direct agent) to top (root ancestor)
    chain: list[AdminUser] = [agent]
    for anc in ancestors:
        if anc["user"].status == "active":
            chain.append(anc["user"])

    if not chain:
        return []

    # Batch fetch all rates
    all_ids = [a.id for a in chain]
    rates_map = await get_agent_rates_bulk(session, all_ids, game_category, "rolling")

    entries = []
    policy_id = policy.id if policy else None

    for i, agent_user in enumerate(chain):
        my_rate = rates_map.get(agent_user.id, Decimal("0"))
        if my_rate <= 0:
            continue

        # Child rate = rate of the next agent below in the chain
        child_rate = Decimal("0")
        if i > 0:
            child_rate = rates_map.get(chain[i - 1].id, Decimal("0"))

        effective_rate = my_rate - child_rate
        if effective_rate <= 0:
            continue

        amount = _calc_amount(bet_amount, effective_rate)
        if amount <= 0:
            continue

        entry = CommissionLedger(
            agent_id=agent_user.id,
            user_id=user_id,
            policy_id=policy_id,
            type="rolling",
            level=i + 1,
            source_amount=bet_amount,
            rate=effective_rate,
            commission_amount=amount,
            status="pending",
            reference_type="bet",
            reference_id=round_id,
            description=f"Rolling L{i+1} {game_category} {game_code or ''}".strip(),
        )
        session.add(entry)
        entries.append(entry)

        # Atomic balance update to prevent race conditions
        await session.execute(
            sa_update(AdminUser)
            .where(AdminUser.id == agent_user.id)
            .values(pending_balance=AdminUser.pending_balance + amount)
        )

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
    """Calculate losing (죽장) commission using hierarchical waterfall.

    Only applies when user loses (bet > win).
    Commission based on loss amount with waterfall distribution."""
    loss_amount = bet_amount - win_amount
    if loss_amount <= 0:
        return []

    # Check commission enabled + type must be losing
    user = await session.get(User, user_id)
    if not user or not user.commission_enabled or user.commission_type != "losing":
        return []

    policy = await _find_policy(session, "losing", game_category)
    if policy and bet_amount < policy.min_bet_amount:
        return []

    # Idempotency: skip if already processed for this round
    dup_stmt = select(CommissionLedger).where(
        CommissionLedger.reference_id == round_id,
        CommissionLedger.user_id == user_id,
        CommissionLedger.type == "losing",
    ).limit(1)
    if (await session.execute(dup_stmt)).scalar_one_or_none():
        return []

    agent = await session.get(AdminUser, agent_id)
    if not agent or agent.status != "active":
        return []

    ancestors = await get_ancestors(session, agent_id)

    chain: list[AdminUser] = [agent]
    for anc in ancestors:
        if anc["user"].status == "active":
            chain.append(anc["user"])

    if not chain:
        return []

    all_ids = [a.id for a in chain]
    rates_map = await get_agent_rates_bulk(session, all_ids, game_category, "losing")

    entries = []
    policy_id = policy.id if policy else None

    for i, agent_user in enumerate(chain):
        my_rate = rates_map.get(agent_user.id, Decimal("0"))
        if my_rate <= 0:
            continue

        child_rate = Decimal("0")
        if i > 0:
            child_rate = rates_map.get(chain[i - 1].id, Decimal("0"))

        effective_rate = my_rate - child_rate
        if effective_rate <= 0:
            continue

        amount = _calc_amount(loss_amount, effective_rate)
        if amount <= 0:
            continue

        entry = CommissionLedger(
            agent_id=agent_user.id,
            user_id=user_id,
            policy_id=policy_id,
            type="losing",
            level=i + 1,
            source_amount=loss_amount,
            rate=effective_rate,
            commission_amount=amount,
            status="pending",
            reference_type="round_result",
            reference_id=round_id,
            description=f"Losing L{i+1} {game_category} {game_code or ''}".strip(),
        )
        session.add(entry)
        entries.append(entry)

        # Atomic balance update to prevent race conditions
        await session.execute(
            sa_update(AdminUser)
            .where(AdminUser.id == agent_user.id)
            .values(pending_balance=AdminUser.pending_balance + amount)
        )

    return entries


async def validate_rate_against_parent(
    session: AsyncSession,
    agent_id: int,
    game_category: str,
    commission_type: str,
    new_rate: Decimal,
) -> tuple[bool, str]:
    """Validate that new_rate <= parent's rate for the same category/type.
    Returns (is_valid, error_message)."""
    agent = await session.get(AdminUser, agent_id)
    if not agent:
        return False, "Agent not found"

    if agent.parent_id is None:
        # Root agent (super_admin) can set any rate
        return True, ""

    parent_rate = await get_agent_rate(
        session, agent.parent_id, game_category, commission_type
    )

    if new_rate > parent_rate:
        return False, (
            f"Rate {new_rate}% exceeds parent rate {parent_rate}% "
            f"for {game_category}/{commission_type}"
        )

    return True, ""


async def validate_rate_against_children(
    session: AsyncSession,
    agent_id: int,
    game_category: str,
    commission_type: str,
    new_rate: Decimal,
) -> tuple[bool, str]:
    """Validate that new_rate >= max(children's rates) for the same category/type.
    If parent lowers their rate, children's rates must not exceed it."""
    from app.services.tree_service import get_children

    children = await get_children(session, agent_id)
    if not children:
        return True, ""

    child_ids = [c.id for c in children]
    rates_map = await get_agent_rates_bulk(session, child_ids, game_category, commission_type)

    for child in children:
        child_rate = rates_map.get(child.id, Decimal("0"))
        if child_rate > new_rate:
            return False, (
                f"Cannot lower rate to {new_rate}%: child {child.username} "
                f"has rate {child_rate}% for {game_category}/{commission_type}"
            )

    return True, ""
