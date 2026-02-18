"""Auth request/response schemas."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)
    totp_code: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_base64: str


class TwoFactorVerifyRequest(BaseModel):
    totp_code: str = Field(min_length=6, max_length=6)


class MeResponse(BaseModel):
    id: int
    username: str
    email: str | None
    role: str
    agent_code: str
    status: str
    two_factor_enabled: bool
    permissions: list[str]


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
