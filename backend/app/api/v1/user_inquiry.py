from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.user import User
from app.models.inquiry import Inquiry, InquiryReply
from app.schemas.user_inquiry import (
    InquiryListResponse,
    InquiryReplyCreate,
    InquiryReplyResponse,
    InquiryResponse,
    InquirySummary,
)

router = APIRouter(prefix="/users", tags=["user-inquiry"])


async def _verify_user(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─── List Inquiries ────────────────────────────────────────────────

@router.get("/{user_id}/inquiries", response_model=InquiryListResponse)
async def list_user_inquiries(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user(session, user_id)

    base = select(Inquiry).where(Inquiry.user_id == user_id)
    if status_filter:
        base = base.where(Inquiry.status == status_filter)
    if date_from:
        base = base.where(Inquiry.created_at >= date_from)
    if date_to:
        base = base.where(Inquiry.created_at <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Summary counts
    summary_stmt = select(
        func.count().label("total_count"),
        func.coalesce(func.sum(case((Inquiry.status == "pending", 1))), 0).label("pending_count"),
        func.coalesce(func.sum(case((Inquiry.status == "answered", 1))), 0).label("answered_count"),
        func.coalesce(func.sum(case((Inquiry.status == "closed", 1))), 0).label("closed_count"),
    ).where(Inquiry.user_id == user_id)
    summary_row = (await session.execute(summary_stmt)).one()

    stmt = base.order_by(Inquiry.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    inquiries = result.scalars().all()

    items = []
    for inq in inquiries:
        reply_stmt = select(InquiryReply).where(InquiryReply.inquiry_id == inq.id).order_by(InquiryReply.created_at)
        reply_result = await session.execute(reply_stmt)
        replies = [
            InquiryReplyResponse(
                id=r.id,
                admin_user_id=r.admin_user_id,
                content=r.content,
                created_at=r.created_at,
            )
            for r in reply_result.scalars().all()
        ]
        items.append(
            InquiryResponse(
                id=inq.id,
                user_id=inq.user_id,
                title=inq.title,
                content=inq.content,
                status=inq.status,
                created_at=inq.created_at,
                updated_at=inq.updated_at,
                replies=replies,
            )
        )

    return InquiryListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        summary=InquirySummary(
            total_count=summary_row.total_count,
            pending_count=summary_row.pending_count,
            answered_count=summary_row.answered_count,
            closed_count=summary_row.closed_count,
        ),
    )


# ─── Get Inquiry Detail ───────────────────────────────────────────

@router.get("/{user_id}/inquiries/{inquiry_id}", response_model=InquiryResponse)
async def get_user_inquiry(
    user_id: int,
    inquiry_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user(session, user_id)

    stmt = select(Inquiry).where(Inquiry.id == inquiry_id, Inquiry.user_id == user_id)
    result = await session.execute(stmt)
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    reply_stmt = select(InquiryReply).where(InquiryReply.inquiry_id == inq.id).order_by(InquiryReply.created_at)
    reply_result = await session.execute(reply_stmt)
    replies = [
        InquiryReplyResponse(
            id=r.id,
            admin_user_id=r.admin_user_id,
            content=r.content,
            created_at=r.created_at,
        )
        for r in reply_result.scalars().all()
    ]

    return InquiryResponse(
        id=inq.id,
        user_id=inq.user_id,
        title=inq.title,
        content=inq.content,
        status=inq.status,
        created_at=inq.created_at,
        updated_at=inq.updated_at,
        replies=replies,
    )


# ─── Reply to Inquiry ─────────────────────────────────────────────

@router.post("/{user_id}/inquiries/{inquiry_id}/reply", response_model=InquiryReplyResponse, status_code=201)
async def reply_to_inquiry(
    user_id: int,
    inquiry_id: int,
    body: InquiryReplyCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.update")),
):
    await _verify_user(session, user_id)

    stmt = select(Inquiry).where(Inquiry.id == inquiry_id, Inquiry.user_id == user_id)
    result = await session.execute(stmt)
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    reply = InquiryReply(
        inquiry_id=inquiry_id,
        admin_user_id=current_user.id,
        content=body.content,
    )
    session.add(reply)

    inq.status = "answered"
    inq.updated_at = datetime.now(timezone.utc)
    session.add(inq)

    await session.commit()
    await session.refresh(reply)

    return InquiryReplyResponse(
        id=reply.id,
        admin_user_id=reply.admin_user_id,
        content=reply.content,
        created_at=reply.created_at,
    )
