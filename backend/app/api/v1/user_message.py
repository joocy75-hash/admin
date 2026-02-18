from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.deps import PermissionChecker
from app.models.admin_user import AdminUser
from app.models.user import User
from app.models.message import Message
from app.schemas.user_message import (
    MessageCreate,
    MessageListResponse,
    MessageResponse,
)

router = APIRouter(prefix="/users", tags=["user-message"])


async def _verify_user(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─── List Messages ─────────────────────────────────────────────────

@router.get("/{user_id}/messages", response_model=MessageListResponse)
async def list_user_messages(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    direction: str | None = Query(None, pattern=r"^(sent|received)$"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.view")),
):
    await _verify_user(session, user_id)

    if direction == "sent":
        base = select(Message).where(
            Message.sender_type == "user",
            Message.sender_id == user_id,
        )
    elif direction == "received":
        base = select(Message).where(
            Message.receiver_type == "user",
            Message.receiver_id == user_id,
        )
    else:
        base = select(Message).where(
            or_(
                and_(Message.sender_type == "user", Message.sender_id == user_id),
                and_(Message.receiver_type == "user", Message.receiver_id == user_id),
            )
        )

    if date_from:
        base = base.where(Message.created_at >= date_from)
    if date_to:
        base = base.where(Message.created_at <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(Message.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    messages = result.scalars().all()

    items = [
        MessageResponse(
            id=m.id,
            sender_type=m.sender_type,
            sender_id=m.sender_id,
            receiver_type=m.receiver_type,
            receiver_id=m.receiver_id,
            title=m.title,
            content=m.content,
            is_read=m.is_read,
            read_at=m.read_at,
            created_at=m.created_at,
        )
        for m in messages
    ]

    return MessageListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ─── Send Message (Admin → User) ──────────────────────────────────

@router.post("/{user_id}/messages", response_model=MessageResponse, status_code=201)
async def send_message_to_user(
    user_id: int,
    body: MessageCreate,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.edit")),
):
    await _verify_user(session, user_id)

    msg = Message(
        sender_type="admin",
        sender_id=current_user.id,
        receiver_type="user",
        receiver_id=user_id,
        title=body.title,
        content=body.content,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)

    return MessageResponse(
        id=msg.id,
        sender_type=msg.sender_type,
        sender_id=msg.sender_id,
        receiver_type=msg.receiver_type,
        receiver_id=msg.receiver_id,
        title=msg.title,
        content=msg.content,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )


# ─── Mark Message as Read ─────────────────────────────────────────

@router.put("/{user_id}/messages/{message_id}/read", response_model=MessageResponse)
async def mark_message_read(
    user_id: int,
    message_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: AdminUser = Depends(PermissionChecker("users.edit")),
):
    await _verify_user(session, user_id)

    stmt = select(Message).where(Message.id == message_id)
    result = await session.execute(stmt)
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if not ((msg.receiver_type == "user" and msg.receiver_id == user_id) or
            (msg.sender_type == "user" and msg.sender_id == user_id)):
        raise HTTPException(status_code=404, detail="Message not found for this user")

    msg.is_read = True
    msg.read_at = datetime.utcnow()
    session.add(msg)
    await session.commit()
    await session.refresh(msg)

    return MessageResponse(
        id=msg.id,
        sender_type=msg.sender_type,
        sender_id=msg.sender_id,
        receiver_type=msg.receiver_type,
        receiver_id=msg.receiver_id,
        title=msg.title,
        content=msg.content,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )
