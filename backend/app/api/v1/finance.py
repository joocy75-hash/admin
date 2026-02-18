"""Finance/Transaction management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    AdjustmentCreate,
    DepositCreate,
    TransactionAction,
    TransactionListResponse,
    TransactionResponse,
    TransactionSummary,
    WithdrawalCreate,
)
from app.services.transaction_service import (
    approve_transaction,
    create_adjustment,
    create_deposit,
    create_withdrawal,
    reject_transaction,
)

router = APIRouter(prefix="/finance", tags=["finance"])


async def _build_response(session: AsyncSession, tx: Transaction) -> TransactionResponse:
    user = await session.get(User, tx.user_id)
    processor = await session.get(AdminUser, tx.processed_by) if tx.processed_by else None
    return TransactionResponse(
        id=tx.id,
        uuid=str(tx.uuid),
        user_id=tx.user_id,
        user_username=user.username if user else None,
        type=tx.type,
        action=tx.action,
        amount=tx.amount,
        balance_before=tx.balance_before,
        balance_after=tx.balance_after,
        status=tx.status,
        reference_type=tx.reference_type,
        reference_id=tx.reference_id,
        memo=tx.memo,
        processed_by=tx.processed_by,
        processed_by_username=processor.username if processor else None,
        processed_at=tx.processed_at,
        created_at=tx.created_at,
    )


# ─── List Transactions ─────────────────────────────────────────────

@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type_filter: str | None = Query(None, alias="type"),
    status_filter: str | None = Query(None, alias="status"),
    user_id: int | None = Query(None),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("transaction.view")),
):
    base = select(Transaction)
    if type_filter:
        base = base.where(Transaction.type == type_filter)
    if status_filter:
        base = base.where(Transaction.status == status_filter)
    if user_id:
        base = base.where(Transaction.user_id == user_id)
    if start_date:
        start_dt = datetime.combine(
            datetime.strptime(start_date, "%Y-%m-%d").date(),
            datetime.min.time(),
        )
        base = base.where(Transaction.created_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(
            datetime.strptime(end_date, "%Y-%m-%d").date(),
            datetime.max.time(),
        )
        base = base.where(Transaction.created_at <= end_dt)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    sum_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).select_from(base.subquery())
    total_amount = (await session.execute(sum_stmt)).scalar()

    stmt = base.order_by(Transaction.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    transactions = result.scalars().all()

    items = [await _build_response(session, t) for t in transactions]
    return TransactionListResponse(
        items=items, total=total, page=page, page_size=page_size, total_amount=total_amount,
    )


# ─── Get One ────────────────────────────────────────────────────────

@router.get("/transactions/{tx_id}", response_model=TransactionResponse)
async def get_transaction(
    tx_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("transaction.view")),
):
    tx = await session.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return await _build_response(session, tx)


# ─── Summary ────────────────────────────────────────────────────────

@router.get("/transactions/summary", response_model=list[TransactionSummary])
async def transaction_summary(
    user_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("transaction.view")),
):
    base = select(
        Transaction.type,
        Transaction.status,
        func.count().label("count"),
        func.coalesce(func.sum(Transaction.amount), 0).label("total_amount"),
    ).group_by(Transaction.type, Transaction.status)

    if user_id:
        base = base.where(Transaction.user_id == user_id)

    result = await session.execute(base)
    return [
        TransactionSummary(type=r.type, status=r.status, count=r.count, total_amount=r.total_amount)
        for r in result.all()
    ]


# ─── Deposit ────────────────────────────────────────────────────────

@router.post("/deposit", response_model=TransactionResponse, status_code=201)
async def request_deposit(
    body: DepositCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("transaction.create")),
):
    try:
        tx = await create_deposit(session, body.user_id, body.amount, body.memo)
        await session.commit()
        await session.refresh(tx)
        return await _build_response(session, tx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Withdrawal ─────────────────────────────────────────────────────

@router.post("/withdrawal", response_model=TransactionResponse, status_code=201)
async def request_withdrawal(
    body: WithdrawalCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("transaction.create")),
):
    try:
        tx = await create_withdrawal(session, body.user_id, body.amount, body.memo)
        await session.commit()
        await session.refresh(tx)
        return await _build_response(session, tx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Adjustment ─────────────────────────────────────────────────────

@router.post("/adjustment", response_model=TransactionResponse, status_code=201)
async def manual_adjustment(
    body: AdjustmentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.balance")),
):
    try:
        tx = await create_adjustment(
            session, body.user_id, body.action, body.amount, current_user.id, body.memo,
        )
        await session.commit()
        await session.refresh(tx)
        return await _build_response(session, tx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Approve ────────────────────────────────────────────────────────

@router.post("/transactions/{tx_id}/approve", response_model=TransactionResponse)
async def approve_tx(
    tx_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("transaction.approve")),
):
    try:
        tx = await approve_transaction(session, tx_id, current_user.id)
        await session.commit()
        await session.refresh(tx)
        return await _build_response(session, tx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Reject ─────────────────────────────────────────────────────────

@router.post("/transactions/{tx_id}/reject", response_model=TransactionResponse)
async def reject_tx(
    tx_id: int,
    body: TransactionAction = TransactionAction(),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("transaction.reject")),
):
    try:
        tx = await reject_transaction(session, tx_id, current_user.id, body.memo)
        await session.commit()
        await session.refresh(tx)
        return await _build_response(session, tx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
