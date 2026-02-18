"""Connector schemas: status, test, webhook, sync."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ConnectorStatusResponse(BaseModel):
    provider_id: int
    name: str
    code: str
    category: str
    is_connected: bool = False
    last_sync: datetime | None = None
    game_count: int = 0


class ConnectorTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: float = 0


class WebhookPayload(BaseModel):
    event_type: str = Field(max_length=100)
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: str | None = None
    signature: str | None = None


class GameSyncResponse(BaseModel):
    synced_count: int = 0
    new_count: int = 0
    updated_count: int = 0
