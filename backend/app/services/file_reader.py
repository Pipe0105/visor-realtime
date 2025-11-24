import os
import time
import traceback
import asyncio
import threading
from typing import Optional
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler
from app.services.parser import parse_invoice
from app.database import SessionLocal
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.config import settings
from app.services.realtime_manager import realtime_manager
from datetime import datetime

def _coerce_positive(value: float, default: float) -> float:
    try:
        numeric = float(value)
        if numeric > 0:
            return numeric
    except (TypeError, ValueError):
        pass
    return default


# Ruta de solo lectura y configuración de archivos
NETWORK_PATH = settings.INVOICE_PATH
FILE_PREFIX = settings.INVOICE_FILE_PREFIX.upper()
POLL_INTERVAL = _coerce_positive(settings.INVOICE_POLL_INTERVAL, 2.0)
PERIODIC_RESCAN_SECONDS = max(
    0.0, _coerce_positive(settings.INVOICE_PERIODIC_RESCAN_SECONDS, 120.0)
)

# Control de archivos en proceso para evitar duplicados
_processing_files = set()
_processing_files_lock = threading.Lock()

# Control de facturas en proceso (por número)
_processing_invoices = set()
_processing_invoices_lock = threading.Lock()

# Control de rescaneos manuales para evitar solapamiento
_rescan_lock = threading.Lock()

def _load_processed_files_from_db() -> set[str]:
    db = SessionLocal()
    try:
        return {row[0] for row in db.query(Invoice.source_file).all() if row[0]}
    finally:
        db.close()
        
def _get_processed_files(force_refresh: bool = False) -> set[str]:
    try:
        return _load_processed_files_from_db()
    except Exception as exc:
        print("No se pudo obtener la lista de facturas procesadas", exc)
        return set()
    
def _remember_processed_file(filename: Optional[str]):
    # Ya no se mantiene un cache en memoria; la consulta a la base de datos
    # evita reprocesar facturas existentes.
    return


def _mark_file_processing(filename: str) -> bool:
    """Marca un archivo como en proceso. Devuelve False si ya estaba procesándose."""

    with _processing_files_lock:
        if filename in _processing_files:
            return False
        _processing_files.add(filename)
        return True


def _release_file(filename: str):
    """Libera un archivo previamente marcado como en proceso."""

    with _processing_files_lock:
        _processing_files.discard(filename)


def _mark_invoice_processing(invoice_number: Optional[str]) -> bool:
    """Evita procesar simultáneamente la misma factura (por número)."""

    if not invoice_number:
        return True

    with _processing_invoices_lock:
        if invoice_number in _processing_invoices:
            return False
        _processing_invoices.add(invoice_number)
        return True


def _release_invoice(invoice_number: Optional[str]):
    if not invoice_number:
        return

    with _processing_invoices_lock:
        _processing_invoices.discard(invoice_number)


def _read_file_with_retry(file_path: str, attempts: int = 5, delay: float = 1.0) -> Optional[bytes]:
    """Intenta leer un archivo varias veces para evitar errores por bloqueos de red."""

    last_error: Optional[Exception] = None

    for attempt in range(1, attempts + 1):
        try:
            with open(file_path, "rb") as f:

                return f.read()
        except FileNotFoundError:
            print(f"⚠️ El archivo desapareció antes de poder leerlo: {file_path}")
            return None
        except OSError as exc:
            last_error = exc
            wait_time = delay * attempt
            print(
                f"⏳ Archivo {file_path} en uso (intento {attempt}/{attempts}): {exc}. "
                f"Reintentando en {wait_time:.1f}s"
            )
            time.sleep(wait_time)
        except Exception as exc:
            last_error = exc
            print(f"❌ Error inesperado leyendo {file_path}: {exc}")
            break

    if last_error:
        print(f"❌ No se pudo leer {file_path} después de varios intentos: {last_error}")
    return None


# ===============================
#   UTILIDADES DE PARSEO
# ===============================
def _parse_invoice_issue_date(raw_date: Optional[str]) -> Optional[datetime]:
    if not raw_date:
        return None

    raw_date = raw_date.strip()
    if not raw_date:
        return None

    candidates = (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
        "%Y-%b-%d %I:%M %p",
        "%Y-%b-%d",
    )

    for fmt in candidates:
        try:
            return datetime.strptime(raw_date, fmt)
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(raw_date)
    except ValueError:
        pass

    return None


# ===============================
#   PROCESAR ARCHIVO XML
# ===============================
def process_file(file_path: str):
    """Lee, procesa y guarda una factura sin bloquear el hilo principal."""

    filename = os.path.basename(file_path)
    print(f"📄 Procesando archivo: {file_path}")

    content = _read_file_with_retry(file_path)
    if content is None:
        return

    try:
        # === Parsear contenido ===
        parsed = parse_invoice(content)
        header = parsed["header"]
        items = parsed["items"]
        totals = parsed["totals"]

        raw_date = header.get("issue_date") or header.get("date")
        invoice_date = _parse_invoice_issue_date(raw_date)
        if raw_date and invoice_date is None:
            print(f"⚠️ No se pudo parsear la fecha '{raw_date}'")

    except Exception as e:
        print(f"⚠️ Error al parsear {file_path}: {e}")
        traceback.print_exc()
        return

    invoice_number = header.get("number")
    invoice_lock_acquired = _mark_invoice_processing(invoice_number)
    if not invoice_lock_acquired:
        print(
            f"🔁 Factura {invoice_number} ya está en proceso desde otro archivo. Se omite {filename}."
        )
        _remember_processed_file(filename)
        return

    db = None
    try:
        db = SessionLocal()
        # === Validar duplicado por archivo ===
        exists = db.query(Invoice).filter(Invoice.source_file == filename).first()
        if exists:
            print(f"⏩ Factura ya registrada ({filename}), se omite.")
            _remember_processed_file(filename)
            return
        
        # === Validar duplicado por número de factura ===
        if invoice_number:
            duplicate_number = (
                db.query(Invoice)
                .filter(Invoice.number == invoice_number)
                .order_by(Invoice.created_at.desc())
                .first()
            )
            if duplicate_number:
                print(
                    f"⏩ Factura {invoice_number} ya fue registrada desde {duplicate_number.source_file},"
                    f" se omite {filename}."
                )
                _remember_processed_file(filename)
                return

        # === Guardar cabecera ===
        invoice = Invoice(
            number=invoice_number,
            branch_id=None,
            subtotal=float(totals.get("subtotal", 0) or 0),
            vat=float(totals.get("iva", 0) or 0),
            discount=float(totals.get("discount", 0) or 0),
            total=float(totals.get("total", 0) or 0),
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
                line_number=int(item.get("line_number") or 0),
                product_code=item.get("product_code"),
                description=item.get("description"),
                quantity=float(item.get("quantity") or 0),
                unit_price=float(item.get("unit_price") or 0),
                subtotal=float(item.get("subtotal") or 0),
            )
            if hasattr(db_item, "unit"):
                db_item.unit = item.get("unit")
            if hasattr(db_item, "iva_percent"):
                db_item.iva_percent = item.get("iva_percent")
            if hasattr(db_item, "iva_amount"):
                db_item.iva_amount = item.get("iva_amount")
            db.add(db_item)
        db.commit()

        print(f"💾 Factura {invoice.number} guardada con éxito ({len(items)} ítems)")
        _remember_processed_file(filename)

        # === Enviar evento realtime ===
        created_timestamp = (
            invoice.created_at.isoformat() if invoice.created_at else datetime.now().isoformat()
        )
        payload = {
            "event": "new_invoice",
            "invoice_number": invoice.number,
            "items": len(items),
            "total": float(invoice.total or 0),
            "subtotal": float(invoice.subtotal or 0),
            "file": filename,
            "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
            "timestamp": created_timestamp,
            "created_at": created_timestamp,
        }

        loop = realtime_manager.loop

        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(
                realtime_manager.broadcast("FLO", payload), loop
            )
        else:
            asyncio.run(realtime_manager.broadcast("FLO", payload))

        print("📡 Notificación enviada al WebSocket (FLO).")

    except Exception as e:
        if db is not None:
            db.rollback()
        print(f"❌ Error guardando {file_path}: {e}")
        traceback.print_exc()
    finally:
        if db is not None:
            db.close()
        if invoice_lock_acquired:
            _release_invoice(invoice_number)


# ===============================
#   ESCANEO INICIAL
# ===============================
def _is_valid_invoice_file(filename: str) -> bool:
    """Valida el nombre del archivo por extensión y prefijo."""

    name_upper = filename.upper()
    prefixes = []
    for raw_prefix in FILE_PREFIX.split(","):
        prefix = raw_prefix.strip().upper()
        if not prefix:
            continue

        prefixes.append(prefix)

        numeric_prefix = "".join(ch for ch in prefix if ch.isdigit())
        if numeric_prefix and numeric_prefix != prefix:
            prefixes.append(numeric_prefix)

    if prefixes and not any(name_upper.startswith(pfx) for pfx in prefixes):
        return False

    base, ext = os.path.splitext(name_upper)
    if ext != ".XML":
        return False

    if base.endswith(".XML"):
        return False

    return True


def initial_scan(force_refresh: bool = False):
    """Procesa archivos existentes al iniciar (solo nuevos)."""
    print("🔍 Escaneo de la carpeta de facturas...")

    scheduled = 0
    skipped = 0

    try:
        processed_files = _get_processed_files(force_refresh=force_refresh)
        files = [f for f in os.listdir(NETWORK_PATH) if _is_valid_invoice_file(f)]
        print(f"📂 Archivos encontrados: {len(files)}")

        for filename in files:
            if filename in processed_files:
                skipped += 1
                print(f"⏩ Saltando {filename} (ya registrado)")
                continue

            file_path = os.path.join(NETWORK_PATH, filename)
            schedule_file_processing(file_path)
            scheduled += 1

        print("✅ Escaneo completado.")
    except Exception as e:
        print(f"⚠️ Error en el escaneo inicial: {e}")
        return {
            "scheduled": scheduled,
            "skipped": skipped,
            "error": str(e),
        }

    return {
        "scheduled": scheduled,
        "skipped": skipped,
        "total": scheduled + skipped,
    }


# ===============================
#   MONITOR DE NUEVOS ARCHIVOS
# ===============================
class InvoiceFileHandler(FileSystemEventHandler):
    """Detecta archivos nuevos y los procesa en un hilo separado."""

    def on_created(self, event):
        if event.is_directory:
            return

        filename = os.path.basename(event.src_path)
        if _is_valid_invoice_file(filename):
            print(f"🆕 Nuevo archivo detectado: {event.src_path}")
            schedule_file_processing(event.src_path)


def schedule_file_processing(file_path: str):
    """Encola el procesamiento de un archivo evitando duplicados simultáneos."""

    filename = os.path.basename(file_path)
    if not _mark_file_processing(filename):
        print(f"🔁 Archivo {filename} ya está en proceso. Se omite encolado duplicado.")
        return

    def _runner():
        try:
            process_file(file_path)
        finally:
            _release_file(filename)

    try:
        threading.Thread(target=_runner, daemon=True).start()
    except Exception:
        _release_file(filename)
        raise


def start_file_monitor():
    """Inicia el monitoreo continuo de la carpeta de red."""
    print(f"👀 Monitoreando carpeta: {NETWORK_PATH}")

    # Escaneo inicial protegido para evitar solaparse con rescaneos manuales
    with _rescan_lock:
        initial_scan(force_refresh=True)

    # Monitor en tiempo real
    event_handler = InvoiceFileHandler()
    observer: Optional[PollingObserver] = None
    next_periodic_rescan: Optional[float] = (
        time.time() + PERIODIC_RESCAN_SECONDS
        if PERIODIC_RESCAN_SECONDS > 0
        else None
    )

    while True:
        try:
            if observer is None or not observer.is_alive():
                if observer is not None:
                    try:
                        observer.stop()
                        observer.join()
                    except Exception:
                        pass

                observer = PollingObserver(timeout=POLL_INTERVAL)
                observer.schedule(event_handler, NETWORK_PATH, recursive=False)
                observer.start()
                print("✅ Monitor de archivos activo (modo solo lectura)")
                
            if (
                next_periodic_rescan is not None
                and time.time() >= next_periodic_rescan
            ):
                with _rescan_lock:
                    print("🔁 Re-escaneo periódico de facturas en curso...")
                    initial_scan()
                next_periodic_rescan = time.time() + PERIODIC_RESCAN_SECONDS

            time.sleep(5)
        except KeyboardInterrupt:
            if observer is not None:
                observer.stop()
                observer.join()
            break
        except Exception as exc:
            print(f"⚠️ Monitor detenido por error inesperado: {exc}")
            if observer is not None:
                try:
                    observer.stop()
                    observer.join()
                except Exception:
                    pass
                observer = None
            if PERIODIC_RESCAN_SECONDS > 0:
                next_periodic_rescan = time.time() + PERIODIC_RESCAN_SECONDS
            time.sleep(5)


def trigger_manual_rescan():
    """Permite lanzar un rescan desde la API sin bloquear el monitor."""

    with _rescan_lock:
        result = initial_scan(force_refresh=True)

    return result or {"scheduled": 0, "skipped": 0}