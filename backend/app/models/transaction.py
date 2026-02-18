from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: int | None = Field(default=None, primary_key=True)
    uuid: UUID = Field(default_factory=uuid4, unique=True)

    user_id: int = Field(foreign_key="users.id", index=True)
    type: str = Field(max_length=20, index=True)  # deposit, withdrawal, commission, adjustment
    action: str = Field(max_length=10)  # credit, debit

    amount: Decimal = Field(max_digits=18, decimal_places=2)
    balance_before: Decimal = Field(max_digits=18, decimal_places=2)
    balance_after: Decimal = Field(max_digits=18, decimal_places=2)

    status: str = Field(default="pending", max_length=20, index=True)

    # Crypto-specific fields
    coin_type: str | None = Field(default=None, max_length=20)  # USDT, TRX, ETH, BTC
    network: str | None = Field(default=None, max_length=20)  # TRC20, ERC20, BEP20
    tx_hash: str | None = Field(default=None, max_length=255, index=True)
    wallet_address: str | None = Field(default=None, max_length=255)
    confirmations: int | None = Field(default=None)

    reference_type: str | None = Field(default=None, max_length=50)
    reference_id: str | None = Field(default=None, max_length=100)

    memo: str | None = Field(default=None)
    processed_by: int | None = Field(default=None, foreign_key="admin_users.id")
    processed_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
