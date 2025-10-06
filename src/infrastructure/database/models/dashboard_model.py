"""
Dashboard SQLAlchemy model.
Represents the dashboard table in the database.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class DashboardModel(Base):
    """Dashboard SQLAlchemy model."""
    
    __tablename__ = "dashboards"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Basic information
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Settings
    is_public = Column(Boolean, nullable=False, default=False, index=True)
    layout = Column(JSON, nullable=True, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserModel", back_populates="dashboards")
    dashboard_widgets = relationship("DashboardWidgetModel", back_populates="dashboard", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<DashboardModel(id={self.id}, name='{self.name}', user_id={self.user_id})>"
