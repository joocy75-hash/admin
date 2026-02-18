"""Auto-promotion logic based on referral tree depth."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.user_tree_service import (
    get_ancestors,
    get_direct_referral_count,
    has_second_generation,
)

RANK_ORDER = {"agency": 0, "distributor": 1, "sub_hq": 2}


async def check_and_promote(session: AsyncSession, user_id: int) -> str | None:
    """Check if user qualifies for rank promotion. Returns new rank or None."""
    user = await session.get(User, user_id)
    if not user:
        return None

    current = RANK_ORDER.get(user.rank, 0)

    # Check sub_hq: has descendant at depth >= 2
    if current < 2 and await has_second_generation(session, user_id):
        user.rank = "sub_hq"
        session.add(user)
        return "sub_hq"

    # Check distributor: has at least 1 direct referral
    if current < 1 and await get_direct_referral_count(session, user_id) >= 1:
        user.rank = "distributor"
        session.add(user)
        return "distributor"

    return None


async def cascade_promotion_check(session: AsyncSession, new_user_id: int) -> list[dict]:
    """When a new user joins, check promotion for all ancestors."""
    promotions = []
    ancestors = await get_ancestors(session, new_user_id)
    for anc in ancestors:
        result = await check_and_promote(session, anc["user"].id)
        if result:
            promotions.append({"user_id": anc["user"].id, "new_rank": result})
    return promotions
