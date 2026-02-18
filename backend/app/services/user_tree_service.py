"""Closure Table operations for user referral hierarchy."""

from sqlalchemy import delete, select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserTree


async def insert_node(session: AsyncSession, user_id: int, referrer_id: int | None) -> None:
    """Insert a new node into the closure table."""
    # Self-reference (depth 0)
    session.add(UserTree(ancestor_id=user_id, descendant_id=user_id, depth=0))

    if referrer_id:
        stmt = select(UserTree).where(UserTree.descendant_id == referrer_id)
        result = await session.execute(stmt)
        ancestors = result.scalars().all()
        for anc in ancestors:
            session.add(UserTree(
                ancestor_id=anc.ancestor_id,
                descendant_id=user_id,
                depth=anc.depth + 1,
            ))


async def get_descendants(
    session: AsyncSession, user_id: int, max_depth: int | None = None
) -> list[dict]:
    """Get all descendants of a node."""
    stmt = (
        select(User, UserTree.depth)
        .join(UserTree, UserTree.descendant_id == User.id)
        .where(UserTree.ancestor_id == user_id, UserTree.depth > 0)
        .order_by(UserTree.depth, User.username)
    )
    if max_depth:
        stmt = stmt.where(UserTree.depth <= max_depth)

    result = await session.execute(stmt)
    return [{"user": row[0], "depth": row[1]} for row in result.all()]


async def get_children(session: AsyncSession, user_id: int) -> list[User]:
    """Get direct children (depth=1) of a node."""
    stmt = (
        select(User)
        .join(UserTree, UserTree.descendant_id == User.id)
        .where(UserTree.ancestor_id == user_id, UserTree.depth == 1)
        .order_by(User.username)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_ancestors(session: AsyncSession, user_id: int) -> list[dict]:
    """Get all ancestors of a node (path to root)."""
    stmt = (
        select(User, UserTree.depth)
        .join(UserTree, UserTree.ancestor_id == User.id)
        .where(UserTree.descendant_id == user_id, UserTree.depth > 0)
        .order_by(UserTree.depth)
    )
    result = await session.execute(stmt)
    return [{"user": row[0], "depth": row[1]} for row in result.all()]


async def get_descendant_count(session: AsyncSession, user_id: int) -> int:
    """Count all descendants (excluding self)."""
    stmt = (
        select(func.count())
        .select_from(UserTree)
        .where(UserTree.ancestor_id == user_id, UserTree.depth > 0)
    )
    result = await session.execute(stmt)
    return result.scalar() or 0


async def get_direct_referral_count(session: AsyncSession, user_id: int) -> int:
    """Count direct referrals (depth=1 children)."""
    stmt = (
        select(func.count())
        .select_from(UserTree)
        .where(UserTree.ancestor_id == user_id, UserTree.depth == 1)
    )
    result = await session.execute(stmt)
    return result.scalar() or 0


async def has_second_generation(session: AsyncSession, user_id: int) -> bool:
    """Check if user has any descendant at depth >= 2."""
    stmt = (
        select(func.count())
        .select_from(UserTree)
        .where(UserTree.ancestor_id == user_id, UserTree.depth >= 2)
    )
    result = await session.execute(stmt)
    return (result.scalar() or 0) > 0


async def get_subtree_for_tree_view(session: AsyncSession, root_id: int) -> list[dict]:
    """Get full subtree data for tree visualization."""
    stmt = (
        select(User)
        .join(UserTree, UserTree.descendant_id == User.id)
        .where(UserTree.ancestor_id == root_id)
        .order_by(User.depth, User.username)
    )
    result = await session.execute(stmt)
    users = result.scalars().all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "rank": u.rank,
            "status": u.status,
            "depth": u.depth,
            "referrer_id": u.referrer_id,
            "balance": float(u.balance),
            "points": float(u.points),
        }
        for u in users
    ]
