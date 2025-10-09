from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta, date
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
def get_today_invoices(db: Session = Depends(get_db)):
    # Devuelve todas las facturas creadas el día actual (desde medianoche hasta ahora).
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)

    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.items))
        .filter(Invoice.created_at >= today, Invoice.created_at < tomorrow)
        .order_by(Invoice.created_at.desc())
        .all()
    )

    result = []
    for inv in invoices:
        result.append({
            "invoice_number": inv.number,
            "total": float(inv.total),
            "items": len(inv.items) if inv.items else 0,
            "timestamp": inv.created_at.isoformat(),
            "invoice_date": inv.invoice_date,
            "branch": str(inv.branch_id) if inv.branch_id else "FLO",
        })

    return result

@router.get("/{invoice_number}/items")
def get_invoice_items(invoice_number: str, db: Session = Depends(get_db)):
    try:
        invoice = (
            db.query(Invoice)
            .options(joinedload(Invoice.items))
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
