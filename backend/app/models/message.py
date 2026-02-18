from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: int | None = Field(default=None, primary_key=True)
    sender_type: str = Field(max_length=10)
    sender_id: int = Field(index=True)
    receiver_type: str = Field(max_length=10)
    receiver_id: int = Field(index=True)
    title: str = Field(max_length=200)
    content: str
    is_read: bool = Field(default=False)
    read_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
