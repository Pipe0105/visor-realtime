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
