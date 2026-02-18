"""Pydantic schemas for agent CRUD and tree operations."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    email: str | None = None
    role: str = Field(default="agent", pattern=r"^(admin|teacher|sub_hq|agent|sub_agent)$")
    parent_id: int | None = None
    agent_code: str = Field(min_length=2, max_length=20)
    max_sub_agents: int = Field(default=100, ge=0, le=10000)
    rolling_rate: Decimal | None = Field(default=None, ge=0, le=100)
    losing_rate: Decimal | None = Field(default=None, ge=0, le=100)
    deposit_rate: Decimal | None = Field(default=None, ge=0, le=100)
    memo: str | None = None


class AgentUpdate(BaseModel):
    email: str | None = None
    role: str | None = Field(default=None, pattern=r"^(admin|teacher|sub_hq|agent|sub_agent)$")
    status: str | None = Field(default=None, pattern=r"^(active|suspended|banned)$")
    max_sub_agents: int | None = Field(default=None, ge=0, le=10000)
    rolling_rate: Decimal | None = None
    losing_rate: Decimal | None = None
    deposit_rate: Decimal | None = None
    memo: str | None = None


class AgentResponse(BaseModel):
    id: int
    username: str
    email: str | None
    role: str
    agent_code: str
    status: str
    depth: int
    parent_id: int | None
    max_sub_agents: int
    rolling_rate: Decimal | None
    losing_rate: Decimal | None
    deposit_rate: Decimal | None
    balance: Decimal
    pending_balance: Decimal
    two_factor_enabled: bool
    last_login_at: datetime | None
    memo: str | None
    created_at: datetime
    updated_at: datetime
    children_count: int = 0


class AgentListResponse(BaseModel):
    items: list[AgentResponse]
    total: int
    page: int
    page_size: int


class AgentTreeNode(BaseModel):
    id: int
    username: str
    agent_code: str
    role: str
    status: str
    depth: int
    parent_id: int | None
    balance: float


class AgentTreeResponse(BaseModel):
    nodes: list[AgentTreeNode]


class AgentAncestor(BaseModel):
    id: int
    username: str
    agent_code: str
    role: str
    depth: int


class AgentMoveRequest(BaseModel):
    new_parent_id: int


class PasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=6, max_length=100)
