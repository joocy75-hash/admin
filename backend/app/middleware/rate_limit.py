"""Rate limiting middleware using Redis."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import redis.asyncio as redis

from app.config import settings

# Rate limit configs per path pattern: (max_requests, window_seconds)
RATE_LIMITS = {
    "/api/v1/auth/login": (5, 60),
    "/api/v1/auth/refresh": (10, 60),
    "/api/v1/commissions/webhook": (100, 60),
    "/api/v1/connectors/webhook": (100, 60),
    "default": (60, 60),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._redis: redis.Redis | None = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(settings.REDIS_URL)
        return self._redis

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        # Determine rate limit
        limit, window = RATE_LIMITS["default"]
        for pattern, config in RATE_LIMITS.items():
            if pattern != "default" and path.startswith(pattern):
                limit, window = config
                break

        # Build key from IP + path prefix
        client_ip = request.client.host if request.client else "unknown"
        path_prefix = "/".join(path.split("/")[:5])
        key = f"ratelimit:{client_ip}:{path_prefix}"

        try:
            r = await self._get_redis()
            current = await r.incr(key)
            if current == 1:
                await r.expire(key, window)

            if current > limit:
                ttl = await r.ttl(key)
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Rate limit exceeded. Retry after {ttl}s"},
                    headers={"Retry-After": str(ttl), "X-RateLimit-Limit": str(limit)},
                )

            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(max(0, limit - current))
            return response
        except Exception:
            # If Redis is down, allow the request through
            return await call_next(request)
