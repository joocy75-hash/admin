from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.v1.admin_log import router as admin_log_router
from app.api.v1.agents import router as agents_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.backup import router as backup_router
from app.api.v1.bi import router as bi_router
from app.api.v1.commissions import router as commissions_router
from app.api.v1.connector import router as connector_router
from app.api.v1.content import router as content_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.deposit_bonus import router as deposit_bonus_router
from app.api.v1.events import router as events_router
from app.api.v1.exchange_rate import router as exchange_rate_router
from app.api.v1.finance import router as finance_router
from app.api.v1.fraud import router as fraud_router
from app.api.v1.games import router as games_router
from app.api.v1.ip_management import router as ip_management_router
from app.api.v1.kyc import router as kyc_router
from app.api.v1.limits import router as limits_router
from app.api.v1.memos import router as memos_router
from app.api.v1.mission import router as mission_router
from app.api.v1.monitoring import router as monitoring_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.partner import router as partner_router
from app.api.v1.payback import router as payback_router
from app.api.v1.point_config import router as point_config_router
from app.api.v1.popup import router as popup_router
from app.api.v1.promotions import router as promotions_router
from app.api.v1.reports import router as reports_router
from app.api.v1.roles import router as roles_router
from app.api.v1.salary import router as salary_router
from app.api.v1.settings import router as settings_router
from app.api.v1.settlements import router as settlements_router
from app.api.v1.spin import router as spin_router
from app.api.v1.user_history import router as user_history_router
from app.api.v1.user_inquiry import router as user_inquiry_router
from app.api.v1.user_message import router as user_message_router
from app.api.v1.users import router as users_router
from app.api.v1.vip import router as vip_router
from app.config import settings
from app.database import async_session, init_db
from app.middleware.audit import AuditLogMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security import SecurityHeadersMiddleware


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
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
    openapi_url="/openapi.json" if settings.ENV != "production" else None,
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
app.include_router(limits_router, prefix="/api/v1")
app.include_router(salary_router, prefix="/api/v1")
app.include_router(vip_router, prefix="/api/v1")
app.include_router(promotions_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(fraud_router, prefix="/api/v1")
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(ip_management_router, prefix="/api/v1")
app.include_router(memos_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(kyc_router, prefix="/api/v1")
app.include_router(bi_router, prefix="/api/v1")
app.include_router(backup_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(spin_router, prefix="/api/v1")
app.include_router(payback_router, prefix="/api/v1")
app.include_router(deposit_bonus_router, prefix="/api/v1")
app.include_router(point_config_router, prefix="/api/v1")
app.include_router(exchange_rate_router, prefix="/api/v1")
app.include_router(popup_router, prefix="/api/v1")
app.include_router(mission_router, prefix="/api/v1")
app.include_router(admin_log_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    checks = {"db": "unknown", "redis": "unknown"}

    # DB check
    try:
        async with async_session() as session:
            await session.execute(select(1))
        checks["db"] = "ok"
    except Exception:
        checks["db"] = "error"

    # Redis check
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "version": "0.1.0",
        "service": "admin-panel-backend",
        "checks": checks,
    }
