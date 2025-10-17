import os
import time
import traceback
import asyncio
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app.services.parser import parse_invoice
from app.database import SessionLocal
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.config import settings
from app.services.realtime_manager import realtime_manager
from datetime import datetime


# Ruta de solo lectura
NETWORK_PATH = getattr(settings, "INVOICE_PATH", r"\\192.168.32.100\prt")




# ===============================
#   PROCESAR ARCHIVO .P02
# ===============================
def process_file(file_path: str):
    """Lee, procesa y guarda una factura sin bloquear el hilo principal."""
    try:
        print(f"📄 Leyendo archivo: {file_path}")
        with open(file_path, "r", encoding="latin-1") as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error al leer {file_path}: {e}")
        return

    try:
        # === Parsear contenido ===
        parsed = parse_invoice(content)
        header = parsed["header"]
        items = parsed["items"]
        totals = parsed["totals"]

        raw_date = header.get("date")
        invoice_date = None
        if raw_date:
            for fmt in ("%Y-%b-%d %I:%M %p", "%Y-%b-%d"):
                try:
                    invoice_date = datetime.strptime(raw_date, fmt)
                    break
                except ValueError:
                    pass
            if not invoice_date:
                print(f"⚠️ No se pudo parsear la fecha '{raw_date}'")

    except Exception as e:
        print(f"⚠️ Error al parsear {file_path}: {e}")
        traceback.print_exc()
        return

    db = SessionLocal()
    try:
        # === Validar duplicado ===
        filename = os.path.basename(file_path)
        exists = db.query(Invoice).filter(Invoice.source_file == filename).first()
        if exists:
            print(f"⏩ Factura ya registrada ({filename}), se omite.")
            return

        # === Guardar cabecera ===
        invoice = Invoice(
            number=header.get("number"),
            branch_id=None,
            subtotal=totals.get("subtotal", 0),
            vat=totals.get("iva", 0),
            discount=totals.get("discount", 0),
            total=totals.get("total", 0),
            source_file=filename,
            invoice_date=invoice_date,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        # === Guardar ítems ===
        for item in items:
            db_item = InvoiceItem(
                invoice_id=invoice.id,
                line_number=item["line_number"],
                product_code=item["product_code"],
                description=item["description"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                subtotal=item["subtotal"],
            )
            db.add(db_item)
        db.commit()

        print(f"💾 Factura {invoice.number} guardada con éxito ({len(items)} ítems)")

        # === Enviar evento realtime ===
        payload = {
            "event": "new_invoice",
            "invoice_number": invoice.number,
            "items": len(items),
            "total": float(invoice.total or 0),
            "file": filename,
            "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        }

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(
                realtime_manager.broadcast("FLO", payload), loop
            )
        else:
            asyncio.run(realtime_manager.broadcast("FLO", payload))

        print("📡 Notificación enviada al WebSocket (FLO).")

    except Exception as e:
        db.rollback()
        print(f"❌ Error guardando {file_path}: {e}")
        traceback.print_exc()
    finally:
        db.close()


# ===============================
#   ESCANEO INICIAL
# ===============================
def initial_scan():
    """Procesa archivos existentes al iniciar (solo nuevos)."""
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
                threading.Thread(target=process_file, args=(file_path,), daemon=True).start()
            else:
                print(f"⏩ Saltando {filename} (ya registrado)")
        print("✅ Escaneo inicial completado.")
    except Exception as e:
        print(f"⚠️ Error en el escaneo inicial: {e}")


# ===============================
#   MONITOR DE NUEVOS ARCHIVOS
# ===============================
class InvoiceFileHandler(FileSystemEventHandler):
    """Detecta archivos nuevos y los procesa en un hilo separado."""

    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith(".P02"):
            print(f"🆕 Nuevo archivo detectado: {event.src_path}")
            threading.Thread(
                target=process_file, args=(event.src_path,), daemon=True
            ).start()


def start_file_monitor():
    """Inicia el monitoreo continuo de la carpeta de red."""
    print(f"👀 Monitoreando carpeta: {NETWORK_PATH}")

    # Escaneo inicial
    initial_scan()

    # Monitor en tiempo real
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
