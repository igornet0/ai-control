"""
Task Comment SQLAlchemy model.
Represents the task_comments table in the database.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class TaskCommentModel(Base):
    """Task Comment SQLAlchemy model."""
    
    __tablename__ = "task_comments"
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=UUID)
    
    # Relationships
    task_id = Column(PostgresUUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Content
    content = Column(Text, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    task = relationship("TaskModel", back_populates="comments")
    user = relationship("UserModel", back_populates="task_comments")
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<TaskCommentModel(id={self.id}, task_id={self.task_id}, user_id={self.user_id})>"
