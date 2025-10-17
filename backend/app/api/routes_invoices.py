from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, select
from datetime import datetime, timedelta
from app.database import get_db
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.schemas.invoice_schema import InvoiceCreate

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
        source_file=data.source_file
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
    return {"message": "Invoice created successfully", "invoice_id": str(invoice.id)}



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
        .order_by(Invoice.created_at.desc())
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
