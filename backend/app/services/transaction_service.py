"""Business logic for deposit, withdrawal, and balance adjustment."""

import asyncio
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.models.user import User
from app.utils.events import publish_event


async def create_deposit(session: AsyncSession, user_id: int, amount: Decimal, memo: str | None = None) -> Transaction:
    user = await session.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    tx = Transaction(
        user_id=user_id,
        type="deposit",
        action="credit",
        amount=amount,
        balance_before=user.balance,
        balance_after=user.balance,  # Not applied yet
        status="pending",
        memo=memo,
    )
    session.add(tx)
    asyncio.ensure_future(publish_event("new_deposit", {
        "user_id": user_id, "amount": str(amount), "username": user.username,
    }))
    return tx


async def create_withdrawal(session: AsyncSession, user_id: int, amount: Decimal, memo: str | None = None) -> Transaction:
    user = await session.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    if user.balance < amount:
        raise ValueError(f"Insufficient balance: {user.balance} < {amount}")

    tx = Transaction(
        user_id=user_id,
        type="withdrawal",
        action="debit",
        amount=amount,
        balance_before=user.balance,
        balance_after=user.balance,  # Not applied yet
        status="pending",
        memo=memo,
    )
    session.add(tx)
    asyncio.ensure_future(publish_event("new_withdrawal", {
        "user_id": user_id, "amount": str(amount), "username": user.username,
    }))
    return tx


async def approve_transaction(session: AsyncSession, tx_id: int, admin_id: int) -> Transaction:
    tx = await session.get(Transaction, tx_id)
    if not tx:
        raise ValueError("Transaction not found")
    if tx.status != "pending":
        raise ValueError(f"Cannot approve: status is {tx.status}")

    # Lock user row to prevent concurrent balance modifications
    user_stmt = select(User).where(User.id == tx.user_id).with_for_update()
    user = (await session.execute(user_stmt)).scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    tx.balance_before = user.balance

    if tx.action == "credit":
        user.balance += tx.amount
    elif tx.action == "debit":
        if user.balance < tx.amount:
            raise ValueError(f"Insufficient balance: {user.balance} < {tx.amount}")
        user.balance -= tx.amount

    tx.balance_after = user.balance
    tx.status = "approved"
    tx.processed_by = admin_id
    tx.processed_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()

    session.add(tx)
    session.add(user)
    event_type = "deposit_approved" if tx.type == "deposit" else "withdrawal_approved"
    asyncio.ensure_future(publish_event(event_type, {
        "tx_id": tx.id, "user_id": tx.user_id, "amount": str(tx.amount), "type": tx.type,
    }))
    return tx


async def reject_transaction(session: AsyncSession, tx_id: int, admin_id: int, memo: str | None = None) -> Transaction:
    tx = await session.get(Transaction, tx_id)
    if not tx:
        raise ValueError("Transaction not found")
    if tx.status != "pending":
        raise ValueError(f"Cannot reject: status is {tx.status}")

    tx.status = "rejected"
    tx.processed_by = admin_id
    tx.processed_at = datetime.utcnow()
    if memo:
        tx.memo = memo

    session.add(tx)
    return tx


async def create_adjustment(
    session: AsyncSession,
    user_id: int,
    action: str,
    amount: Decimal,
    admin_id: int,
    memo: str | None = None,
) -> Transaction:
    # Lock user row to prevent concurrent balance modifications
    user_stmt = select(User).where(User.id == user_id).with_for_update()
    user = (await session.execute(user_stmt)).scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    balance_before = user.balance

    if action == "credit":
        user.balance += amount
    elif action == "debit":
        if user.balance < amount:
            raise ValueError(f"Insufficient balance: {user.balance} < {amount}")
        user.balance -= amount

    tx = Transaction(
        user_id=user_id,
        type="adjustment",
        action=action,
        amount=amount,
        balance_before=balance_before,
        balance_after=user.balance,
        status="approved",
        processed_by=admin_id,
        processed_at=datetime.utcnow(),
        memo=memo,
    )
    session.add(tx)
    session.add(user)
    user.updated_at = datetime.utcnow()
    return tx
