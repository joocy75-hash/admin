"""Pydantic schemas for role and permission management."""

from datetime import datetime

from pydantic import BaseModel, Field


class RoleCreate(BaseModel):
    name: str = Field(max_length=50)
    description: str | None = None


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    description: str | None = None


class PermissionResponse(BaseModel):
    id: int
    name: str
    module: str
    description: str | None


class RoleResponse(BaseModel):
    id: int
    name: str
    guard: str
    description: str | None
    is_system: bool
    permissions: list[PermissionResponse] = []
    created_at: datetime


class RoleListResponse(BaseModel):
    items: list[RoleResponse]
    total: int


class RolePermissionUpdate(BaseModel):
    permission_ids: list[int]


class PermissionGroupResponse(BaseModel):
    module: str
    permissions: list[PermissionResponse]
