from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Branch(Base):
    __tablename__ = "branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    code = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
