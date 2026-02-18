from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class AdminMemo(SQLModel, table=True):
    __tablename__ = "admin_memos"

    id: int | None = Field(default=None, primary_key=True)
    target_type: str = Field(max_length=20)  # user, agent, transaction
    target_id: int = Field(index=True)
    content: str
    created_by: int | None = Field(default=None, foreign_key="admin_users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
