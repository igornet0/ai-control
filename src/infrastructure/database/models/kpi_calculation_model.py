"""
KPI Calculation SQLAlchemy model.
Represents the kpi_calculations table in the database.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class KPICalculationModel(Base):
    """KPI Calculation SQLAlchemy model."""
    
    __tablename__ = "kpi_calculations"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Relationships
    kpi_id = Column(PostgresUUID(as_uuid=True), ForeignKey("kpis.id"), nullable=False, index=True)
    
    # Calculation data
    value = Column(Float, nullable=False)
    calculated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Metadata
    calculation_method = Column(String(100), nullable=True)
    data_points = Column(Text, nullable=True)  # JSON string of data used for calculation
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    kpi = relationship("KPIModel", back_populates="calculations")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<KPICalculationModel(id={self.id}, kpi_id={self.kpi_id}, value={self.value})>"
