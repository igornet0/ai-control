"""
KPI SQLAlchemy model.
Represents the kpi table in the database.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Float, Integer
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class KPIModel(Base):
    """KPI SQLAlchemy model."""
    
    __tablename__ = "kpis"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Basic information
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # KPI specific fields
    kpi_type = Column(String(50), nullable=False, index=True)
    target_value = Column(Float, nullable=True)
    current_value = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    
    # Relationships
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Settings
    is_public = Column(Boolean, nullable=False, default=False, index=True)
    calculation_formula = Column(Text, nullable=True)
    data_source = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserModel", back_populates="kpis")
    calculations = relationship("KPICalculationModel", back_populates="kpi", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<KPIModel(id={self.id}, name='{self.name}', kpi_type='{self.kpi_type}')>"
