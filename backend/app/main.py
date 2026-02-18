from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import async_session, init_db
from app.api.v1.auth import router as auth_router
from app.api.v1.agents import router as agents_router
from app.api.v1.commissions import router as commissions_router
from app.api.v1.settlements import router as settlements_router
from app.api.v1.users import router as users_router
from app.api.v1.finance import router as finance_router
from app.api.v1.games import router as games_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.events import router as events_router
from app.api.v1.reports import router as reports_router
from app.api.v1.content import router as content_router
from app.api.v1.roles import router as roles_router
from app.api.v1.settings import router as settings_router
from app.api.v1.audit import router as audit_router
from app.api.v1.partner import router as partner_router
from app.api.v1.connector import router as connector_router
from app.api.v1.user_history import router as user_history_router
from app.api.v1.user_inquiry import router as user_inquiry_router
from app.api.v1.user_message import router as user_message_router
from app.middleware.audit import AuditLogMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.rate_limit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as e:
        import logging
        logging.warning(f"DB init skipped: {e}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(SecurityHeadersMiddleware)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"],
)

# API v1 routes
app.include_router(auth_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
app.include_router(commissions_router, prefix="/api/v1")
app.include_router(settlements_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(games_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(content_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(partner_router, prefix="/api/v1")
app.include_router(connector_router, prefix="/api/v1")
app.include_router(user_history_router, prefix="/api/v1")
app.include_router(user_inquiry_router, prefix="/api/v1")
app.include_router(user_message_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    checks = {"db": "unknown", "redis": "unknown"}

    # DB check
    try:
        async with async_session() as session:
            await session.execute(select(1))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {str(e)}"

    # Redis check
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "version": "0.1.0",
        "service": "admin-panel-backend",
        "checks": checks,
    }
