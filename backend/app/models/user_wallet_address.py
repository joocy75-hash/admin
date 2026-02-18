from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class UserWalletAddress(SQLModel, table=True):
    __tablename__ = "user_wallet_addresses"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    coin_type: str = Field(max_length=20)  # USDT, TRX, ETH, BTC, BNB, etc.
    network: str = Field(max_length=20)  # TRC20, ERC20, BEP20, BTC, etc.
    address: str = Field(max_length=255)
    label: str | None = Field(default=None, max_length=100)  # User-friendly name
    is_primary: bool = Field(default=False)
    status: str = Field(default="active", max_length=20)  # active, disabled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
