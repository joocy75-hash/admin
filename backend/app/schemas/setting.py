"""Pydantic schemas for system settings management."""

from datetime import datetime

from pydantic import BaseModel


class SettingUpdate(BaseModel):
    value: dict


class SettingResponse(BaseModel):
    id: int
    group_name: str
    key: str
    value: dict
    description: str | None
    updated_by: int | None
    updated_at: datetime


class SettingGroupResponse(BaseModel):
    group_name: str
    settings: list[SettingResponse]


class BulkSettingItem(BaseModel):
    group_name: str
    key: str
    value: dict


class BulkSettingUpdate(BaseModel):
    items: list[BulkSettingItem]
