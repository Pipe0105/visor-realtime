from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, select
from datetime import datetime, timedelta
from app.database import get_db
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.schemas.invoice_schema import InvoiceCreate
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, selectinload
from app.models.branch import Branch
from app.services.realtime_manager import realtime_manager
import asyncio
import uuid

router = APIRouter()

@router.get("/")
def get_invoices(db: Session = Depends(get_db)):
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).limit(10).all()
    return {
        "invoices": [
            {
                "id": str(i.id),
                "number": i.number,
                "subtotal": float(i.subtotal),
                "vat": float(i.vat),
                "discount": float(i.discount),
                "total": float(i.total),
                "created_at": i.created_at
            }
            for i in invoices
        ]
    }

@router.post("/")
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db)):
    invoice = Invoice(
        number=data.number,
        branch_id=data.branch_id,
        issued_at=data.issued_at,
        subtotal=data.subtotal,
        vat=data.vat,
        discount=data.discount,
        total=data.total,
        source_file=data.source_file,
        invoice_date=data.invoice_date,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # Insert items
    for item in data.items:
        db_item = InvoiceItem(
            invoice_id=invoice.id,
            line_number=item.line_number,
            product_code=item.product_code,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal
        )
        db.add(db_item)

    db.commit()
    branch_code = "FLO"
    if invoice.branch_id:
        branch = db.query(Branch).filter(Branch.id == invoice.branch_id).first()
        if branch and branch.code:
            branch_code = branch.code
        else:
            branch_code = str(invoice.branch_id)

    payload = {
        "event": "new_invoice",
        "invoice_number": invoice.number,
        "items": len(data.items),
        "total": float(invoice.total or 0),
        "file": invoice.source_file,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "branch": branch_code,
    }

    loop = realtime_manager.loop
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(
            realtime_manager.broadcast(branch_code, payload), loop
        )
    else:
        asyncio.run(realtime_manager.broadcast(branch_code, payload))

    return {"message": "Invoice created successfully", "invoice_id": str(invoice.id)}

@router.get("/daily-sales")
def get_daily_sales(
    days: int = Query(7, ge=1, le=90),
    branch: str = Query("all"),
    db: Session = Depends(get_db),
):
    """Return aggregated totals per day for the requested range."""

    normalized_branch = (branch or "all").strip()
    reference_date = datetime.now()
    start_date = (
        reference_date.replace(hour=0, minute=0, second=0, microsecond=0)
        - timedelta(days=max(days - 1, 0))
    )

    date_source = func.coalesce(Invoice.invoice_date, Invoice.created_at)
    day_expression = func.date_trunc("day", date_source)

    filters = [date_source >= start_date]

    if normalized_branch.lower() != "all":
        if normalized_branch.upper() == "FLO":
            filters.append(Invoice.branch_id.is_(None))
        else:
            branch_filter = normalized_branch
            try:
                branch_uuid = uuid.UUID(branch_filter)
                filters.append(Invoice.branch_id == branch_uuid)
            except (ValueError, AttributeError):
                branch_ids = select(Branch.id).where(
                    func.lower(Branch.code) == branch_filter.lower()
                )
                filters.append(Invoice.branch_id.in_(branch_ids))

    rows = (
        db.query(
            day_expression.label("day"),
            func.coalesce(func.sum(Invoice.total), 0).label("total_sales"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .filter(*filters)
        .group_by(day_expression)
        .order_by(day_expression)
        .all()
    )

    if not rows:
        return {"history": [], "branch": normalized_branch, "days": days}

    history = []
    cumulative = 0.0
    for day, total, invoice_count in rows:
        if day is None:
            continue
        total_value = float(total or 0)
        cumulative += total_value
        history.append(
            {
                "date": day.date().isoformat(),
                "total": total_value,
                "cumulative": cumulative,
                "invoices": int(invoice_count or 0),
            }
        )

    return {"history": history, "branch": normalized_branch, "days": days}





@router.get("/today")
def get_today_invoices(
    limit: int = Query(700, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Devuelve un resumen y la página solicitada de facturas del día."""

    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    filters = [Invoice.created_at >= today, Invoice.created_at < tomorrow]

    total_invoices, total_sales_value = (
        db.query(
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total), 0),
        )
        .filter(*filters)
        .one()
    )

    total_invoices = int(total_invoices or 0)
    total_sales = float(total_sales_value or 0)
    average_ticket = total_sales / total_invoices if total_invoices else 0.0

    items_count_subquery = (
        select(func.count(InvoiceItem.id))
        .where(InvoiceItem.invoice_id == Invoice.id)
        .correlate(Invoice)
        .scalar_subquery()
    )

    invoice_rows = (
        db.query(
            Invoice.number,
            Invoice.total,
            Invoice.created_at,
            Invoice.invoice_date,
            Invoice.branch_id,
            items_count_subquery.label("items_count"),
        )
        .filter(*filters)
        .order_by(Invoice.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    invoices = []
    for inv in invoice_rows:
        invoices.append(
            {
                "invoice_number": inv.number,
                "total": float(inv.total or 0),
                "items": int(inv.items_count or 0),
                "timestamp": inv.created_at.isoformat() if inv.created_at else None,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "branch": str(inv.branch_id) if inv.branch_id else "FLO",
            }
        )

    return {
        "invoices": invoices,
        "total_invoices": total_invoices,
        "total_sales": total_sales,
        "average_ticket": average_ticket,
        "limit": limit,
        "offset": offset,
    }

@router.get("/{invoice_number}/items")
def get_invoice_items(invoice_number: str, db: Session = Depends(get_db)):
    try:
        invoice = (
            db.query(Invoice)
            .options(selectinload(Invoice.items))
            .filter(Invoice.number == invoice_number)
            .first()
        )

        if not invoice:
            return {"error": f"Factura '{invoice_number}' no encontrada"}

        return {
            "invoice_number": invoice.number,
            "items": [
                {
                    "product_code": item.product_code,
                    "description": item.description,
                    "quantity": float(item.quantity) if item.quantity is not None else 0,
                    "unit_price": float(item.unit_price) if item.unit_price is not None else 0,
                    "subtotal": float(item.subtotal) if item.subtotal is not None else 0,
                    "unit": item.unit if hasattr(item, "unit") else "",
                }
                for item in invoice.items
            ]
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"Excepción interna: {type(e).__name__}: {e}"}
