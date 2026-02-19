"""Admin memo endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_memo import AdminMemo
from app.models.admin_user import AdminUser
from app.schemas.memo import (
    MemoCreate,
    MemoListResponse,
    MemoResponse,
    MemoUpdate,
)

router = APIRouter(prefix="/memos", tags=["memos"])


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

async def _build_memo_response(session: AsyncSession, memo: AdminMemo) -> MemoResponse:
    creator = await session.get(AdminUser, memo.created_by) if memo.created_by else None
    return MemoResponse(
        id=memo.id,
        target_type=memo.target_type,
        target_id=memo.target_id,
        content=memo.content,
        created_by=memo.created_by,
        created_by_username=creator.username if creator else None,
        created_at=memo.created_at,
    )


# ═══════════════════════════════════════════════════════════════════
# Recent (fixed path, must be before /{id})
# ═══════════════════════════════════════════════════════════════════

@router.get("/recent", response_model=list[MemoResponse])
async def recent_memos(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    stmt = select(AdminMemo).order_by(AdminMemo.created_at.desc()).limit(20)
    result = await session.execute(stmt)
    memos = result.scalars().all()
    return [await _build_memo_response(session, m) for m in memos]


# ═══════════════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════════════

# ─── List Memos ─────────────────────────────────────────────────

@router.get("", response_model=MemoListResponse)
async def list_memos(
    target_type: str = Query(...),
    target_id: int = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    base = select(AdminMemo).where(
        AdminMemo.target_type == target_type,
        AdminMemo.target_id == target_id,
    )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(AdminMemo.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    memos = result.scalars().all()

    items = [await _build_memo_response(session, m) for m in memos]
    return MemoListResponse(items=items, total=total)


# ─── Create Memo ────────────────────────────────────────────────

@router.post("", response_model=MemoResponse, status_code=status.HTTP_201_CREATED)
async def create_memo(
    body: MemoCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    memo = AdminMemo(
        **body.model_dump(),
        created_by=current_user.id,
    )
    session.add(memo)
    await session.commit()
    await session.refresh(memo)
    return await _build_memo_response(session, memo)


# ─── Update Memo ────────────────────────────────────────────────

@router.put("/{memo_id}", response_model=MemoResponse)
async def update_memo(
    memo_id: int,
    body: MemoUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    memo = await session.get(AdminMemo, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    if memo.created_by != current_user.id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only the creator or super admin can update this memo")

    memo.content = body.content
    session.add(memo)
    await session.commit()
    await session.refresh(memo)
    return await _build_memo_response(session, memo)


# ─── Delete Memo ────────────────────────────────────────────────

@router.delete("/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memo(
    memo_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    memo = await session.get(AdminMemo, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    if memo.created_by != current_user.id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only the creator or super admin can delete this memo")

    await session.delete(memo)
    await session.commit()
