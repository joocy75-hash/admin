"""Business logic for deposit, withdrawal, and balance adjustment."""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.models.user import User


async def create_deposit(
    session: AsyncSession, user_id: int, amount: Decimal, memo: str | None = None,
    *, coin_type: str | None = None, network: str | None = None,
    tx_hash: str | None = None, wallet_address: str | None = None,
) -> Transaction:
    # Lock user row to get consistent balance_before snapshot
    user_stmt = select(User).where(User.id == user_id).with_for_update()
    user = (await session.execute(user_stmt)).scalar_one_or_none()
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
        coin_type=coin_type,
        network=network,
        tx_hash=tx_hash,
        wallet_address=wallet_address,
        memo=memo,
    )
    session.add(tx)
    return tx


async def create_withdrawal(
    session: AsyncSession, user_id: int, amount: Decimal, memo: str | None = None,
    *, coin_type: str | None = None, network: str | None = None,
    wallet_address: str | None = None,
) -> Transaction:
    # Lock user row to prevent concurrent balance modifications
    user_stmt = select(User).where(User.id == user_id).with_for_update()
    user = (await session.execute(user_stmt)).scalar_one_or_none()
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
        coin_type=coin_type,
        network=network,
        wallet_address=wallet_address,
        memo=memo,
    )
    session.add(tx)
    return tx


async def approve_transaction(session: AsyncSession, tx_id: int, admin_id: int) -> Transaction:
    # Lock transaction row to prevent concurrent approve/reject race condition
    tx_stmt = select(Transaction).where(Transaction.id == tx_id).with_for_update()
    tx = (await session.execute(tx_stmt)).scalar_one_or_none()
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
    tx.processed_at = datetime.now(timezone.utc)
    user.updated_at = datetime.now(timezone.utc)

    session.add(tx)
    session.add(user)
    return tx


async def reject_transaction(session: AsyncSession, tx_id: int, admin_id: int, memo: str | None = None) -> Transaction:
    # Lock transaction row to prevent concurrent approve/reject race condition
    tx_stmt = select(Transaction).where(Transaction.id == tx_id).with_for_update()
    tx = (await session.execute(tx_stmt)).scalar_one_or_none()
    if not tx:
        raise ValueError("Transaction not found")
    if tx.status != "pending":
        raise ValueError(f"Cannot reject: status is {tx.status}")

    tx.status = "rejected"
    tx.processed_by = admin_id
    tx.processed_at = datetime.now(timezone.utc)
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
        processed_at=datetime.now(timezone.utc),
        memo=memo,
    )
    session.add(tx)
    session.add(user)
    user.updated_at = datetime.now(timezone.utc)
    return tx
