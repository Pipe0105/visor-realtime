from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.realtime_manager import realtime_manager

router = APIRouter()

@router.websocket("/ws/{branch_code}")
async def websocket_endpoint(websocket: WebSocket, branch_code: str):
    """Canal en tiempo real por sede (Floresta, Cedritos, etc.)"""
    await realtime_manager.connect(websocket, branch_code)
    try:
        while True:
            await websocket.receive_text()  # mantenemos viva la conexión
    except WebSocketDisconnect:
        await realtime_manager.disconnect(websocket, branch_code)
