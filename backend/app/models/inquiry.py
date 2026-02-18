from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Inquiry(SQLModel, table=True):
    __tablename__ = "inquiries"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(max_length=200)
    content: str
    status: str = Field(default="pending", max_length=20, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InquiryReply(SQLModel, table=True):
    __tablename__ = "inquiry_replies"

    id: int | None = Field(default=None, primary_key=True)
    inquiry_id: int = Field(foreign_key="inquiries.id", index=True)
    admin_user_id: int = Field(foreign_key="admin_users.id")
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
