"""Closure Table operations for agent hierarchy."""

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser, AdminUserTree


async def insert_node(session: AsyncSession, user_id: int, parent_id: int | None) -> None:
    """Insert a new node into the closure table.
    Creates self-reference + copies all ancestor paths from parent."""
    # Self-reference (depth 0)
    session.add(AdminUserTree(ancestor_id=user_id, descendant_id=user_id, depth=0))

    if parent_id:
        # Copy all ancestor paths from parent, incrementing depth by 1
        stmt = select(AdminUserTree).where(AdminUserTree.descendant_id == parent_id)
        result = await session.execute(stmt)
        ancestors = result.scalars().all()
        for anc in ancestors:
            session.add(AdminUserTree(
                ancestor_id=anc.ancestor_id,
                descendant_id=user_id,
                depth=anc.depth + 1,
            ))


async def get_descendants(
    session: AsyncSession, user_id: int, max_depth: int | None = None
) -> list[dict]:
    """Get all descendants of a node. Returns list of {user, depth}."""
    stmt = (
        select(AdminUser, AdminUserTree.depth)
        .join(AdminUserTree, AdminUserTree.descendant_id == AdminUser.id)
        .where(
            AdminUserTree.ancestor_id == user_id,
            AdminUserTree.depth > 0,
        )
        .order_by(AdminUserTree.depth, AdminUser.agent_code)
    )
    if max_depth:
        stmt = stmt.where(AdminUserTree.depth <= max_depth)

    result = await session.execute(stmt)
    return [{"user": row[0], "depth": row[1]} for row in result.all()]


async def get_children(session: AsyncSession, user_id: int) -> list[AdminUser]:
    """Get direct children (depth=1) of a node."""
    stmt = (
        select(AdminUser)
        .join(AdminUserTree, AdminUserTree.descendant_id == AdminUser.id)
        .where(
            AdminUserTree.ancestor_id == user_id,
            AdminUserTree.depth == 1,
        )
        .order_by(AdminUser.agent_code)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_ancestors(session: AsyncSession, user_id: int) -> list[dict]:
    """Get all ancestors of a node (path to root). Returns list of {user, depth}."""
    stmt = (
        select(AdminUser, AdminUserTree.depth)
        .join(AdminUserTree, AdminUserTree.ancestor_id == AdminUser.id)
        .where(
            AdminUserTree.descendant_id == user_id,
            AdminUserTree.depth > 0,
        )
        .order_by(AdminUserTree.depth)
    )
    result = await session.execute(stmt)
    return [{"user": row[0], "depth": row[1]} for row in result.all()]


async def get_descendant_count(session: AsyncSession, user_id: int) -> int:
    """Count all descendants (excluding self)."""
    stmt = (
        select(func.count())
        .select_from(AdminUserTree)
        .where(
            AdminUserTree.ancestor_id == user_id,
            AdminUserTree.depth > 0,
        )
    )
    result = await session.execute(stmt)
    return result.scalar() or 0


async def get_subtree_for_tree_view(session: AsyncSession, root_id: int) -> list[dict]:
    """Get full subtree data for tree visualization.
    Returns flat list of nodes with parent_id for d3-tree reconstruction."""
    stmt = (
        select(AdminUser)
        .join(AdminUserTree, AdminUserTree.descendant_id == AdminUser.id)
        .where(AdminUserTree.ancestor_id == root_id)
        .order_by(AdminUser.depth, AdminUser.agent_code)
    )
    result = await session.execute(stmt)
    users = result.scalars().all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "agent_code": u.agent_code,
            "role": u.role,
            "status": u.status,
            "depth": u.depth,
            "parent_id": u.parent_id,
            "balance": float(u.balance),
        }
        for u in users
    ]


async def move_node(session: AsyncSession, node_id: int, new_parent_id: int) -> None:
    """Move a node (and its subtree) to a new parent.
    1. Delete old ancestor links (except subtree-internal ones)
    2. Insert new ancestor links via new parent"""

    # Get all descendants (including self) of the node being moved
    sub_stmt = select(AdminUserTree.descendant_id).where(
        AdminUserTree.ancestor_id == node_id
    )
    sub_result = await session.execute(sub_stmt)
    subtree_ids = [r[0] for r in sub_result.all()]

    # Delete links from ancestors OUTSIDE the subtree to nodes INSIDE the subtree
    del_stmt = delete(AdminUserTree).where(
        and_(
            AdminUserTree.descendant_id.in_(subtree_ids),
            AdminUserTree.ancestor_id.notin_(subtree_ids),
        )
    )
    await session.execute(del_stmt)

    # Get all ancestors of the new parent (including self-reference)
    anc_stmt = select(AdminUserTree).where(AdminUserTree.descendant_id == new_parent_id)
    anc_result = await session.execute(anc_stmt)
    new_ancestors = anc_result.scalars().all()

    # Get subtree internal links (node_id as ancestor)
    internal_stmt = select(AdminUserTree).where(AdminUserTree.ancestor_id == node_id)
    internal_result = await session.execute(internal_stmt)
    internal_links = internal_result.scalars().all()

    # Create cross-product: new_ancestor × subtree_descendant
    for anc in new_ancestors:
        for link in internal_links:
            session.add(AdminUserTree(
                ancestor_id=anc.ancestor_id,
                descendant_id=link.descendant_id,
                depth=anc.depth + 1 + link.depth,
            ))

    # Update depth and parent_id on AdminUser records
    node = await session.get(AdminUser, node_id)
    new_parent = await session.get(AdminUser, new_parent_id)
    depth_diff = new_parent.depth + 1 - node.depth
    node.parent_id = new_parent_id
    node.depth = new_parent.depth + 1
    session.add(node)

    # Update depth for all subtree descendants
    for sid in subtree_ids:
        if sid == node_id:
            continue
        desc = await session.get(AdminUser, sid)
        desc.depth += depth_diff
        session.add(desc)


async def is_ancestor(session: AsyncSession, ancestor_id: int, descendant_id: int) -> bool:
    """Check if ancestor_id is an ancestor of descendant_id."""
    stmt = select(AdminUserTree).where(
        AdminUserTree.ancestor_id == ancestor_id,
        AdminUserTree.descendant_id == descendant_id,
        AdminUserTree.depth > 0,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none() is not None
