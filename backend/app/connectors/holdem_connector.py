"""Holdem connector for poker providers (PPPoker, Natural8, etc.)."""

from typing import Any

from app.connectors.base import BaseConnector


class HoldemConnector(BaseConnector):
    """Connector for holdem/poker API providers with rake tracking."""

    def _auth_headers(self) -> dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "X-Club-ID": self.api_key.split(":")[0] if ":" in self.api_key else self.api_key,
        }

    async def authenticate(self) -> bool:
        try:
            result = await self._request("GET", "/api/club/status")
            return result.get("status") in ("active", "ok")
        except Exception:
            return False

    async def get_games(self) -> list[dict[str, Any]]:
        result = await self._request("GET", "/api/tables")
        tables = result.get("tables", [])
        return [
            {
                "code": t.get("table_id", t.get("id", "")),
                "name": t.get("name", ""),
                "category": "holdem",
                "is_active": t.get("status") == "active",
            }
            for t in tables
        ]

    async def launch_game(self, game_code: str, user_id: str, **kwargs: Any) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/api/tables/join",
            json={
                "table_id": game_code,
                "player_id": user_id,
                "buy_in": kwargs.get("buy_in", 0),
            },
        )
        return {"game_url": result.get("url", ""), "session_id": result.get("session_id", "")}

    async def get_balance(self, user_id: str) -> dict[str, Any]:
        result = await self._request("GET", f"/api/players/{user_id}/chips")
        return {"user_id": user_id, "balance": result.get("chips", 0)}

    async def get_round_result(self, round_id: str) -> dict[str, Any]:
        result = await self._request("GET", f"/api/hands/{round_id}")
        return {
            "round_id": round_id,
            "bet_amount": result.get("pot", 0),
            "win_amount": result.get("winnings", 0),
            "result": result.get("outcome", "unknown"),
            "rake": result.get("rake", 0),
        }
