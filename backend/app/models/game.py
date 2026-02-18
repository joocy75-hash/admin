from datetime import datetime

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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GameRound(SQLModel, table=True):
    __tablename__ = "game_rounds"

    id: int | None = Field(default=None, primary_key=True)
    game_id: int = Field(foreign_key="games.id", index=True)
    user_id: int = Field(index=True)
    round_id: str = Field(max_length=100, unique=True, index=True)

    bet_amount: float = Field(default=0)
    win_amount: float = Field(default=0)
    result: str = Field(max_length=20)  # win, lose, draw, push

    started_at: datetime | None = Field(default=None)
    ended_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
