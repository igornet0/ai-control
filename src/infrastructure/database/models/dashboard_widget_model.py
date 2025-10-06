"""
Dashboard Widget SQLAlchemy model.
Represents the dashboard_widgets table in the database.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class DashboardWidgetModel(Base):
    """Dashboard Widget SQLAlchemy model."""
    
    __tablename__ = "dashboard_widgets"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Relationships
    dashboard_id = Column(PostgresUUID(as_uuid=True), ForeignKey("dashboards.id"), nullable=False, index=True)
    widget_id = Column(PostgresUUID(as_uuid=True), ForeignKey("widgets.id"), nullable=False, index=True)
    
    # Layout information
    position_x = Column(Integer, nullable=False, default=0)
    position_y = Column(Integer, nullable=False, default=0)
    width = Column(Integer, nullable=False, default=4)
    height = Column(Integer, nullable=False, default=3)
    
    # Configuration
    config = Column(JSON, nullable=True, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    dashboard = relationship("DashboardModel", back_populates="dashboard_widgets")
    widget = relationship("WidgetModel", back_populates="dashboard_widgets")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<DashboardWidgetModel(id={self.id}, dashboard_id={self.dashboard_id}, widget_id={self.widget_id})>"
