from __future__ import annotations

from datetime import datetime, time
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.branch import Branch
from app.models.daily_summary import DailySalesSummary
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem


def _ensure_summary_table(db: Session) -> None:
    """Crea la tabla de resúmenes si aún no existe."""

    bind = db.get_bind()
    DailySalesSummary.__table__.create(bind=bind, checkfirst=True)


def _branch_code(branch_map, branch_id) -> str:
    code = branch_map.get(branch_id)
    if code:
        return code.upper()
    if branch_id is None:
        return "FLO"
    return str(branch_id)


def ensure_daily_reset(db: Session) -> bool:
    """Guarda resúmenes diarios y elimina datos anteriores al día actual."""

    today = datetime.now().date()
    midnight_today = datetime.combine(today, time.min)

    stale_exists = (
        db.query(Invoice.id)
        .filter(Invoice.created_at < midnight_today)
        .limit(1)
        .first()
    )

    if not stale_exists:
        return False

    _ensure_summary_table(db)

    branch_map = {
        branch.id: (branch.code or "").upper() if branch.code else None
        for branch in db.query(Branch).all()
    }

    date_source = func.coalesce(Invoice.invoice_date, Invoice.created_at)

    aggregation_rows = (
        db.query(
            func.date_trunc("day", date_source).label("day"),
            Invoice.branch_id,
            func.count(Invoice.id).label("invoice_count"),
            func.coalesce(func.sum(Invoice.total), 0).label("total_sales"),
            func.coalesce(func.sum(Invoice.subtotal), 0).label("total_net_sales"),
        )
        .filter(Invoice.created_at < midnight_today)
        .group_by(func.date_trunc("day", date_source), Invoice.branch_id)
        .all()
    )

    try:
        for row in aggregation_rows:
            summary_date = row.day.date()
            branch_id = row.branch_id
            summary = (
                db.query(DailySalesSummary)
                .filter(
                    DailySalesSummary.summary_date == summary_date,
                    DailySalesSummary.branch_id == branch_id,
                )
                .one_or_none()
            )

            branch_code = _branch_code(branch_map, branch_id)

            if summary:
                summary.total_invoices = int(row.invoice_count or 0)
                summary.total_sales = row.total_sales or 0
                summary.total_net_sales = row.total_net_sales or 0
                summary.branch_code = branch_code
            else:
                db.add(
                    DailySalesSummary(
                        summary_date=summary_date,
                        branch_id=branch_id,
                        branch_code=branch_code,
                        total_invoices=int(row.invoice_count or 0),
                        total_sales=row.total_sales or 0,
                        total_net_sales=row.total_net_sales or 0,
                    )
                )

        stale_invoice_ids = select(Invoice.id).filter(Invoice.created_at < midnight_today)

        db.query(InvoiceItem).filter(
            InvoiceItem.invoice_id.in_(stale_invoice_ids)
        ).delete(synchronize_session=False)

        db.query(Invoice).filter(Invoice.created_at < midnight_today).delete(
            synchronize_session=False
        )

        db.commit()
        return True

    except Exception:
        db.rollback()
        raise