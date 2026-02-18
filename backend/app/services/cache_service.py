"""Redis caching service for dashboard and frequently accessed data."""

import json
from typing import Any

import redis.asyncio as redis

from app.config import settings

_redis: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.REDIS_URL)
    return _redis


async def cache_get(key: str) -> Any | None:
    r = await get_redis()
    data = await r.get(f"cache:{key}")
    if data:
        return json.loads(data)
    return None


async def cache_set(key: str, value: Any, ttl: int = 30) -> None:
    r = await get_redis()
    await r.set(f"cache:{key}", json.dumps(value, default=str), ex=ttl)


async def cache_delete(key: str) -> None:
    r = await get_redis()
    await r.delete(f"cache:{key}")


async def cache_delete_pattern(pattern: str) -> None:
    r = await get_redis()
    keys = []
    async for key in r.scan_iter(f"cache:{pattern}*"):
        keys.append(key)
    if keys:
        await r.delete(*keys)
