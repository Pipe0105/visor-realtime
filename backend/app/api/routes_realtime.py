from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.realtime_manager import realtime_manager

router = APIRouter()

@router.websocket("/ws/{branch_code}")
async def websocket_endpoint(websocket: WebSocket, branch_code: str):
    """Canal en tiempo real por sede (Floresta, Cedritos, etc.)"""
    await websocket.accept()
    await realtime_manager.connect(websocket, branch_code)
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except (WebSocketDisconnect, RuntimeError):
        # RuntimeError can be raised by Starlette when the client disconnects
        # abruptly after the connection is accepted. Treat it the same way as
        # a regular WebSocketDisconnect so the realtime service keeps working.
        pass
    finally:
        await realtime_manager.disconnect(websocket, branch_code)
