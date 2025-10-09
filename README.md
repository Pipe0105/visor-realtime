# Visor Realtime

Sistema de monitoreo en tiempo real de facturas generadas en Siesa.  
Proyecto modular con backend en FastAPI y frontend en React.

## Estructura

- `/backend` → API con FastAPI, lectura de archivos .P02 y WebSocket en tiempo real  
- `/frontend` → Interfaz React que muestra las ventas diarias sin necesidad de recargar la página  

## Cómo ejecutar

### Backend
```bash
cd backend
uvicorn app.main:app --reload

### FRONTEND

cd frontend
npm run dev
