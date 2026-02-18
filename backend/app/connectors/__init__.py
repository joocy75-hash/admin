"""Connector factory - instantiate the right connector by category."""

from app.connectors.base import BaseConnector
from app.connectors.casino_connector import CasinoConnector
from app.connectors.holdem_connector import HoldemConnector
from app.connectors.slot_connector import SlotConnector
from app.connectors.sports_connector import SportsConnector

CONNECTOR_MAP: dict[str, type[BaseConnector]] = {
    "casino": CasinoConnector,
    "slot": SlotConnector,
    "sports": SportsConnector,
    "esports": SportsConnector,
    "holdem": HoldemConnector,
    "mini_game": SlotConnector,
    "virtual_soccer": SportsConnector,
}


def get_connector(
    category: str,
    provider_id: int,
    api_url: str,
    api_key: str,
    api_secret: str | None = None,
) -> BaseConnector:
    connector_class = CONNECTOR_MAP.get(category, CasinoConnector)
    return connector_class(
        provider_id=provider_id,
        api_url=api_url,
        api_key=api_key,
        api_secret=api_secret,
    )
