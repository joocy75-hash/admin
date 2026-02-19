"""KYC document management endpoints."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PermissionChecker
from app.database import get_session
from app.models.admin_user import AdminUser
from app.models.kyc_document import KycDocument
from app.models.user import User
from app.schemas.kyc import (
    KycDocumentListResponse,
    KycDocumentResponse,
    KycRejectRequest,
    KycStatsResponse,
    KycUserStatusResponse,
)

router = APIRouter(prefix="/kyc", tags=["kyc"])


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

async def _build_document_response(
    session: AsyncSession, doc: KycDocument
) -> KycDocumentResponse:
    user = await session.get(User, doc.user_id)
    reviewer = await session.get(AdminUser, doc.reviewed_by) if doc.reviewed_by else None
    return KycDocumentResponse(
        id=doc.id,
        user_id=doc.user_id,
        user_username=user.username if user else None,
        document_type=doc.document_type,
        document_number=doc.document_number,
        front_image_url=doc.front_image_url,
        back_image_url=doc.back_image_url,
        selfie_image_url=doc.selfie_image_url,
        status=doc.status,
        rejection_reason=doc.rejection_reason,
        reviewed_by=doc.reviewed_by,
        reviewed_by_username=reviewer.username if reviewer else None,
        reviewed_at=doc.reviewed_at,
        expires_at=doc.expires_at,
        submitted_at=doc.submitted_at,
        created_at=doc.created_at,
    )


# ═══════════════════════════════════════════════════════════════════
# Fixed-path endpoints (before /{id})
# ═══════════════════════════════════════════════════════════════════

# ─── KYC Stats ──────────────────────────────────────────────────

@router.get("/stats", response_model=KycStatsResponse)
async def kyc_stats(
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    status_stmt = select(
        KycDocument.status, func.count().label("cnt")
    ).group_by(KycDocument.status)
    result = await session.execute(status_stmt)
    by_status = {r.status: r.cnt for r in result.all()}

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_stmt = select(func.count()).select_from(KycDocument).where(
        KycDocument.submitted_at >= today_start
    )
    today_count = (await session.execute(today_stmt)).scalar() or 0

    return KycStatsResponse(
        pending=by_status.get("pending", 0),
        approved=by_status.get("approved", 0),
        rejected=by_status.get("rejected", 0),
        expired=by_status.get("expired", 0),
        today_submissions=today_count,
    )


# ─── Pending Documents (quick review queue) ─────────────────────

@router.get("/pending", response_model=KycDocumentListResponse)
async def list_pending(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    base = select(KycDocument).where(KycDocument.status == "pending")

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(KycDocument.submitted_at.asc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    docs = result.scalars().all()

    items = [await _build_document_response(session, d) for d in docs]
    return KycDocumentListResponse(items=items, total=total, page=page, page_size=page_size)


# ═══════════════════════════════════════════════════════════════════
# Document endpoints
# ═══════════════════════════════════════════════════════════════════

# ─── List All Documents ─────────────────────────────────────────

@router.get("/documents", response_model=KycDocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    user_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    base = select(KycDocument)

    if status_filter:
        base = base.where(KycDocument.status == status_filter)
    if user_id:
        base = base.where(KycDocument.user_id == user_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(KycDocument.submitted_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await session.execute(stmt)
    docs = result.scalars().all()

    items = [await _build_document_response(session, d) for d in docs]
    return KycDocumentListResponse(items=items, total=total, page=page, page_size=page_size)


# ─── Get Document Detail ────────────────────────────────────────

@router.get("/documents/{doc_id}", response_model=KycDocumentResponse)
async def get_document(
    doc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    doc = await session.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="KYC document not found")
    return await _build_document_response(session, doc)


# ─── Approve Document ───────────────────────────────────────────

@router.post("/documents/{doc_id}/approve", response_model=KycDocumentResponse)
async def approve_document(
    doc_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    doc = await session.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="KYC document not found")
    if doc.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve document with status '{doc.status}'")

    doc.status = "approved"
    doc.reviewed_by = current_user.id
    doc.reviewed_at = datetime.now(timezone.utc)

    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return await _build_document_response(session, doc)


# ─── Reject Document ────────────────────────────────────────────

@router.post("/documents/{doc_id}/reject", response_model=KycDocumentResponse)
async def reject_document(
    doc_id: int,
    body: KycRejectRequest,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    doc = await session.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="KYC document not found")
    if doc.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject document with status '{doc.status}'")

    doc.status = "rejected"
    doc.rejection_reason = body.reason
    doc.reviewed_by = current_user.id
    doc.reviewed_at = datetime.now(timezone.utc)

    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return await _build_document_response(session, doc)


# ─── Request Resubmit ───────────────────────────────────────────

@router.post("/documents/{doc_id}/request-resubmit", response_model=KycDocumentResponse)
async def request_resubmit(
    doc_id: int,
    body: KycRejectRequest | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    doc = await session.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="KYC document not found")
    if doc.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot request resubmit for document with status '{doc.status}'")

    doc.status = "resubmit_requested"
    doc.rejection_reason = body.reason if body else "Resubmission requested"
    doc.reviewed_by = current_user.id
    doc.reviewed_at = datetime.now(timezone.utc)

    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return await _build_document_response(session, doc)


# ═══════════════════════════════════════════════════════════════════
# User KYC status
# ═══════════════════════════════════════════════════════════════════

@router.get("/users/{user_id}/status", response_model=KycUserStatusResponse)
async def get_user_kyc_status(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stmt = (
        select(KycDocument)
        .where(KycDocument.user_id == user_id)
        .order_by(KycDocument.submitted_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    latest = result.scalar_one_or_none()

    if not latest:
        return KycUserStatusResponse(user_id=user_id, status="not_submitted")

    return KycUserStatusResponse(
        user_id=user_id,
        status=latest.status,
        latest_document_id=latest.id,
        document_type=latest.document_type,
        submitted_at=latest.submitted_at,
        reviewed_at=latest.reviewed_at,
    )
