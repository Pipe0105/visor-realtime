from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class DailySalesSummary(Base):
    """Persisted resumen de ventas por día y sucursal."""

    __tablename__ = "daily_sales_summary"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    summary_date = Column(Date, nullable=False)
    branch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
    )
    branch_code = Column(String, nullable=False)
    total_sales = Column(Numeric(14, 2), default=0)
    total_net_sales = Column(Numeric(14, 2), default=0)
    total_invoices = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "summary_date",
            "branch_id",
            name="uq_daily_sales_branch_day",
        ),
    )