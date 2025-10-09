import os
import time
import traceback
import asyncio
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app.services.parser import parse_invoice
from app.database import SessionLocal
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.config import settings
from app.services.realtime_manager import realtime_manager  # 👈 añadido
from datetime import datetime

# Ruta de solo lectura (desde .env o fija)
NETWORK_PATH = getattr(settings, "INVOICE_PATH", r"\\192.168.32.100\prt")


# ===============================
#   PROCESAR ARCHIVO .P02
# ===============================
def process_file(file_path: str):
    """Lee y procesa un archivo .P02 sin modificarlo."""
    print(f"📄 Leyendo archivo: {file_path}")
    try:
        # === 1️⃣ Leer el archivo ===
        with open(file_path, "r", encoding="latin-1") as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error al leer {file_path}: {e}")
        return

    try:
        # === 2️⃣ Parsear contenido ===
        parsed = parse_invoice(content)
        header = parsed["header"]
        items = parsed["items"]
        totals = parsed["totals"]
        
        raw_date = header.get("date")
        invoice_date = None
        if raw_date:
            try:
                invoice_date = datetime.strptime(raw_date, "%Y-%b-%d %I:%M %p")
            except ValueError:
                try:
                    invoice_date = datetime.strptime(raw_date, "%Y-%b-%d")
                except ValueError:
                    print(f"no se pudo parsear la fecha '{raw_date}'")
    except Exception as e:
        print(f"⚠️ Error al parsear {file_path}: {e}")
        return

    db = SessionLocal()
    try:
        # === 3️⃣ Validar si ya existe ===
        filename = os.path.basename(file_path)
        exists = db.query(Invoice).filter(Invoice.source_file == filename).first()
        if exists:
            print(f"⏩ Factura ya registrada ({filename}), se omite.")
            db.close()
            return

        # === 4️⃣ Guardar cabecera ===
        invoice = Invoice(
            number=header.get("number"),
            branch_id=None,  # 🔸 Se asignará según la sede activa más adelante
            subtotal=totals.get("subtotal", 0),
            vat=totals.get("iva", 0),
            discount=totals.get("discount", 0),
            total=totals.get("total", 0),
            source_file=filename,
            invoice_date = invoice_date
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        # === 5️⃣ Guardar ítems ===
        for item in items:
            db_item = InvoiceItem(
                invoice_id=invoice.id,
                line_number=item["line_number"],
                product_code=item["product_code"],
                description=item["description"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                subtotal=item["subtotal"]
            )
            db.add(db_item)
        db.commit()

        print(f"💾 Factura {header.get('number')} guardada con éxito ({len(items)} ítems)")

        # === 6️⃣ Enviar notificación WebSocket ===
        payload = {
            "event": "new_invoice",
            "invoice_number": header.get("number"),
            "items": len(items),
            "total": totals.get("total", 0),
            "file": filename,
            "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        }

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # Caso: FastAPI tiene un loop activo (raro aquí)
            asyncio.run_coroutine_threadsafe(
                realtime_manager.broadcast("FLO", payload),
                loop
            )
        else:
            # Caso normal: ejecuta en hilo separado
            asyncio.run(realtime_manager.broadcast("FLO", payload))

        print("📡 Notificación enviada al WebSocket (FLO).")

    except Exception as e:
        db.rollback()
        print(f"❌ Error guardando factura {file_path}: {e}")
        traceback.print_exc()
    finally:
        db.close()


# ===============================
#   ESCANEO INICIAL
# ===============================
def initial_scan():
    """Procesa los archivos existentes al iniciar (solo los nuevos)."""
    print("🔍 Escaneo inicial de la carpeta de facturas...")

    db = SessionLocal()
    processed_files = {row[0] for row in db.query(Invoice.source_file).all()}
    db.close()

    try:
        files = [f for f in os.listdir(NETWORK_PATH) if f.endswith(".P02")]
        print(f"📂 Archivos encontrados: {len(files)}")

        for filename in files:
            if filename not in processed_files:
                file_path = os.path.join(NETWORK_PATH, filename)
                process_file(file_path)
            else:
                print(f"⏩ Saltando {filename} (ya registrado)")
        print("✅ Escaneo inicial completado.")
    except Exception as e:
        print(f"⚠️ Error en el escaneo inicial: {e}")


# ===============================
#   MONITOR DE NUEVOS ARCHIVOS
# ===============================
class InvoiceFileHandler(FileSystemEventHandler):
    """Detecta archivos nuevos o modificados en la carpeta de facturas."""

    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith(".P02"):
            print(f"🆕 Nuevo archivo detectado: {event.src_path}")
            try:
                process_file(event.src_path)
            except Exception as e:
                print(f"❌ Error al procesar {event.src_path}: {e}")
                traceback.print_exc()


def start_file_monitor():
    """Inicia el monitoreo continuo de la carpeta de red."""
    print(f"👀 Monitoreando carpeta: {NETWORK_PATH}")
    # Primero, escanear los archivos existentes
    initial_scan()

    # Luego, iniciar el monitor en tiempo real
    event_handler = InvoiceFileHandler()
    observer = Observer()
    observer.schedule(event_handler, NETWORK_PATH, recursive=False)
    observer.start()
    print("✅ Monitor de archivos activo (modo solo lectura)")

    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
