from typing import List, Dict, Optional
from fastapi import WebSocket
import asyncio
import json
from datetime import datetime

class RealtimeManager:
    """Administra conexiones WebSocket activas y mantiene solo las facturas del día actual."""

    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}
        self.daily_messages: Dict[str, List[dict]] = {}  # historial por sede (solo de hoy)
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        
    @staticmethod
    def _resolve_iso_timestamp(message: dict) -> str:
        """Obtiene la marca de tiempo preferida para un mensaje."""

        candidate = message.get("invoice_date") or message.get("timestamp")
        if candidate:
            return candidate
        return datetime.now().isoformat()

    @classmethod
    def _message_date(cls, message: dict):
        """Convierte la marca de tiempo en fecha (ignorando hora)."""

        iso_value = cls._resolve_iso_timestamp(message)
        try:
            return datetime.fromisoformat(iso_value).date()
        except (TypeError, ValueError):
            return None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        """Guarda el event loop principal para reutilizarlo en hilos secundarios."""
        self.loop = loop

    async def connect(self, websocket: WebSocket, branch: str):
        if self.loop is None:
            self.loop = asyncio.get_running_loop()
        await websocket.accept()
        if branch not in self.connections:
            self.connections[branch] = []
            self.daily_messages[branch] = []

        self.connections[branch].append(websocket)
        print(f"🔌 Nueva conexión a canal {branch}. Total: {len(self.connections[branch])}")

        # Enviar facturas del día actual al conectar
        today = datetime.now().date()
        for msg in self.daily_messages[branch]:
            if self._message_date(msg) == today:

                await websocket.send_text(json.dumps(msg, ensure_ascii=False))

    async def disconnect(self, websocket: WebSocket, branch: str):
        if branch in self.connections and websocket in self.connections[branch]:
            self.connections[branch].remove(websocket)
            print(f"❌ Conexión cerrada en canal {branch}.")

    async def broadcast(self, branch: str, message: dict):
        """Envía un mensaje JSON a todos los clientes de una sede y guarda solo los del día actual."""
        message["timestamp"] = self._resolve_iso_timestamp(message)

        if branch not in self.daily_messages:
            self.daily_messages[branch] = []
        self.daily_messages[branch].append(message)

        # eliminar mensajes de días anteriores
        today = datetime.now().date()
        self.daily_messages[branch] = [
            m for m in self.daily_messages[branch]
            if self._message_date(m) == today        ]

        if branch not in self.connections:
            return

        data = json.dumps(message, ensure_ascii=False)
        dead = []
        for ws in self.connections[branch]:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws, branch)

# instancia global
realtime_manager = RealtimeManager()
