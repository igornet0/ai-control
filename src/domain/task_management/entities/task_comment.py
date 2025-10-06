"""
Task comment domain entity.
Represents a comment on a task with business logic and validation.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import ValidationError


class TaskCommentCreatedEvent(DomainEvent):
    """Event raised when a task comment is created."""
    
    def __init__(self, comment_id: UUID, task_id: UUID, author_id: UUID, is_internal: bool):
        super().__init__(
            event_type="task_comment_created",
            aggregate_id=str(comment_id),
            aggregate_type="TaskComment",
            data={
                "comment_id": str(comment_id),
                "task_id": str(task_id),
                "author_id": str(author_id),
                "is_internal": is_internal,
            }
        )


class TaskCommentUpdatedEvent(DomainEvent):
    """Event raised when a task comment is updated."""
    
    def __init__(self, comment_id: UUID, task_id: UUID, author_id: UUID):
        super().__init__(
            event_type="task_comment_updated",
            aggregate_id=str(comment_id),
            aggregate_type="TaskComment",
            data={
                "comment_id": str(comment_id),
                "task_id": str(task_id),
                "author_id": str(author_id),
            }
        )


class TaskComment(Entity):
    """Task comment domain entity."""
    
    # Basic information
    task_id: UUID = Field(..., description="Task ID")
    author_id: UUID = Field(..., description="Comment author ID")
    content: str = Field(..., min_length=1, description="Comment content")
    is_internal: bool = Field(default=False, description="Internal comment flag")
    
    @validator("content")
    def validate_content(cls, v):
        """Validate comment content."""
        if not v.strip():
            raise ValidationError(
                field="content",
                value=v,
                reason="Comment content cannot be empty or only whitespace"
            )
        return v.strip()
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if comment can be edited by user."""
        return user_id == self.author_id
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if comment can be deleted by user."""
        return user_id == self.author_id
    
    def update_content(self, new_content: str, updated_by: UUID) -> None:
        """Update comment content."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this comment"
            )
        
        self.content = new_content
        self.mark_as_updated()
        self.add_domain_event(TaskCommentUpdatedEvent(self.id, self.task_id, self.author_id))
    
    @classmethod
    def create(
        cls,
        task_id: UUID,
        author_id: UUID,
        content: str,
        is_internal: bool = False,
    ) -> "TaskComment":
        """Create a new task comment."""
        comment = cls(
            task_id=task_id,
            author_id=author_id,
            content=content,
            is_internal=is_internal,
        )
        
        # Add domain event
        comment.add_domain_event(TaskCommentCreatedEvent(comment.id, task_id, author_id, is_internal))
        
        return comment
