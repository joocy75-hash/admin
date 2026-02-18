"""Sports connector for sportsbook providers (Kambi, Betradar, BTi, etc.)."""

from typing import Any

from app.connectors.base import BaseConnector


class SportsConnector(BaseConnector):
    """Connector for sports/esports/virtual betting API providers."""

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

    async def authenticate(self) -> bool:
        try:
            result = await self._request("GET", "/api/v1/health")
            return result.get("status") in ("ok", "healthy")
        except Exception:
            return False

    async def get_games(self) -> list[dict[str, Any]]:
        result = await self._request("GET", "/api/v1/events", params={"status": "open"})
        events = result.get("events", [])
        return [
            {
                "code": e.get("event_id", e.get("code", "")),
                "name": e.get("name", ""),
                "category": e.get("sport", "sports"),
                "is_active": e.get("status") == "open",
            }
            for e in events
        ]

    async def launch_game(self, game_code: str, user_id: str, **kwargs: Any) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/api/v1/session",
            json={
                "event_id": game_code,
                "player_id": user_id,
                "currency": kwargs.get("currency", "KRW"),
            },
        )
        return {"game_url": result.get("url", ""), "session_id": result.get("session_id", "")}

    async def get_balance(self, user_id: str) -> dict[str, Any]:
        result = await self._request("GET", f"/api/v1/players/{user_id}/balance")
        return {"user_id": user_id, "balance": result.get("balance", 0)}

    async def get_round_result(self, round_id: str) -> dict[str, Any]:
        result = await self._request("GET", f"/api/v1/bets/{round_id}")
        return {
            "round_id": round_id,
            "bet_amount": result.get("stake", 0),
            "win_amount": result.get("payout", 0),
            "result": result.get("outcome", "unknown"),
            "odds": result.get("odds"),
            "market": result.get("market_type"),
        }
