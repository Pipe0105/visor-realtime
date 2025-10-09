from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class InvoiceItemCreate(BaseModel):
    line_number: int
    product_code: Optional[str]
    description: Optional[str]
    quantity: float
    unit_price: float
    subtotal: float

class InvoiceCreate(BaseModel):
    number: str
    branch_id: str
    issued_at: Optional[datetime]
    subtotal: float
    vat: float
    discount: float
    total: float
    source_file: Optional[str]
    invoice_date: Optional[datetime] = None
    items: List[InvoiceItemCreate] = []
    