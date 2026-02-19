"""SSE event stream endpoint."""

import asyncio
import json

from fastapi import APIRouter, Query
from starlette.responses import StreamingResponse

from app.utils.events import subscribe, unsubscribe
from app.utils.security import decode_token

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/stream")
async def event_stream(token: str = Query(..., description="JWT access token")):
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return StreamingResponse(
            iter(["event: error\ndata: {\"message\": \"Invalid token\"}\n\n"]),
            media_type="text/event-stream",
            status_code=401,
        )

    queue = subscribe()

    async def generate():
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                    event_type = msg.get("type", "message")
                    data = json.dumps(msg.get("data", {}), default=str)
                    yield f"event: {event_type}\ndata: {data}\n\n"
                except TimeoutError:
                    # Heartbeat keepalive
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
