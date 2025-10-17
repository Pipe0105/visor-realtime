from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base
from sqlalchemy.orm import relationship

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    number = Column(String, nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"))
    issued_at = Column(DateTime)
    subtotal = Column(Numeric(12, 2), default=0)
    vat = Column(Numeric(12, 2), default=0)
    discount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), default=0)
    source_file = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) # fecha crecion BD
    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    invoice_date = Column(DateTime(timezone=True)) # Fecha dentro de la factura
