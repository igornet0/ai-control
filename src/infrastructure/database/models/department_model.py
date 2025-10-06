"""
Department SQLAlchemy model.
Represents the department table in the database.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class DepartmentModel(Base):
    """Department SQLAlchemy model."""
    
    __tablename__ = "departments"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Basic information
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    organization_id = Column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    manager_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    organization = relationship("OrganizationModel", back_populates="departments")
    manager = relationship("UserModel", foreign_keys=[manager_id], back_populates="managed_departments")
    users = relationship("UserModel", foreign_keys="UserModel.department_id", back_populates="department")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<DepartmentModel(id={self.id}, name='{self.name}', organization_id={self.organization_id})>"
