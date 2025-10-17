from fastapi import FastAPI
import asyncio
import threading
from app.api import routes_invoices, routes_branches, routes_realtime
from app.services.file_reader import start_file_monitor
from fastapi.middleware.cors import CORSMiddleware
from app.services.realtime_manager import realtime_manager


# 🚀 CONFIGURACIÓN PRINCIPAL DE LA API

app = FastAPI(
    title="Visor Realtime API",
    version="1.0.0",
    description="Backend del visor en tiempo real de facturas"
)


# 🌐 CORS (para permitir acceso desde el frontend React)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción, limitar al dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
