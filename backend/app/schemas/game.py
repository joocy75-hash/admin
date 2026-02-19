"""Game management schemas: providers, games, rounds."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

# ─── GameProvider ─────────────────────────────────────────────────

class GameProviderCreate(BaseModel):
    name: str = Field(max_length=100)
    code: str = Field(max_length=50)
    category: str = Field(pattern=r"^(casino|slot|mini_game|virtual_soccer|sports|esports|holdem)$")
    api_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    description: str | None = None


class GameProviderUpdate(BaseModel):
    name: str | None = None
    category: str | None = Field(
        default=None,
        pattern=r"^(casino|slot|mini_game|virtual_soccer|sports|esports|holdem)$",
    )
    api_url: str | None = None
    api_key: str | None = None
    is_active: bool | None = None
    description: str | None = None


class GameProviderResponse(BaseModel):
    id: int
    name: str
    code: str
    category: str
    api_url: str | None
    api_key: str | None
    is_active: bool
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GameProviderListResponse(BaseModel):
    items: list[GameProviderResponse]
    total: int
    page: int
    page_size: int


# ─── Game ─────────────────────────────────────────────────────────

class GameCreate(BaseModel):
    provider_id: int
    name: str = Field(max_length=200)
    code: str = Field(max_length=100)
    category: str = Field(pattern=r"^(casino|slot|mini_game|virtual_soccer|sports|esports|holdem)$")
    is_active: bool = True
    sort_order: int = 0
    thumbnail_url: str | None = Field(default=None, max_length=500)


class GameUpdate(BaseModel):
    name: str | None = None
    category: str | None = Field(
        default=None,
        pattern=r"^(casino|slot|mini_game|virtual_soccer|sports|esports|holdem)$",
    )
    is_active: bool | None = None
    sort_order: int | None = None
    thumbnail_url: str | None = None


class GameResponse(BaseModel):
    id: int
    provider_id: int
    name: str
    code: str
    category: str
    is_active: bool
    sort_order: int
    thumbnail_url: str | None
    created_at: datetime
    updated_at: datetime
    # Joined field
    provider_name: str | None = None

    model_config = {"from_attributes": True}


class GameListResponse(BaseModel):
    items: list[GameResponse]
    total: int
    page: int
    page_size: int


# ─── GameRound ────────────────────────────────────────────────────

class GameRoundResponse(BaseModel):
    id: int
    game_id: int
    user_id: int
    round_id: str
    bet_amount: Decimal
    win_amount: Decimal
    result: str
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    # Joined fields
    game_name: str | None = None
    user_username: str | None = None

    model_config = {"from_attributes": True}


class GameRoundListResponse(BaseModel):
    items: list[GameRoundResponse]
    total: int
    page: int
    page_size: int
    total_bet: Decimal = Decimal("0")
    total_win: Decimal = Decimal("0")
