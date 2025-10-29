from typing import List, Dict, Optional, Iterable
from fastapi import WebSocket
import asyncio
import json
from datetime import datetime
from starlette.websockets import WebSocketDisconnect


class RealtimeManager:
    """Administra conexiones WebSocket activas y mantiene solo las facturas del día actual."""

    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}
        self.daily_messages: Dict[str, List[dict]] = {}  # historial por sede (solo de hoy)
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        
    @staticmethod
    def _to_iso(value) -> Optional[str]:
        if value is None:
            return None

        if isinstance(value, datetime):
            return value.isoformat()

        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value).isoformat()
            except (OverflowError, OSError, ValueError):
                return str(value)

        return str(value)

    @classmethod
    def _resolve_iso_timestamp(cls, message: dict) -> str:
        """Obtiene la marca de tiempo preferida para un mensaje."""

        for key in ("invoice_date", "timestamp", "created_at", "issued_at"):
            resolved = cls._to_iso(message.get(key))
            if resolved:
                return resolved
        return datetime.now().isoformat()

    @classmethod
    def _message_date(cls, message: dict):
        """Convierte la marca de tiempo en fecha (ignorando hora)."""

        iso_value = cls._resolve_iso_timestamp(message)
        try:
            return datetime.fromisoformat(iso_value).date()
        except (TypeError, ValueError):
            return None
        
    @classmethod
    def _message_identifier(cls, message: dict) -> Optional[str]:
        """Genera un identificador estable para deduplicar mensajes."""

        if not isinstance(message, dict):
            return None

        direct_id = (
            message.get("invoice_id")
            or message.get("id")
            or message.get("uuid")
        )
        if direct_id:
            return str(direct_id)

        invoice_number = message.get("invoice_number") or message.get("number")
        timestamp = (
            message.get("timestamp")
            or message.get("invoice_date")
            or message.get("created_at")
        )

        normalized_timestamp: Optional[str] = None
        if isinstance(timestamp, datetime):
            normalized_timestamp = timestamp.isoformat()
        elif isinstance(timestamp, (int, float)):
            try:
                normalized_timestamp = datetime.fromtimestamp(timestamp).isoformat()
            except (OverflowError, OSError, ValueError):
                normalized_timestamp = str(timestamp)
        elif isinstance(timestamp, str):
            normalized_timestamp = timestamp

        if invoice_number and normalized_timestamp:
            return f"{invoice_number}-{normalized_timestamp}"

        if invoice_number:
            return str(invoice_number)

        if normalized_timestamp:
            return normalized_timestamp

        # último recurso: usa timestamp resuelto actual
        resolved = cls._resolve_iso_timestamp(message)
        return resolved

    @classmethod
    def _clean_history(cls, messages: Iterable[dict]) -> List[dict]:
        """Elimina duplicados manteniendo solo el registro más reciente de cada factura."""

        today = datetime.now().date()
        cleaned_reversed: List[dict] = []
        seen: set[str] = set()

        for entry in reversed(list(messages)):
            if not isinstance(entry, dict):
                continue

            if cls._message_date(entry) != today:
                continue

            identifier = cls._message_identifier(entry)
            if identifier and identifier in seen:
                continue

            if identifier:
                seen.add(identifier)

            cleaned_reversed.append(entry)

        cleaned_reversed.reverse()
        return cleaned_reversed

    def _store_daily_message(self, branch: str, message: dict) -> None:
        """Guarda un mensaje en memoria eliminando duplicados y valores antiguos."""

        history = self.daily_messages.get(branch, [])
        history.append(message)
        self.daily_messages[branch] = self._clean_history(history)

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        """Guarda el event loop principal para reutilizarlo en hilos secundarios."""
        self.loop = loop

    async def connect(self, websocket: WebSocket, branch: str):
        if self.loop is None:
            self.loop = asyncio.get_running_loop()
        if branch not in self.connections:
            self.connections[branch] = []
            self.daily_messages[branch] = []

        self.connections[branch].append(websocket)
        print(f"🔌 Nueva conexión a canal {branch}. Total: {len(self.connections[branch])}")

        # Enviar facturas del día actual al conectar
        today = datetime.now().date()
        self.daily_messages[branch] = self._clean_history(
            self.daily_messages.get(branch, [])
        )
        for msg in list(self.daily_messages[branch]):
            if self._message_date(msg) != today:
                continue
            try:
                await websocket.send_text(json.dumps(msg, ensure_ascii=False))
            except WebSocketDisconnect:
                await self.disconnect(websocket, branch)
                return
            except Exception as exc:
                print(
                    f"⚠️ Error al reenviar historial a {branch}: {exc}"
                )
                await self.disconnect(websocket, branch)
                return

    async def disconnect(self, websocket: WebSocket, branch: str):
        if branch in self.connections and websocket in self.connections[branch]:
            self.connections[branch].remove(websocket)
            print(f"❌ Conexión cerrada en canal {branch}.")

    async def broadcast(self, branch: str, message: dict):
        """Envía un mensaje JSON a todos los clientes de una sede y guarda solo los del día actual."""
        message["timestamp"] = self._resolve_iso_timestamp(message)
        
        message_day = self._message_date(message)
        today = datetime.now().date()

        if message_day and message_day != today:
            return

        if branch not in self.daily_messages:
            self.daily_messages[branch] = []
        self._store_daily_message(branch, message)

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
