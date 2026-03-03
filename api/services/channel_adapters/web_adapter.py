"""WebSocket Channel Adapter — forwards events via FastAPI WebSocket."""

from typing import Any

from fastapi import WebSocket

from services.channel_adapters.base import ChannelAdapter


class WebSocketAdapter(ChannelAdapter):
    """Forwards chat events directly to a WebSocket connection."""

    def __init__(self, websocket: WebSocket) -> None:
        self._ws = websocket

    async def send_event(self, event: dict[str, Any]) -> None:
        await self._ws.send_json(event)

    @property
    def channel_name(self) -> str:
        return "websocket"
