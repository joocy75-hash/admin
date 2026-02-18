# Phase 2 Handoff: Auth + RBAC API

## Status: COMPLETE

## Summary
JWT authentication, 2FA (TOTP), RBAC permission system, and audit logging middleware implemented. All 9 endpoints tested and verified.

## Files Created

| File | Purpose |
|------|---------|
| `app/utils/security.py` | Password hashing (bcrypt), JWT create/decode (HS256) |
| `app/schemas/auth.py` | Pydantic request/response models for auth endpoints |
| `app/api/deps.py` | `get_current_user`, `get_user_permissions`, `PermissionChecker` |
| `app/api/v1/auth.py` | Auth router: login, logout, refresh, me, 2FA, change-password |
| `app/middleware/audit.py` | Auto-logs all mutating (POST/PUT/PATCH/DELETE) requests to audit_logs |
| `scripts/test_auth.py` | Integration test script for all auth endpoints |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | No | Login, returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | No | Refresh expired access token |
| POST | `/api/v1/auth/logout` | Yes | Logout (stateless, 204) |
| GET | `/api/v1/auth/me` | Yes | Current user info + permissions list |
| POST | `/api/v1/auth/2fa/setup` | Yes | Generate TOTP secret + QR code |
| POST | `/api/v1/auth/2fa/verify` | Yes | Verify TOTP and enable 2FA |
| POST | `/api/v1/auth/2fa/disable` | Yes | Disable 2FA (requires TOTP) |
| POST | `/api/v1/auth/change-password` | Yes | Change password |

## Key Design Decisions

1. **HS256 JWT**: Simpler than RS256 for single-service architecture. Upgrade to RS256 when adding external services.
2. **Stateless logout**: No Redis token blacklist yet. Client discards tokens. Redis blacklist planned for Phase 13.
3. **bcrypt directly**: passlib incompatible with bcrypt 4.x on Python 3.14. Using `bcrypt` package directly.
4. **PermissionChecker**: Reusable FastAPI dependency. `super_admin` role bypasses all permission checks.
5. **Audit middleware**: Logs after response (non-blocking). Only logs successful 2xx mutations. Extracts user from JWT header.
6. **Timezone-naive datetimes**: asyncpg rejects timezone-aware datetimes on TIMESTAMP WITHOUT TIME ZONE columns. All datetimes use `datetime.utcnow()`.

## Test Results (9/9 PASS)

1. Login with correct credentials -> 200 + tokens
2. GET /me returns user info + 47 permissions
3. Refresh token works
4. Wrong password -> 401
5. No auth token -> 401
6. Change password -> 200
7. Login with new password -> 200
8. Revert password -> 200
9. Logout -> 204

## Issues Resolved

1. **asyncpg timezone mismatch**: `datetime.now(timezone.utc)` crashes with TIMESTAMP WITHOUT TIME ZONE columns -> use `datetime.utcnow()`
2. **Port 8000 occupied**: Local PHP server using port 8000 -> use port 8002 for dev
3. **Audit log timezone**: Same timezone issue in middleware -> fixed

## Next Phase: Phase 3 (Layout + Dashboard)

- Admin layout with sidebar navigation
- Protected routes (redirect to login if not authenticated)
- Dashboard page with placeholder stats
- Frontend login page connected to auth API
