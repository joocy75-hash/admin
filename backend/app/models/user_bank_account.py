from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class UserBankAccount(SQLModel, table=True):
    __tablename__ = "user_bank_accounts"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    bank_name: str = Field(max_length=50)
    bank_code: str | None = Field(default=None, max_length=20)
    account_number: str = Field(max_length=50)
    holder_name: str = Field(max_length=50)
    is_primary: bool = Field(default=False)
    status: str = Field(default="active", max_length=20)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
