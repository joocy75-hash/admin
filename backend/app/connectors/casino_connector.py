"""Casino connector for live casino providers (Evolution, SA Gaming, etc.)."""

from typing import Any

from app.connectors.base import BaseConnector


class CasinoConnector(BaseConnector):
    """Connector for live casino API providers."""

    def _auth_headers(self) -> dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "X-Operator-Token": self.api_key,
        }

    async def authenticate(self) -> bool:
        try:
            result = await self._request("GET", "/api/auth/validate")
            return result.get("status") == "ok"
        except Exception:
            return False

    async def get_games(self) -> list[dict[str, Any]]:
        result = await self._request("GET", "/api/games/list", params={"type": "live"})
        games = result.get("games", [])
        return [
            {
                "code": g.get("game_id", g.get("code", "")),
                "name": g.get("name", ""),
                "category": "casino",
                "thumbnail_url": g.get("thumbnail", g.get("image_url")),
                "is_active": g.get("enabled", True),
            }
            for g in games
        ]

    async def launch_game(self, game_code: str, user_id: str, **kwargs: Any) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/api/games/launch",
            json={
                "game_id": game_code,
                "player_id": user_id,
                "currency": kwargs.get("currency", "KRW"),
                "language": kwargs.get("language", "ko"),
                "return_url": kwargs.get("return_url", ""),
            },
        )
        return {"game_url": result.get("url", ""), "session_id": result.get("session_id", "")}

    async def get_balance(self, user_id: str) -> dict[str, Any]:
        result = await self._request("GET", f"/api/players/{user_id}/balance")
        return {"user_id": user_id, "balance": result.get("balance", 0)}

    async def get_round_result(self, round_id: str) -> dict[str, Any]:
        result = await self._request("GET", f"/api/rounds/{round_id}")
        return {
            "round_id": round_id,
            "bet_amount": result.get("bet", 0),
            "win_amount": result.get("win", 0),
            "result": result.get("result", "unknown"),
        }
