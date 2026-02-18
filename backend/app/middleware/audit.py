"""Audit log middleware — records all mutating API requests."""

from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy import insert

from app.database import async_session
from app.models.audit_log import AuditLog
from app.utils.security import decode_token

# Methods that mutate state
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths to skip (health checks, docs, auth reads)
SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


def _extract_module_action(method: str, path: str) -> tuple[str, str]:
    """Derive module and action from request path and method."""
    parts = [p for p in path.split("/") if p]
    # e.g. /api/v1/agents/5 → module=agents, resource_id=5
    module = "unknown"
    if len(parts) >= 3:
        module = parts[2]  # /api/v1/{module}

    action_map = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}
    action = action_map.get(method, "unknown")
    return module, action


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method not in MUTATING_METHODS:
            return await call_next(request)

        path = request.url.path
        if path in SKIP_PATHS:
            return await call_next(request)

        response = await call_next(request)

        # Only log successful mutations (2xx)
        if not (200 <= response.status_code < 300):
            return response

        # Extract user from JWT (best effort)
        admin_user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            payload = decode_token(auth_header[7:])
            if payload:
                admin_user_id = int(payload.get("sub", 0)) or None

        module, action = _extract_module_action(request.method, path)

        # Extract resource_id from path (last numeric segment)
        parts = path.rstrip("/").split("/")
        resource_id = parts[-1] if parts[-1].isdigit() else None

        try:
            async with async_session() as session:
                stmt = insert(AuditLog).values(
                    admin_user_id=admin_user_id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    action=action,
                    module=module,
                    resource_type=module.rstrip("s") if module != "unknown" else None,
                    resource_id=resource_id,
                    description=f"{request.method} {path}",
                    created_at=datetime.now(timezone.utc),
                )
                await session.execute(stmt)
                await session.commit()
        except Exception:
            pass  # Audit logging should never break the request

        return response
