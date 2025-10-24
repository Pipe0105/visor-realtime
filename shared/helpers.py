"""Utility helpers shared across backend and frontend packages."""

from __future__ import annotations

from math import fsum
from typing import Iterable, Mapping, MutableSequence, Optional, Sequence, Tuple


def _safe_float(value: object) -> float:
    """Convert ``value`` to ``float`` falling back to ``0.0`` when invalid."""

    try:
        return float(value or 0.0)
    except (TypeError, ValueError):  # pragma: no cover - extremely defensive
        return 0.0


def _safe_int(value: object) -> int:
    """Convert ``value`` to ``int`` falling back to ``0`` when invalid."""

    try:
        return int(value or 0)
    except (TypeError, ValueError):  # pragma: no cover - extremely defensive
        return 0


def _gaussian_elimination(matrix: MutableSequence[MutableSequence[float]], vector: Sequence[float]) -> Optional[Tuple[float, ...]]:
    """Solve ``Ax = b`` for a square ``A`` using Gaussian elimination with pivoting.

    The helper is intentionally tiny (no NumPy dependency) and only supports
    systems up to a handful of variables – perfect for the small regression
    system we need to solve.
    """

    size = len(matrix)
    if size == 0 or any(len(row) != size for row in matrix):
        return None

    # Build the augmented matrix ``[A | b]`` to operate in-place.
    augmented = [list(row) + [float(vector[idx])] for idx, row in enumerate(matrix)]

    for pivot_index in range(size):
        # Partial pivoting keeps the system reasonably stable.
        pivot_row = max(
            range(pivot_index, size),
            key=lambda row_idx: abs(augmented[row_idx][pivot_index]),
        )
        pivot_value = augmented[pivot_row][pivot_index]
        if abs(pivot_value) < 1e-12:
            return None

        if pivot_row != pivot_index:
            augmented[pivot_index], augmented[pivot_row] = (
                augmented[pivot_row],
                augmented[pivot_index],
            )

        # Normalise the pivot row.
        pivot_value = augmented[pivot_index][pivot_index]
        for column in range(pivot_index, size + 1):
            augmented[pivot_index][column] /= pivot_value

        # Eliminate the pivot column from the other rows.
        for row_idx in range(size):
            if row_idx == pivot_index:
                continue
            factor = augmented[row_idx][pivot_index]
            if factor == 0:
                continue
            for column in range(pivot_index, size + 1):
                augmented[row_idx][column] -= factor * augmented[pivot_index][column]

    solution = tuple(augmented[row][size] for row in range(size))
    return solution


def _multiple_linear_regression_coefficients(samples: Sequence[Tuple[float, float, float, float]]) -> Optional[Tuple[float, float, float, float]]:
    """Return coefficients for ``total ~ partial + invoices + previous``.

    The returned tuple is ``(intercept, coef_partial, coef_invoices, coef_previous)``.
    ``None`` is returned when the system is singular or when there are not
    enough samples to fit a meaningful model.
    """

    if len(samples) < 3:
        return None

    sum_partial = fsum(sample[0] for sample in samples)
    sum_invoices = fsum(sample[1] for sample in samples)
    sum_previous = fsum(sample[2] for sample in samples)
    sum_total = fsum(sample[3] for sample in samples)

    sum_partial_partial = fsum(sample[0] * sample[0] for sample in samples)
    sum_invoices_invoices = fsum(sample[1] * sample[1] for sample in samples)
    sum_previous_previous = fsum(sample[2] * sample[2] for sample in samples)

    sum_partial_invoices = fsum(sample[0] * sample[1] for sample in samples)
    sum_partial_previous = fsum(sample[0] * sample[2] for sample in samples)
    sum_invoices_previous = fsum(sample[1] * sample[2] for sample in samples)

    sum_partial_total = fsum(sample[0] * sample[3] for sample in samples)
    sum_invoices_total = fsum(sample[1] * sample[3] for sample in samples)
    sum_previous_total = fsum(sample[2] * sample[3] for sample in samples)

    n = float(len(samples))

    matrix = [
        [n, sum_partial, sum_invoices, sum_previous],
        [sum_partial, sum_partial_partial, sum_partial_invoices, sum_partial_previous],
        [sum_invoices, sum_partial_invoices, sum_invoices_invoices, sum_invoices_previous],
        [sum_previous, sum_partial_previous, sum_invoices_previous, sum_previous_previous],
    ]
    vector = [
        sum_total,
        sum_partial_total,
        sum_invoices_total,
        sum_previous_total,
    ]

    solution = _gaussian_elimination(matrix, vector)
    if solution is None:
        return None

    intercept, coef_partial, coef_invoices, coef_previous = solution
    return intercept, coef_partial, coef_invoices, coef_previous


def estimate_daily_sales_total(
    partial_sales: float,
    invoice_count: int,
    previous_total: float,
    history: Optional[Iterable[Mapping[str, object] | Sequence[object]]] = None,
) -> float:
    """Estimate today's total sales using a regression-based approach.

    Parameters
    ----------
    partial_sales:
        Sales accumulated so far for the current day.
    invoice_count:
        Number of invoices processed so far today.
    previous_total:
        Total sales registered on the previous day. Used as a predictive
        feature and as a sensible fallback when the regression cannot be
        computed.
    history:
        Iterable with historical daily entries. Each entry can be either a
        mapping (dictionary-like) or a sequence. The expected ordering is
        ``(partial_total, invoice_count, previous_total, total)`` and missing
        values default to ``0``. When enough history is present we fit a
        multiple linear regression ``total ~ partial + invoices + previous``.

    Returns
    -------
    float
        Predicted total sales for the end of the current day.
    """

    partial_today = _safe_float(partial_sales)
    invoices_today = _safe_int(invoice_count)
    previous_total = _safe_float(previous_total)

    cleaned_samples: list[Tuple[float, float, float, float]] = []
    history = history or []

    for entry in history:
        if entry is None:
            continue

        partial_value: float
        invoice_value: int
        previous_value: float
        total_value: float

        if isinstance(entry, Mapping):
            total_value = _safe_float(entry.get("total"))
            partial_value = _safe_float(
                entry.get("partial_total")
                or entry.get("partial")
                or entry.get("current_total")
            )
            invoice_value = _safe_int(entry.get("invoice_count"))
            previous_value = _safe_float(entry.get("previous_total"))
        elif isinstance(entry, Sequence) and len(entry) >= 4:
            partial_value = _safe_float(entry[0])
            invoice_value = _safe_int(entry[1])
            previous_value = _safe_float(entry[2])
            total_value = _safe_float(entry[3])
        else:  # pragma: no cover - defensive branch
            continue

        cleaned_samples.append(
            (partial_value, float(invoice_value), previous_value, total_value)
        )

    regression_coefficients = _multiple_linear_regression_coefficients(cleaned_samples)
    prediction: Optional[float] = None

    if regression_coefficients is not None:
        intercept, coef_partial, coef_invoices, coef_previous = regression_coefficients
        prediction = (
            intercept
            + coef_partial * partial_today
            + coef_invoices * float(invoices_today)
            + coef_previous * previous_total
        )

    # Guard against poorly conditioned systems that may yield NaN/inf.
    if prediction is None or not (prediction == prediction) or prediction <= 0:
        prediction = None

    ratio_candidates = [
        total / sample_partial
        for sample_partial, _invoice, _previous, total in cleaned_samples
        if sample_partial > 0 and total > 0
    ]
    avg_ratio = fsum(ratio_candidates) / len(ratio_candidates) if ratio_candidates else None

    avg_ticket_candidates = [
        total / invoice if invoice > 0 else None
        for _partial, invoice, _previous, total in cleaned_samples
    ]
    avg_ticket_candidates = [value for value in avg_ticket_candidates if value]
    avg_ticket = (
        fsum(avg_ticket_candidates) / len(avg_ticket_candidates)
        if avg_ticket_candidates
        else None
    )

    history_totals = [total for _p, _i, _prev, total in cleaned_samples]
    history_average_total = (
        fsum(history_totals) / len(history_totals)
        if history_totals
        else None
    )

    fallback_candidates = []
    if avg_ratio is not None and partial_today > 0:
        fallback_candidates.append(partial_today * avg_ratio)
    if avg_ticket is not None and invoices_today > 0:
        fallback_candidates.append(avg_ticket * invoices_today)
    if previous_total > 0:
        fallback_candidates.append(previous_total)
    if history_average_total is not None:
        fallback_candidates.append(history_average_total)
    if partial_today > 0:
        fallback_candidates.append(partial_today)

    fallback_prediction = max(fallback_candidates) if fallback_candidates else partial_today

    if prediction is None:
        prediction = fallback_prediction
    else:
        prediction = max(prediction, partial_today)

    return max(prediction, 0.0)


__all__ = ["estimate_daily_sales_total"]
