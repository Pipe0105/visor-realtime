from sqlalchemy import Column, String, Integer, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base
from sqlalchemy.orm import relationship

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"))
    line_number = Column(Integer, nullable=False)
    product_code = Column(String)
    description = Column(String)
    quantity = Column(Numeric(10, 2), default=0)
    unit_price = Column(Numeric(12, 2), default=0)
    subtotal = Column(Numeric(12, 2), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    invoice = relationship("Invoice", back_populates="items")
