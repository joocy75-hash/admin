from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel


class GameProvider(SQLModel, table=True):
    __tablename__ = "game_providers"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    code: str = Field(max_length=50, unique=True, index=True)
    category: str = Field(max_length=50, index=True)  # casino, slot, mini_game, virtual_soccer, sports, esports, holdem
    api_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=255)
    is_active: bool = Field(default=True, index=True)
    description: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Game(SQLModel, table=True):
    __tablename__ = "games"

    id: int | None = Field(default=None, primary_key=True)
    provider_id: int = Field(foreign_key="game_providers.id", index=True)
    name: str = Field(max_length=200)
    code: str = Field(max_length=100, unique=True, index=True)
    category: str = Field(max_length=50, index=True)
    is_active: bool = Field(default=True, index=True)
    sort_order: int = Field(default=0)
    thumbnail_url: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GameRound(SQLModel, table=True):
    __tablename__ = "game_rounds"

    id: int | None = Field(default=None, primary_key=True)
    game_id: int = Field(foreign_key="games.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    round_id: str = Field(max_length=100, unique=True, index=True)

    bet_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    win_amount: Decimal = Field(default=Decimal("0"), max_digits=18, decimal_places=2)
    result: str = Field(max_length=20)  # win, lose, draw, push

    started_at: datetime | None = Field(default=None)
    ended_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
