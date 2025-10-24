import os
import sys
import pytest


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..",".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
    
from shared.helpers import estimate_daily_sales_total

def _build_history_samples():
    base_samples = [
        (1000.0, 50, 4000.0),
        (800.0, 40, 3800.0),
        (1200.0, 55, 4200.0),
        (900.0, 45, 4100.0),
        (1100.0, 52, 4150.0),
    ]
    
    history = []
    for partial, invoices, previous in base_samples:
        total = 500 + 1.25 * partial + 12 * invoices + 0.1 * previous
        history.append(
            {
                "partial_total": partial,
                "invoice_count": invoices,
                "previous_total": previous,
                "total": total,
            }
        )
    return history

def test_estimate_daily_sales_total_uses_regression_coefficients():
    history = _build_history_samples()
    expected_total = 500 + 1.25 * 9550 +12 * 48 + 0.1 * 4180
    
    result = estimate_daily_sales_total(
        partial_sales= 950,
        invoice_count= 48,
        previous_total= 4180,
        history= history,
    )
    
    assert result ==  pytest.approx(expected_total, rel=0.05)
    assert result >= 950
    
def test_estimate_daily_sales_total_falls_back_to_ratio_when_history_is_small():
    history = [
        {
            "partial_total": 500.0,
            "invoice_count": 5,
            "previous_total": 1000.0,
            "total": 1500.0,
        }
    ]
    
    result = estimate_daily_sales_total(
        partial_sales= 600,
        invoice_count= 6,
        previous_total= 1200,
        history= history,
    )
    
    
    assert result == pytest.approx(1800.0)
    assert result >= 600