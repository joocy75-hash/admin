"""Telegram notification service for admin alerts."""

import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


async def send_telegram(message: str) -> None:
    """Send a message via Telegram Bot API. Fire-and-forget, never raises."""
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        return

    url = TELEGRAM_API.format(token=settings.TELEGRAM_BOT_TOKEN)
    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.warning("Telegram send failed: %s", resp.text)
    except Exception:
        logger.warning("Telegram send error", exc_info=True)


def notify(message: str) -> None:
    """Schedule telegram notification as background task."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_telegram(message))
    except RuntimeError:
        pass
