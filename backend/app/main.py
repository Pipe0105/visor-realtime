from fastapi import FastAPI
import asyncio
import threading
from app.api import routes_invoices, routes_branches, routes_realtime
from app.services.file_reader import start_file_monitor
from fastapi.middleware.cors import CORSMiddleware
from app.services.realtime_manager import realtime_manager
from app.config import settings


# 🚀 CONFIGURACIÓN PRINCIPAL DE LA API

app = FastAPI(
    title="Visor Realtime API",
    version="1.0.0",
    description="Backend del visor en tiempo real de facturas"
)


# 🌐 CORS (para permitir acceso desde el frontend React)
cors_options = {
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if settings.CORS_ALLOW_ALL:
    cors_options["allow_origins"] = ["*"]
    # Starlette no permite credenciales con comodín, así que las deshabilitamos automáticamente.
    cors_options["allow_credentials"] = False
else:
    cors_options["allow_origins"] = settings.CORS_ALLOWED_ORIGINS
    cors_options["allow_credentials"] = settings.CORS_ALLOW_CREDENTIALS

app.add_middleware(
    CORSMiddleware,
    **cors_options,
)


# 📦 INCLUSIÓN DE RUTAS

app.include_router(routes_branches.router, prefix="/branches", tags=["Branches"])
app.include_router(routes_invoices.router, prefix="/invoices", tags=["Invoices"])
app.include_router(routes_realtime.router, tags=["Realtime"])  # 👈 WebSocket aquí


# 🧠 EVENTO STARTUP - INICIAR MONITOR DE FACTURAS

@app.on_event("startup")
async def startup_event():
    """Inicia el monitor de archivos cuando arranca FastAPI."""
    loop = asyncio.get_running_loop()
    realtime_manager.set_loop(loop)
    """Inicia el monitor de archivos cuando arranca FastAPI."""
    monitor_thread = threading.Thread(target=start_file_monitor, daemon=True)
    monitor_thread.start()
    print("✅ Monitor de archivos iniciado correctamente.")


# 🏠 RUTA PRINCIPAL

@app.get("/")
def root():
    return {"message": "Visor Realtime API is running 🚀"}
