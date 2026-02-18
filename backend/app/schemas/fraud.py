"""Fraud detection schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


# ─── FraudAlert ──────────────────────────────────────────────────

class FraudAlertResponse(BaseModel):
    id: int
    user_id: int
    user_username: str | None = None
    alert_type: str
    severity: str
    status: str
    description: str | None
    data: dict | None
    detected_at: datetime
    reviewed_by: int | None
    reviewed_by_username: str | None = None
    reviewed_at: datetime | None
    resolution_note: str | None

    model_config = {"from_attributes": True}


class FraudAlertListResponse(BaseModel):
    items: list[FraudAlertResponse]
    total: int
    page: int
    page_size: int


class FraudAlertStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(investigating|resolved|false_positive)$")
    resolution_note: str | None = None


class FraudAlertStatsResponse(BaseModel):
    by_severity: dict[str, int]
    by_status: dict[str, int]
    by_type: dict[str, int]
    total: int


# ─── FraudRule ───────────────────────────────────────────────────

class FraudRuleCreate(BaseModel):
    name: str = Field(max_length=200)
    rule_type: str = Field(max_length=30)
    condition: dict | None = None
    severity: str = Field(default="medium", pattern=r"^(low|medium|high|critical)$")
    is_active: bool = True


class FraudRuleUpdate(BaseModel):
    name: str | None = None
    rule_type: str | None = None
    condition: dict | None = None
    severity: str | None = Field(default=None, pattern=r"^(low|medium|high|critical)$")
    is_active: bool | None = None


class FraudRuleResponse(BaseModel):
    id: int
    name: str
    rule_type: str
    condition: dict | None
    severity: str
    is_active: bool
    created_by: int
    created_by_username: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FraudRuleListResponse(BaseModel):
    items: list[FraudRuleResponse]
    total: int
    page: int
    page_size: int
