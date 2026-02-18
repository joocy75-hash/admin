"""Auth endpoints: login, logout, refresh, me, 2FA, change password."""

import io
import base64
from datetime import datetime

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.api.deps import get_current_user, get_user_permissions
from app.models.admin_user import AdminUser
from app.models.user_login_history import UserLoginHistory
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MeResponse,
    RefreshRequest,
    TokenResponse,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
)
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _parse_device_type(ua: str) -> str:
    ua_lower = ua.lower()
    if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
        return "mobile"
    if "tablet" in ua_lower or "ipad" in ua_lower:
        return "tablet"
    return "web"


def _parse_os(ua: str) -> str:
    ua_lower = ua.lower()
    if "windows" in ua_lower:
        return "Windows"
    if "mac os" in ua_lower or "macintosh" in ua_lower:
        return "macOS"
    if "iphone" in ua_lower or "ipad" in ua_lower:
        return "iOS"
    if "android" in ua_lower:
        return "Android"
    if "linux" in ua_lower:
        return "Linux"
    return "Unknown"


def _parse_browser(ua: str) -> str:
    ua_lower = ua.lower()
    if "edg" in ua_lower:
        return "Edge"
    if "chrome" in ua_lower and "safari" in ua_lower:
        return "Chrome"
    if "firefox" in ua_lower:
        return "Firefox"
    if "safari" in ua_lower:
        return "Safari"
    if "opera" in ua_lower or "opr" in ua_lower:
        return "Opera"
    return "Unknown"


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(AdminUser).where(AdminUser.username == body.username)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    # 2FA check
    if user.two_factor_enabled:
        if not body.totp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA code required",
                headers={"X-2FA-Required": "true"},
            )
        totp = pyotp.TOTP(user.two_factor_secret)
        if not totp.verify(body.totp_code):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code")

    # Update login info
    user.last_login_at = datetime.utcnow()
    user.last_login_ip = request.client.host if request.client else None
    session.add(user)

    # Record login history
    ua = request.headers.get("user-agent", "")
    login_history = UserLoginHistory(
        user_id=user.id,
        login_ip=request.client.host if request.client else "unknown",
        user_agent=ua[:500] if ua else None,
        device_type=_parse_device_type(ua),
        os=_parse_os(ua),
        browser=_parse_browser(ua),
        login_at=datetime.utcnow(),
    )
    session.add(login_history)

    await session.commit()

    token_data = {"sub": str(user.id), "role": user.role, "agent_code": user.agent_code}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = await session.get(AdminUser, int(user_id))
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    token_data = {"sub": str(user.id), "role": user.role, "agent_code": user.agent_code}
    access_token = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: AdminUser = Depends(get_current_user)):
    # Stateless JWT — client discards token. Redis blacklist can be added later.
    return


@router.get("/me", response_model=MeResponse)
async def get_me(
    user: AdminUser = Depends(get_current_user),
    permissions: list[str] = Depends(get_user_permissions),
):
    return MeResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        agent_code=user.agent_code,
        status=user.status,
        two_factor_enabled=user.two_factor_enabled,
        permissions=permissions,
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    user: AdminUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.two_factor_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA already enabled")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.username, issuer_name=settings.APP_NAME)

    # Generate QR code as base64
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    # Store secret (not yet enabled until verified)
    user.two_factor_secret = secret
    session.add(user)
    await session.commit()

    return TwoFactorSetupResponse(secret=secret, otpauth_uri=uri, qr_base64=qr_b64)


@router.post("/2fa/verify", status_code=status.HTTP_200_OK)
async def verify_2fa(
    body: TwoFactorVerifyRequest,
    user: AdminUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not user.two_factor_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Run 2FA setup first")

    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(body.totp_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid TOTP code")

    user.two_factor_enabled = True
    session.add(user)
    await session.commit()
    return {"detail": "2FA enabled successfully"}


@router.post("/2fa/disable", status_code=status.HTTP_200_OK)
async def disable_2fa(
    body: TwoFactorVerifyRequest,
    user: AdminUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not user.two_factor_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA not enabled")

    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(body.totp_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid TOTP code")

    user.two_factor_enabled = False
    user.two_factor_secret = None
    session.add(user)
    await session.commit()
    return {"detail": "2FA disabled successfully"}


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    body: ChangePasswordRequest,
    user: AdminUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    session.add(user)
    await session.commit()
    return {"detail": "Password changed successfully"}
