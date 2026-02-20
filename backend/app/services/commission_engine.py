"""Commission calculation engine with User-based MLM waterfall distribution.

MLM model:
- Users ARE agents. Everyone plays AND earns commission from their referral tree.
- Rolling: bet_amount × user_rate%. Each user + all ancestors in referral tree earn.
- Losing: loss_amount × user_rate%. Same waterfall, only when bettor loses.

Waterfall:
- Self-rolling: bettor earns their own rate as points.
- Referrer chain: each ancestor earns (their_rate - child_rate) as points.
- Commission accumulates in User.points, NOT AdminUser.pending_balance.

Hierarchy uses UserTree (Closure Table) + UserGameRollingRate for per-user rates.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import and_, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commission import CommissionLedger, CommissionPolicy
from app.models.user import User
from app.models.user_game_rolling_rate import UserGameRollingRate
from app.services.user_tree_service import get_ancestors


async def get_user_rate(
    session: AsyncSession,
    user_id: int,
    game_category: str,
    commission_type: str,
) -> Decimal:
    """Get a user's commission rate for a specific game category and type."""
    stmt = select(UserGameRollingRate).where(
        and_(
            UserGameRollingRate.user_id == user_id,
            UserGameRollingRate.game_category == game_category,
            UserGameRollingRate.provider.is_(None),
        )
    )
    result = await session.execute(stmt)
    rate_row = result.scalar_one_or_none()
    if not rate_row:
        return Decimal("0")
    if commission_type == "rolling":
        return rate_row.rolling_rate or Decimal("0")
    return rate_row.losing_rate or Decimal("0")


async def get_user_rates_bulk(
    session: AsyncSession,
    user_ids: list[int],
    game_category: str,
    commission_type: str,
) -> dict[int, Decimal]:
    """Batch fetch rates for multiple users."""
    if not user_ids:
        return {}
    stmt = select(UserGameRollingRate).where(
        and_(
            UserGameRollingRate.user_id.in_(user_ids),
            UserGameRollingRate.game_category == game_category,
            UserGameRollingRate.provider.is_(None),
        )
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    if commission_type == "rolling":
        return {r.user_id: (r.rolling_rate or Decimal("0")) for r in rows}
    return {r.user_id: (r.losing_rate or Decimal("0")) for r in rows}


def _calc_amount(source: Decimal, rate_pct: Decimal) -> Decimal:
    """Calculate commission: source × (rate / 100), rounded to 2 decimals."""
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

    # Fallback: category-agnostic policy
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
    user_id: int,
    game_category: str,
    bet_amount: Decimal,
    round_id: str,
    game_code: str | None = None,
) -> list[CommissionLedger]:
    """Calculate rolling commission using User-based MLM waterfall.

    1. Bettor (self-rolling): earns own rolling_rate% of bet_amount → points
    2. Referrer chain: each ancestor earns (their_rate - child_rate)% → points

    All commission accumulates in User.points via atomic UPDATE.
    """
    bettor = await session.get(User, user_id)
    if not bettor or not bettor.commission_enabled or bettor.commission_type != "rolling":
        return []

    policy = await _find_policy(session, "rolling", game_category)
    if policy and bet_amount < policy.min_bet_amount:
        return []

    # Idempotency: skip if already processed for this round (FOR UPDATE to prevent race)
    dup_stmt = select(CommissionLedger).where(
        CommissionLedger.reference_id == round_id,
        CommissionLedger.user_id == user_id,
        CommissionLedger.type == "rolling",
    ).with_for_update().limit(1)
    if (await session.execute(dup_stmt)).scalar_one_or_none():
        return []

    # Build chain: bettor (self) + all ancestors in referral tree
    ancestors = await get_ancestors(session, user_id)

    # chain[0] = bettor, chain[1] = direct referrer, chain[2] = grandparent, ...
    chain_user_ids = [user_id] + [a["user"].id for a in ancestors if a["user"].status == "active"]

    if not chain_user_ids:
        return []

    # Batch fetch all rolling rates for this game category
    rates_map = await get_user_rates_bulk(session, chain_user_ids, game_category, "rolling")

    entries = []
    policy_id = policy.id if policy else None

    for i, uid in enumerate(chain_user_ids):
        my_rate = rates_map.get(uid, Decimal("0"))
        if my_rate <= 0:
            continue

        if i == 0:
            # Self-rolling: bettor earns their full rate
            effective_rate = my_rate
        else:
            # Waterfall: ancestor earns (their_rate - child_in_path_rate)
            child_uid = chain_user_ids[i - 1]
            child_rate = rates_map.get(child_uid, Decimal("0"))
            effective_rate = my_rate - child_rate
            if effective_rate <= 0:
                continue

        amount = _calc_amount(bet_amount, effective_rate)
        if amount <= 0:
            continue

        entry = CommissionLedger(
            recipient_user_id=uid,
            user_id=user_id,
            policy_id=policy_id,
            type="rolling",
            level=i,
            game_category=game_category,
            source_amount=bet_amount,
            rate=effective_rate,
            commission_amount=amount,
            status="pending",
            reference_type="bet",
            reference_id=round_id,
            description=f"Rolling L{i} {game_category} {game_code or ''}".strip(),
        )
        session.add(entry)
        entries.append(entry)

        # Atomic points update (no SELECT FOR UPDATE needed — atomic UPDATE)
        await session.execute(
            sa_update(User)
            .where(User.id == uid)
            .values(points=User.points + amount)
        )

    return entries


async def calculate_losing_commission(
    session: AsyncSession,
    user_id: int,
    game_category: str,
    bet_amount: Decimal,
    win_amount: Decimal,
    round_id: str,
    game_code: str | None = None,
) -> list[CommissionLedger]:
    """Calculate losing (죽장) commission using User-based MLM waterfall.

    Only applies when user loses (bet > win).
    Commission based on loss_amount with waterfall distribution → User.points.
    """
    loss_amount = bet_amount - win_amount
    if loss_amount <= 0:
        return []

    bettor = await session.get(User, user_id)
    if not bettor or not bettor.commission_enabled or bettor.commission_type != "losing":
        return []

    policy = await _find_policy(session, "losing", game_category)
    if policy and bet_amount < policy.min_bet_amount:
        return []

    # Idempotency check (FOR UPDATE to prevent race)
    dup_stmt = select(CommissionLedger).where(
        CommissionLedger.reference_id == round_id,
        CommissionLedger.user_id == user_id,
        CommissionLedger.type == "losing",
    ).with_for_update().limit(1)
    if (await session.execute(dup_stmt)).scalar_one_or_none():
        return []

    # Build chain: bettor (self) + all ancestors
    ancestors = await get_ancestors(session, user_id)
    chain_user_ids = [user_id] + [a["user"].id for a in ancestors if a["user"].status == "active"]

    if not chain_user_ids:
        return []

    rates_map = await get_user_rates_bulk(session, chain_user_ids, game_category, "losing")

    entries = []
    policy_id = policy.id if policy else None

    for i, uid in enumerate(chain_user_ids):
        my_rate = rates_map.get(uid, Decimal("0"))
        if my_rate <= 0:
            continue

        if i == 0:
            effective_rate = my_rate
        else:
            child_uid = chain_user_ids[i - 1]
            child_rate = rates_map.get(child_uid, Decimal("0"))
            effective_rate = my_rate - child_rate
            if effective_rate <= 0:
                continue

        amount = _calc_amount(loss_amount, effective_rate)
        if amount <= 0:
            continue

        entry = CommissionLedger(
            recipient_user_id=uid,
            user_id=user_id,
            policy_id=policy_id,
            type="losing",
            level=i,
            game_category=game_category,
            source_amount=loss_amount,
            rate=effective_rate,
            commission_amount=amount,
            status="pending",
            reference_type="round_result",
            reference_id=round_id,
            description=f"Losing L{i} {game_category} {game_code or ''}".strip(),
        )
        session.add(entry)
        entries.append(entry)

        # Atomic points update
        await session.execute(
            sa_update(User)
            .where(User.id == uid)
            .values(points=User.points + amount)
        )

    return entries


async def validate_rate_against_parent(
    session: AsyncSession,
    user_id: int,
    game_category: str,
    commission_type: str,
    new_rate: Decimal,
) -> tuple[bool, str]:
    """Validate that new_rate <= parent's rate for the same category/type.

    In the MLM model, the "parent" is the referrer (User.referrer_id).
    """
    user = await session.get(User, user_id)
    if not user:
        return False, "User not found"

    if user.referrer_id is None:
        # Root user (no referrer) can set any rate
        return True, ""

    parent_rate = await get_user_rate(
        session, user.referrer_id, game_category, commission_type
    )

    if new_rate > parent_rate:
        return False, (
            f"Rate {new_rate}% exceeds referrer rate {parent_rate}% "
            f"for {game_category}/{commission_type}"
        )

    return True, ""


async def validate_rate_against_children(
    session: AsyncSession,
    user_id: int,
    game_category: str,
    commission_type: str,
    new_rate: Decimal,
) -> tuple[bool, str]:
    """Validate that new_rate >= max(children's rates) for the same category/type.

    In the MLM model, "children" are users whose referrer_id == user_id.
    """
    from app.services.user_tree_service import get_children

    children = await get_children(session, user_id)
    if not children:
        return True, ""

    child_ids = [c.id for c in children]
    rates_map = await get_user_rates_bulk(session, child_ids, game_category, commission_type)

    for child in children:
        child_rate = rates_map.get(child.id, Decimal("0"))
        if child_rate > new_rate:
            return False, (
                f"Cannot lower rate to {new_rate}%: referral {child.username} "
                f"has rate {child_rate}% for {game_category}/{commission_type}"
            )

    return True, ""
