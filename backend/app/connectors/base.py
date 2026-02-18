"""Base connector for external game API integration."""

import abc
import asyncio
import hashlib
import hmac
from typing import Any

import httpx


class BaseConnector(abc.ABC):
    """Abstract base for game API connectors."""

    def __init__(
        self,
        provider_id: int,
        api_url: str,
        api_key: str,
        api_secret: str | None = None,
    ):
        self.provider_id = provider_id
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.api_secret = api_secret
        self._client: httpx.AsyncClient | None = None

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.api_url,
                timeout=30.0,
                headers=self._auth_headers(),
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def _auth_headers(self) -> dict[str, str]:
        return {"X-API-Key": self.api_key}

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        if not self.api_secret:
            return False
        expected = hmac.HMAC(
            self.api_secret.encode(), payload, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        """Make HTTP request with retry logic (3 attempts, exponential backoff)."""
        client = await self.get_client()
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = await client.request(method, path, **kwargs)
                response.raise_for_status()
                return response.json()
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                last_error = e
                if attempt < 2:
                    await asyncio.sleep(2**attempt)
        raise last_error  # type: ignore[misc]

    @abc.abstractmethod
    async def authenticate(self) -> bool:
        """Verify API credentials are valid."""
        ...

    @abc.abstractmethod
    async def get_games(self) -> list[dict[str, Any]]:
        """Fetch game catalog from external API."""
        ...

    @abc.abstractmethod
    async def launch_game(self, game_code: str, user_id: str, **kwargs: Any) -> dict[str, Any]:
        """Get game launch URL for a user."""
        ...

    @abc.abstractmethod
    async def get_balance(self, user_id: str) -> dict[str, Any]:
        """Get user balance from external system."""
        ...

    @abc.abstractmethod
    async def get_round_result(self, round_id: str) -> dict[str, Any]:
        """Fetch a specific round result."""
        ...
