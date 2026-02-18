from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: int | None = Field(default=None, primary_key=True)
    uuid: UUID = Field(default_factory=uuid4, unique=True)

    user_id: int = Field(index=True)  # External user ID
    type: str = Field(max_length=20, index=True)  # deposit, withdrawal, commission, adjustment
    action: str = Field(max_length=10)  # credit, debit

    amount: Decimal = Field(max_digits=18, decimal_places=2)
    balance_before: Decimal = Field(max_digits=18, decimal_places=2)
    balance_after: Decimal = Field(max_digits=18, decimal_places=2)

    status: str = Field(default="pending", max_length=20, index=True)

    reference_type: str | None = Field(default=None, max_length=50)
    reference_id: str | None = Field(default=None, max_length=100)

    memo: str | None = Field(default=None)
    processed_by: int | None = Field(default=None, foreign_key="admin_users.id")
    processed_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
