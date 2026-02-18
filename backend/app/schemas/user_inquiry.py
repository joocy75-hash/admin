from datetime import datetime

from pydantic import BaseModel


class InquiryReplyResponse(BaseModel):
    id: int
    admin_user_id: int
    content: str
    created_at: datetime


class InquirySummary(BaseModel):
    total_count: int
    pending_count: int
    answered_count: int
    closed_count: int


class InquiryResponse(BaseModel):
    id: int
    user_id: int
    title: str
    content: str
    status: str
    created_at: datetime
    updated_at: datetime
    replies: list[InquiryReplyResponse] = []


class InquiryListResponse(BaseModel):
    items: list[InquiryResponse]
    total: int
    page: int
    page_size: int
    summary: InquirySummary


class InquiryReplyCreate(BaseModel):
    content: str
