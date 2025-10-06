"""
Organization SQLAlchemy model.
Represents the organization table in the database.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class OrganizationModel(Base):
    """Organization SQLAlchemy model."""
    
    __tablename__ = "organizations"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Basic information
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # Contact information
    website = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    departments = relationship("DepartmentModel", back_populates="organization")
    users = relationship("UserModel", back_populates="organization")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<OrganizationModel(id={self.id}, name='{self.name}')>"
