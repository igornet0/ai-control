"""
Task SQLAlchemy model.
Represents the task table in the database.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class TaskModel(Base):
    """Task SQLAlchemy model."""
    
    __tablename__ = "tasks"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Basic information
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    assignee_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    creator_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Status and priority
    status = Column(String(50), nullable=False, default="todo", index=True)
    priority = Column(String(50), nullable=False, default="medium", index=True)
    
    # Dates
    due_date = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Additional fields
    tags = Column(ARRAY(String), nullable=True, default=list)
    
    # Relationships
    assignee = relationship("UserModel", foreign_keys=[assignee_id], back_populates="assigned_tasks")
    creator = relationship("UserModel", foreign_keys=[creator_id], back_populates="created_tasks")
    comments = relationship("TaskCommentModel", back_populates="task", cascade="all, delete-orphan")
    time_logs = relationship("TaskTimeLogModel", back_populates="task", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<TaskModel(id={self.id}, title='{self.title}', status='{self.status}')>"
