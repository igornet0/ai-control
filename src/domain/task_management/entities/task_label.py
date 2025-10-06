"""
Task label domain entity.
Represents a label attached to a task.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import ValidationError


class TaskLabelAddedEvent(DomainEvent):
    """Event raised when a label is added to a task."""
    
    def __init__(self, label_id: UUID, task_id: UUID, name: str, color: str):
        super().__init__(
            event_type="task_label_added",
            aggregate_id=str(label_id),
            aggregate_type="TaskLabel",
            data={
                "label_id": str(label_id),
                "task_id": str(task_id),
                "name": name,
                "color": color,
            }
        )


class TaskLabelRemovedEvent(DomainEvent):
    """Event raised when a label is removed from a task."""
    
    def __init__(self, label_id: UUID, task_id: UUID, name: str):
        super().__init__(
            event_type="task_label_removed",
            aggregate_id=str(label_id),
            aggregate_type="TaskLabel",
            data={
                "label_id": str(label_id),
                "task_id": str(task_id),
                "name": name,
            }
        )


class TaskLabel(Entity):
    """Task label domain entity."""
    
    # Basic information
    task_id: UUID = Field(..., description="Task ID")
    name: str = Field(..., min_length=1, max_length=100, description="Label name")
    color: str = Field(default="#007bff", description="Label color (HEX)")
    description: Optional[str] = Field(default=None, max_length=255, description="Label description")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate label name."""
        if not v.strip():
            raise ValidationError(
                field="name",
                value=v,
                reason="Label name cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("color")
    def validate_color(cls, v):
        """Validate label color."""
        if not v.startswith("#") or len(v) != 7:
            raise ValidationError(
                field="color",
                value=v,
                reason="Label color must be a valid HEX color (e.g., #007bff)"
            )
        
        # Check if it's a valid hex color
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValidationError(
                field="color",
                value=v,
                reason="Label color must be a valid HEX color"
            )
        
        return v
    
    def can_be_created_by(self, user_id: UUID) -> bool:
        """Check if label can be created by user."""
        # Add business logic for who can create labels
        # For now, allow any authenticated user
        return True
    
    def can_be_removed_by(self, user_id: UUID) -> bool:
        """Check if label can be removed by user."""
        # Add business logic for who can remove labels
        # For now, allow any authenticated user
        return True
    
    def update_description(self, new_description: Optional[str], updated_by: UUID) -> None:
        """Update label description."""
        if not self.can_be_removed_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot update this label"
            )
        
        self.description = new_description
        self.mark_as_updated()
    
    def update_color(self, new_color: str, updated_by: UUID) -> None:
        """Update label color."""
        if not self.can_be_removed_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot update this label"
            )
        
        self.color = new_color
        self.mark_as_updated()
    
    @classmethod
    def create(
        cls,
        task_id: UUID,
        name: str,
        color: str = "#007bff",
        description: Optional[str] = None,
    ) -> "TaskLabel":
        """Create a new task label."""
        label = cls(
            task_id=task_id,
            name=name,
            color=color,
            description=description,
        )
        
        # Add domain event
        label.add_domain_event(TaskLabelAddedEvent(label.id, task_id, name, color))
        
        return label
