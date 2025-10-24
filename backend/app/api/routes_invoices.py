import asyncio
import uuid
from datetime import date, datetime, timedelta
from math import fsum
from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, literal, select
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models.branch import Branch
from app.models.daily_summary import DailySalesSummary
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.schemas.invoice_schema import InvoiceCreate
from app.services.daily_reset import ensure_daily_reset
from app.services.file_reader import trigger_manual_rescan
from app.services.realtime_manager import realtime_manager

router = APIRouter()

FIRST_CHUNK_INVOICES = 100
DEFAULT_FORECAST_HISTORY_DAYS = 14

def _current_day_bounds():
    """Return the current time along with the start and end of the local day."""

    now = datetime.now().astimezone()
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    return now, start_of_day, end_of_day


@router.get("/")
def get_invoices(db: Session = Depends(get_db)):
    ensure_daily_reset(db)
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).limit(10).all()
    return {
        "invoices": [
            {
                "id": str(invoice.id),
                "number": invoice.number,
                "subtotal": float(invoice.subtotal),
                "vat": float(invoice.vat),
                "discount": float(invoice.discount),
                "total": float(invoice.total),
                "created_at": invoice.created_at,
            }
            for invoice in invoices
        ]
    }


@router.post("/")
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db)):
    ensure_daily_reset(db)
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

    for item in data.items:
        db_item = InvoiceItem(
            invoice_id=invoice.id,
            line_number=item.line_number,
            product_code=item.product_code,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
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
        "invoice_date": invoice.invoice_date.isoformat()
        if invoice.invoice_date
        else None,
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


@router.post("/rescan")
def rescan_invoices_folder():
    """Solicita un re-escaneo manual de la carpeta de facturas."""

    result = trigger_manual_rescan()
    scheduled = int(result.get("scheduled", 0))
    skipped = int(result.get("skipped", 0))
    total = int(result.get("total", scheduled + skipped))

    response = {
        "status": "rescan_started",
        "scheduled": scheduled,
        "skipped": skipped,
        "total": total,
    }

    if result.get("error"):
        response["error"] = result["error"]

    return response


@router.get("/daily-sales")
def get_daily_sales(
    days: int = Query(7, ge=1, le=90),
    branch: str = Query("all"),
    db: Session = Depends(get_db),
):
    """Return aggregated totals per day for the requested range."""
    ensure_daily_reset(db)

    normalized_branch = (branch or "all").strip()
    _, start_date_today, _ = _current_day_bounds()
    start_date = start_date_today - timedelta(days=max(days - 1, 0))
    start_date_only = start_date.date()

    date_source = func.coalesce(Invoice.invoice_date, Invoice.created_at)
    day_expression = func.date_trunc("day", date_source)

    branch_filters = []
    summary_branch_filters = []

    if normalized_branch.lower() != "all":
        if normalized_branch.upper() == "FLO":
            branch_filters.append(Invoice.branch_id.is_(None))
            summary_branch_filters.append(DailySalesSummary.branch_id.is_(None))
        else:
            try:
                branch_uuid = uuid.UUID(normalized_branch)
                branch_filters.append(Invoice.branch_id == branch_uuid)
                summary_branch_filters.append(
                    DailySalesSummary.branch_id == branch_uuid
                )
            except (ValueError, AttributeError):
                branch_match = (
                    db.query(Branch)
                    .filter(func.lower(Branch.code) == normalized_branch.lower())
                    .first()
                )
                if not branch_match:
                    return {
                        "history": [],
                        "branch": normalized_branch,
                        "days": days,
                    }
                branch_filters.append(Invoice.branch_id == branch_match.id)
                summary_branch_filters.append(
                    DailySalesSummary.branch_id == branch_match.id
                )

    summary_query = db.query(DailySalesSummary).filter(
        DailySalesSummary.summary_date >= start_date_only
    )
    if summary_branch_filters:
        summary_query = summary_query.filter(*summary_branch_filters)

    summaries = summary_query.all()

    history_map: dict[datetime.date, dict[str, float | int]] = {}
    for summary in summaries:
        entry = history_map.setdefault(
            summary.summary_date,
            {"total": 0.0, "net": 0.0, "invoices": 0},
        )
        entry["total"] += float(summary.total_sales or 0)
        entry["net"] += float(summary.total_net_sales or 0)
        entry["invoices"] += int(summary.total_invoices or 0)

    filters = [date_source >= start_date]
    if branch_filters:
        filters.extend(branch_filters)

    rows = (
        db.query(
            day_expression.label("day"),
            func.coalesce(func.sum(Invoice.total), 0).label("total_sales"),
            func.coalesce(func.sum(Invoice.subtotal), 0).label("net_sales"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .filter(*filters)
        .group_by(day_expression)
        .order_by(day_expression)
        .all()
    )

    for day, total, net_sales, invoice_count in rows:
        if day is None:
            continue
        target_date = day.date()
        entry = history_map.setdefault(
            target_date,
            {"total": 0.0, "net": 0.0, "invoices": 0},
        )
        entry["total"] += float(total or 0)
        entry["net"] += float(net_sales or 0)
        entry["invoices"] += int(invoice_count or 0)

    if not history_map:
        return {"history": [], "branch": normalized_branch, "days": days}

    ordered_days = sorted(history_map.keys())
    history = []
    cumulative = 0.0
    for day in ordered_days:
        total_value = history_map[day]["total"]
        cumulative += total_value
        history.append(
            {
                "date": day.isoformat(),
                "total": total_value,
                "cumulative": cumulative,
                "invoices": history_map[day]["invoices"],
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

    ensure_daily_reset(db)

    _, today_start, tomorrow_start = _current_day_bounds()
    filters = [
        Invoice.created_at >= today_start,
        Invoice.created_at < tomorrow_start,
    ]

    (
        total_invoices,
        total_sales_value,
        total_net_sales_value,
    ) = (
        db.query(
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total), 0),
            func.coalesce(func.sum(Invoice.subtotal), 0),
        )
        .filter(*filters)
        .one()
    )

    total_invoices = int(total_invoices or 0)
    total_sales = float(total_sales_value or 0)
    total_net_sales = float(total_net_sales_value or 0)
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
            Invoice.subtotal,
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
    for row in invoice_rows:
        invoices.append(
            {
                "invoice_number": row.number,
                "total": float(row.total or 0),
                "items": int(row.items_count or 0),
                "timestamp": row.created_at.isoformat() if row.created_at else None,
                "invoice_date": row.invoice_date.isoformat()
                if row.invoice_date
                else None,
                "branch": str(row.branch_id) if row.branch_id else "FLO",
            }
        )

    return {
        "invoices": invoices,
        "total_invoices": total_invoices,
        "total_sales": total_sales,
        "total_net_sales": total_net_sales,
        "average_ticket": average_ticket,
        "limit": limit,
        "offset": offset,
    }


def _resolve_branch_filters(db: Session, branch: str) -> dict[str, object]:
    normalized_branch = (branch or "all").strip()

    if normalized_branch.lower() == "all":
        return {"filters": [], "summary_filters": [], "label": "all"}

    if normalized_branch.upper() == "FLO":
        return {
            "filters": [Invoice.branch_id.is_(None)],
            "summary_filters": [DailySalesSummary.branch_id.is_(None)],
            "label": "FLO",
        }

    try:
        branch_uuid = uuid.UUID(normalized_branch)
        return {
            "filters": [Invoice.branch_id == branch_uuid],
            "summary_filters": [DailySalesSummary.branch_id == branch_uuid],
            "label": str(branch_uuid),
        }
    except (ValueError, AttributeError):
        branch_match = (
            db.query(Branch)
            .filter(func.lower(Branch.code) == normalized_branch.lower())
            .first()
        )
        if branch_match:
            return {
                "filters": [Invoice.branch_id == branch_match.id],
                "summary_filters": [DailySalesSummary.branch_id == branch_match.id],
                "label": branch_match.code or str(branch_match.id),
            }

    return {
        "filters": None,
        "summary_filters": None,
        "label": normalized_branch,
    }


def _float_or_zero(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0

def _determinant_3x3(a11, a12, a13, a21, a22, a23, a31, a32, a33):
    return (
        a11 * (a22 * a33 - a23 * a32)
        - a12 * (a21 * a33 - a23 * a31)
        + a13 * (a21 * a32 - a22 * a31)
    )


def _linear_regression_coefficients(samples):
    if len(samples) < 3:
        return None

    sum_x1 = fsum(sample[0] for sample in samples)
    sum_x2 = fsum(sample[1] for sample in samples)
    sum_y = fsum(sample[2] for sample in samples)

    sum_x1x1 = fsum(sample[0] * sample[0] for sample in samples)
    sum_x2x2 = fsum(sample[1] * sample[1] for sample in samples)
    sum_x1x2 = fsum(sample[0] * sample[1] for sample in samples)

    sum_x1y = fsum(sample[0] * sample[2] for sample in samples)
    sum_x2y = fsum(sample[1] * sample[2] for sample in samples)

    n = float(len(samples))

    a11 = n
    a12 = sum_x1
    a13 = sum_x2
    a21 = sum_x1
    a22 = sum_x1x1
    a23 = sum_x1x2
    a31 = sum_x2
    a32 = sum_x1x2
    a33 = sum_x2x2

    determinant = _determinant_3x3(
        a11, a12, a13,
        a21, a22, a23,
        a31, a32, a33,
    )

    if abs(determinant) < 1e-9:
        return None

    det_b0 = _determinant_3x3(
        sum_y, a12, a13,
        sum_x1y, a22, a23,
        sum_x2y, a32, a33,
    )
    det_b1 = _determinant_3x3(
        a11, sum_y, a13,
        a21, sum_x1y, a23,
        a31, sum_x2y, a33,
    )
    det_b2 = _determinant_3x3(
        a11, a12, sum_y,
        a21, a22, sum_x1y,
        a31, a32, sum_x2y,
    )

    intercept = det_b0 / determinant
    coef_first_chunk = det_b1 / determinant
    coef_previous_total = det_b2 / determinant

    return intercept, coef_first_chunk, coef_previous_total



@router.get("/today/forecast")
def get_today_forecast(
    branch: str = Query("all"),
    history_days: int = Query(DEFAULT_FORECAST_HISTORY_DAYS, ge=3, le=90),
    db: Session = Depends(get_db),
):
    ensure_daily_reset(db)

    resolution = _resolve_branch_filters(db, branch)
    branch_filters = resolution["filters"]
    summary_filters = resolution["summary_filters"]
    branch_label = resolution["label"]

    if branch_filters is None:
        return {
            "branch": branch_label,
            "history": [],
            "today": {
                "current_total": 0.0,
                "current_net_total": 0.0,
                "invoice_count": 0,
                "first_chunk_total": 0.0,
                "first_chunk_invoices": 0,
                "average_ticket": 0.0,
            },
            "forecast": {
                "total": 0.0,
                "remaining": 0.0,
                "method": "no_branch_match",
                "ratio": 0.0,
                "history_days": 0,
                "history_samples": 0,
                "history_average_total": 0.0,
                "history_average_first_chunk": 0.0,
                "generated_at": datetime.utcnow().isoformat() + "Z",
            },
        }

    now, today_start, tomorrow_start = _current_day_bounds()
    current_day_elapsed_seconds = max(
        (now - today_start).total_seconds(),
        0.0,
    )
    history_start = today_start - timedelta(days=history_days)
    yesterday = today_start.date() - timedelta(days=1)

    history_filters = [
        Invoice.created_at >= history_start,
        Invoice.created_at < today_start,
    ]
    today_filters = [
        Invoice.created_at >= today_start,
        Invoice.created_at < tomorrow_start,
    ]

    if branch_filters:
        history_filters.extend(branch_filters)
        today_filters.extend(branch_filters)

    day_expression = func.date_trunc("day", Invoice.created_at)

    yesterday_summary_query = db.query(
        func.coalesce(func.sum(DailySalesSummary.total_sales), 0).label("total_sales"),
        func.coalesce(func.sum(DailySalesSummary.total_net_sales), 0).label("net_sales"),
        func.coalesce(func.sum(DailySalesSummary.total_invoices), 0).label(
            "invoice_count"
        ),
    ).filter(DailySalesSummary.summary_date == yesterday)

    if summary_filters:
        yesterday_summary_query = yesterday_summary_query.filter(*summary_filters)

    yesterday_summary = yesterday_summary_query.one_or_none()

    previous_total = _float_or_zero(
        yesterday_summary.total_sales if yesterday_summary else 0
    )
    previous_net_total = _float_or_zero(
        yesterday_summary.net_sales if yesterday_summary else 0
    )
    previous_invoice_count = (
        int(yesterday_summary.invoice_count or 0) if yesterday_summary else 0
    )
    
    seconds_since_day_start = func.extract(
        "epoch",
        Invoice.created_at - func.date_trunc("day", Invoice.created_at),

    )

    history_subquery = (
        db.query(
            day_expression.label("day"),
            Invoice.total.label("invoice_total"),
            seconds_since_day_start.label("seconds_since_day_start"),
            func.row_number()
            .over(
                partition_by=day_expression,
                order_by=[Invoice.created_at.asc(), Invoice.id.asc()],
            )
            .label("row_number"),
        )
        .filter(*history_filters)
        .subquery()
    )

    first_chunk_case = case(
        (history_subquery.c.row_number <= FIRST_CHUNK_INVOICES, history_subquery.c.invoice_total),
        else_=0,
    )
    
    partial_total_case = case (
        (
            history_subquery.c.seconds_since_day_start
            <= literal(current_day_elapsed_seconds),
            history_subquery.c.invoice_total,
        ),
        else_=0,
    )

    history_rows = (
        db.query(
            history_subquery.c.day.label("day"),
            func.count().label("invoice_count"),
            func.coalesce(func.sum(history_subquery.c.invoice_total), 0).label(
                "total_sales"
            ),
            func.coalesce(func.sum(first_chunk_case), 0).label("first_chunk_total"),
            func.coalesce(func.sum(partial_total_case), 0).label("partial_total"),
        )
        .group_by(history_subquery.c.day)
        .order_by(history_subquery.c.day.desc())
        .limit(history_days)
        .all()
    )
    
    def _parse_history_day(value):
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if value is None:
            return None
        try:
            return datetime.fromisoformat(str(value)).date()
        except (TypeError, ValueError):
            return None

    def _format_history_day(value):
        parsed = _parse_history_day(value)
        if parsed is not None:
            return parsed, parsed.isoformat()
        return None, str(value)

    history_data = []
    ratio_samples = []
    time_ratio_samples = []
    total_accumulator = 0.0
    first_chunk_accumulator = 0.0
    yesterday_first_chunk_total = 0.0

    for row in history_rows:
        parsed_day, display_day = _format_history_day(row.day)
        total_sales = _float_or_zero(row.total_sales)
        first_chunk_total = _float_or_zero(row.first_chunk_total)
        partial_total = _float_or_zero(row.partial_total)
        invoice_count = int(row.invoice_count or 0)

        ratio = None
        if first_chunk_total > 0:
            ratio = total_sales / first_chunk_total
            ratio_samples.append((ratio, total_sales))

        time_ratio = None
        if partial_total > 0 and total_sales > 0:
            time_ratio = total_sales / partial_total
            time_ratio_samples.append((time_ratio, total_sales))

        history_data.append(
            {
                "date": parsed_day,
                "display_date": display_day,
                "total": total_sales,
                "first_chunk_total": first_chunk_total,
                "partial_total": partial_total,
                "invoice_count": invoice_count,
                "ratio": ratio,
                "time_ratio": time_ratio,
            }
        )

        total_accumulator += total_sales
        first_chunk_accumulator += first_chunk_total
        if parsed_day is not None and parsed_day == yesterday:
            yesterday_first_chunk_total = first_chunk_total

    history_data.reverse()

    history_entries = []
    regression_samples = []
    totals_by_date = {}

    for entry in history_data:
        entry_date = entry["date"]
        previous_total_value = None

        if isinstance(entry_date, date):
            previous_day = entry_date - timedelta(days=1)
            previous_total_value = totals_by_date.get(previous_day)
            totals_by_date[entry_date] = entry["total"]

        history_entries.append(
            {
                "date": entry["display_date"],
                "total": entry["total"],
                "first_chunk_total": entry["first_chunk_total"],
                "partial_total": entry.get("partial_total"),
                "invoice_count": entry["invoice_count"],
                "ratio": entry["ratio"],
                "time_ratio": entry.get("time_ratio"),
                "previous_total": previous_total_value,
            }
        )

        if (
            previous_total_value is not None
            and isinstance(entry_date, date)
        ):
            regression_samples.append(
                (
                    entry["first_chunk_total"],
                    previous_total_value,
                    entry["total"],
                )
            )

    weighted_ratio_sum = sum(ratio * weight for ratio, weight in ratio_samples)
    weight_total = sum(weight for _, weight in ratio_samples)

    if weight_total > 0:
        average_ratio = weighted_ratio_sum / weight_total
    elif ratio_samples:
        average_ratio = sum(ratio for ratio, _ in ratio_samples) / len(ratio_samples)
    else:
        average_ratio = 1.0
        
    weighted_time_ratio_sum = sum(
        ratio * weight for ratio, weight in time_ratio_samples
    )
    time_weight_total = sum(weight for _, weight in time_ratio_samples)

    if time_weight_total > 0:
        average_time_ratio = weighted_time_ratio_sum / time_weight_total
    elif time_ratio_samples:
        average_time_ratio = sum(
            ratio for ratio, _ in time_ratio_samples
        ) / len(time_ratio_samples)
    else:
        average_time_ratio = None

    today_first_chunk_rows = (
        db.query(Invoice.total)
        .filter(*today_filters)
        .order_by(Invoice.created_at.asc(), Invoice.id.asc())
        .limit(FIRST_CHUNK_INVOICES)
        .all()
    )

    first_chunk_total_today = sum(
        _float_or_zero(row.total) for row in today_first_chunk_rows
    )
    first_chunk_invoices_today = len(today_first_chunk_rows)

    today_totals_row = (
        db.query(
            func.coalesce(func.sum(Invoice.total), 0).label("current_total"),
            func.coalesce(func.sum(Invoice.subtotal), 0).label("current_net_total"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .filter(*today_filters)
        .one()
    )

    current_total = _float_or_zero(today_totals_row.current_total)
    current_net_total = _float_or_zero(today_totals_row.current_net_total)
    current_invoice_count = int(today_totals_row.invoice_count or 0)
    
    if history_entries:
        historical_average_total = total_accumulator / len(history_entries)
        historical_average_first_chunk = (
            first_chunk_accumulator / len(history_entries)
        )
    else:
        historical_average_total = current_total
        historical_average_first_chunk = first_chunk_total_today
    
    regression_coefficients = _linear_regression_coefficients(regression_samples)
    regression_prediction = None
    if (
        regression_coefficients is not None
        and first_chunk_total_today > 0
    ):
        intercept, coef_first_chunk, coef_previous_total = regression_coefficients
        regression_prediction = (
            intercept
            + coef_first_chunk * first_chunk_total_today
            + coef_previous_total * previous_total
        )
        
    history_totals = [
        entry["total"]
        for entry in history_entries
        if isinstance(entry.get("total"), (int, float))
    ]
    trend_forecast = None
    if len(history_totals) >= 2:
        x_values = list(range(len(history_totals)))
        mean_x = sum(x_values) / len(x_values)
        mean_y = sum(history_totals) / len(history_totals)
        numerator = sum(
            (x - mean_x) * (y - mean_y)
            for x, y in zip(x_values, history_totals)
        )
        denominator = sum((x - mean_x) ** 2 for x in x_values)
        if denominator > 0:
            slope = numerator / denominator
            intercept = mean_y - slope * mean_x
            trend_forecast = intercept + slope * len(history_totals)
            if trend_forecast is not None and trend_forecast < 0:
                trend_forecast = 0.0

    forecast_total = current_total
    forecast_method = "current_total_only"
    forecast_ratio = average_ratio

    if (
        regression_prediction is not None
        and regression_prediction > 0
    ):
        regression_total = max(regression_prediction, current_total)
        forecast_total = regression_total
        forecast_method = "linear_regression"
        if first_chunk_total_today > 0:
            forecast_ratio = forecast_total / first_chunk_total_today
    elif (
        current_total > 0
        and average_time_ratio
        and average_time_ratio > 0
        and current_invoice_count > first_chunk_invoices_today
    ):
        time_based_total = current_total * average_time_ratio
        forecast_total = max(time_based_total, current_total)
        forecast_method = "time_of_day_ratio"
        if first_chunk_total_today > 0:
            forecast_ratio = forecast_total / first_chunk_total_today
        elif historical_average_first_chunk > 0:
            forecast_ratio = forecast_total / historical_average_first_chunk
        else:
            forecast_ratio = average_time_ratio or 1.0
    elif (
        first_chunk_total_today > 0
        and previous_total > 0
        and yesterday_first_chunk_total > 0
    ):
        forecast_ratio = previous_total / yesterday_first_chunk_total
        forecast_total = first_chunk_total_today * forecast_ratio
        forecast_method = "previous_day_first_chunk_ratio"
    elif first_chunk_total_today > 0 and ratio_samples:
        forecast_total = first_chunk_total_today * average_ratio
        forecast_method = "first_chunk_ratio"
    else:
        blended_candidates = []
        if trend_forecast is not None:
            blended_candidates.append((trend_forecast, 0.45))
        if total_accumulator > 0 and history_entries:
            blended_candidates.append((historical_average_total, 0.25))
        if previous_total > 0:
            weight = 0.3 if trend_forecast is not None else 0.5
            blended_candidates.append((previous_total, weight))

        if blended_candidates:
            weight_sum = sum(weight for _, weight in blended_candidates)
            if weight_sum > 0:
                blended_total = sum(
                    value * weight for value, weight in blended_candidates
                ) / weight_sum
                forecast_total = max(blended_total, current_total)
                forecast_method = "blended_historical_estimate"
                if first_chunk_total_today > 0:
                    forecast_ratio = forecast_total / first_chunk_total_today
                elif historical_average_first_chunk > 0:
                    forecast_ratio = forecast_total / historical_average_first_chunk
                else:
                    forecast_ratio = average_ratio
        elif total_accumulator > 0 and history_entries:
            forecast_total = total_accumulator / len(history_entries)
            forecast_method = "historical_average"

    if (
        previous_total > 0
        and forecast_total < previous_total
        and forecast_method == "current_total_only"
    ):
        forecast_total = previous_total
        forecast_method = "previous_total_only"
        forecast_ratio = 1.0

    remaining_total = max(forecast_total - current_total, 0)

    return {
        "branch": branch_label,
        "history": history_entries,
        "today": {
            "current_total": current_total,
            "current_net_total": current_net_total,
            "invoice_count": current_invoice_count,
            "first_chunk_total": first_chunk_total_today,
            "first_chunk_invoices": first_chunk_invoices_today,
            "average_ticket": current_total / current_invoice_count
            if current_invoice_count
            else 0.0,
        },
        "forecast": {
            "total": forecast_total,
            "remaining": remaining_total,
            "method": forecast_method,
            "ratio": forecast_ratio,
            "history_days": len(history_entries),
            "history_samples": len(ratio_samples),
            "history_average_total": historical_average_total,
            "history_average_first_chunk": historical_average_first_chunk,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "previous_total": previous_total,
            "previous_net_total": previous_net_total,
            "previous_invoice_count": previous_invoice_count,
            "previous_date": yesterday.isoformat(),
        },
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
        
        sorted_items = sorted(
            invoice.items,
            key=lambda item: (
                0
                if item.line_number is not None
                else 1,
                item.line_number if item.line_number is not None else 0,
                item.description or "",
            ),
        )

        return {
            "invoice_number": invoice.number,
            "items": [
                {
                    "line_number": int(item.line_number)
                    if item.line_number is not None
                    else None,
                    "product_code": item.product_code,
                    "description": item.description,
                    "quantity": float(item.quantity)
                    if item.quantity is not None
                    else 0,
                    "unit_price": float(item.unit_price)
                    if item.unit_price is not None
                    else 0,
                    "subtotal": float(item.subtotal)
                    if item.subtotal is not None
                    else 0,
                    "unit": getattr(item, "unit", ""),
                }
                for item in sorted_items
            ],
        }

    except Exception as exc:  # pragma: no cover - defensive path
        import traceback

        traceback.print_exc()
        return {"error": f"Excepción interna: {type(exc).__name__}: {exc}"}
