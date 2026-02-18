"""Slot connector for slot/mini-game providers (Pragmatic Play, PG Soft, etc.)."""

from typing import Any

from app.connectors.base import BaseConnector


class SlotConnector(BaseConnector):
    """Connector for slot and mini-game API providers."""

    async def authenticate(self) -> bool:
        try:
            result = await self._request(
                "POST",
                "/api/authenticate",
                json={"api_key": self.api_key},
            )
            return result.get("error_code") == 0
        except Exception:
            return False

    async def get_games(self) -> list[dict[str, Any]]:
        result = await self._request("POST", "/api/games/list", json={"api_key": self.api_key})
        games = result.get("games", [])
        return [
            {
                "code": g.get("game_code", g.get("id", "")),
                "name": g.get("game_name", g.get("name", "")),
                "category": "slot",
                "thumbnail_url": g.get("icon_url", g.get("thumbnail")),
                "is_active": not g.get("disabled", False),
            }
            for g in games
        ]

    async def launch_game(self, game_code: str, user_id: str, **kwargs: Any) -> dict[str, Any]:
        mode = kwargs.get("mode", "real")  # real or demo
        result = await self._request(
            "POST",
            "/api/games/launch",
            json={
                "api_key": self.api_key,
                "game_code": game_code,
                "player_id": user_id,
                "mode": mode,
                "currency": kwargs.get("currency", "KRW"),
                "language": kwargs.get("language", "ko"),
            },
        )
        return {"game_url": result.get("game_url", ""), "session_id": result.get("session_id", "")}

    async def get_balance(self, user_id: str) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/api/player/balance",
            json={"api_key": self.api_key, "player_id": user_id},
        )
        return {"user_id": user_id, "balance": result.get("balance", 0)}

    async def get_round_result(self, round_id: str) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/api/rounds/detail",
            json={"api_key": self.api_key, "round_id": round_id},
        )
        return {
            "round_id": round_id,
            "bet_amount": result.get("bet", 0),
            "win_amount": result.get("win", 0),
            "result": result.get("result", "unknown"),
        }
