"""
Task Time Log SQLAlchemy model.
Represents the task_time_logs table in the database.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class TaskTimeLogModel(Base):
    """Task Time Log SQLAlchemy model."""
    
    __tablename__ = "task_time_logs"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Relationships
    task_id = Column(PostgresUUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Time tracking
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    task = relationship("TaskModel", back_populates="time_logs")
    user = relationship("UserModel", back_populates="task_time_logs")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<TaskTimeLogModel(id={self.id}, task_id={self.task_id}, user_id={self.user_id})>"
