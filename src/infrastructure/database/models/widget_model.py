"""
Widget SQLAlchemy model.
Represents the widget table in the database.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class WidgetModel(Base):
    """Widget SQLAlchemy model."""
    
    __tablename__ = "widgets"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Basic information
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    widget_type = Column(String(50), nullable=False, index=True)
    
    # Configuration
    config = Column(JSON, nullable=True, default=dict)
    data_source = Column(String(255), nullable=True)
    
    # Settings
    is_public = Column(Boolean, nullable=False, default=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    dashboard_widgets = relationship("DashboardWidgetModel", back_populates="widget", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<WidgetModel(id={self.id}, name='{self.name}', type='{self.widget_type}')>"
