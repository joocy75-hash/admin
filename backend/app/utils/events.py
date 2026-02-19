"""SSE event publishing utilities (in-memory, no Redis dependency)."""

import asyncio
from typing import Any

_subscribers: list[asyncio.Queue] = []


async def publish_event(event_type: str, data: dict[str, Any]) -> None:
    """Publish event to all SSE subscribers."""
    message = {"type": event_type, "data": data}
    dead: list[asyncio.Queue] = []
    for queue in _subscribers:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            dead.append(queue)
    for q in dead:
        _subscribers.remove(q)


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    _subscribers.append(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    if queue in _subscribers:
        _subscribers.remove(queue)
