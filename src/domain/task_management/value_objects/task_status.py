"""
Task status value object.
Represents the status of a task.
"""

from enum import Enum
from src.domain.base import ValueObject


class TaskStatus(Enum):
    """Task status enumeration."""
    
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


class TaskStatusValue(ValueObject):
    """Task status value object."""
    
    def __init__(self, value: TaskStatus):
        if not isinstance(value, TaskStatus):
            raise ValueError(f"Invalid task status: {value}")
        super().__init__(value=value)
    
    @classmethod
    def from_string(cls, value: str) -> "TaskStatusValue":
        """Create TaskStatusValue from string."""
        try:
            status = TaskStatus(value.lower())
            return cls(status)
        except ValueError:
            raise ValueError(f"Invalid task status string: {value}")
    
    @classmethod
    def todo(cls) -> "TaskStatusValue":
        """Create todo status."""
        return cls(TaskStatus.TODO)
    
    @classmethod
    def in_progress(cls) -> "TaskStatusValue":
        """Create in progress status."""
        return cls(TaskStatus.IN_PROGRESS)
    
    @classmethod
    def in_review(cls) -> "TaskStatusValue":
        """Create in review status."""
        return cls(TaskStatus.IN_REVIEW)
    
    @classmethod
    def done(cls) -> "TaskStatusValue":
        """Create done status."""
        return cls(TaskStatus.DONE)
    
    @classmethod
    def cancelled(cls) -> "TaskStatusValue":
        """Create cancelled status."""
        return cls(TaskStatus.CANCELLED)
    
    @classmethod
    def blocked(cls) -> "TaskStatusValue":
        """Create blocked status."""
        return cls(TaskStatus.BLOCKED)
    
    def is_active(self) -> bool:
        """Check if status is active (not done or cancelled)."""
        return self.value not in [TaskStatus.DONE, TaskStatus.CANCELLED]
    
    def is_completed(self) -> bool:
        """Check if status is completed."""
        return self.value == TaskStatus.DONE
    
    def is_cancelled(self) -> bool:
        """Check if status is cancelled."""
        return self.value == TaskStatus.CANCELLED
    
    def can_be_updated(self) -> bool:
        """Check if status can be updated."""
        return self.value != TaskStatus.CANCELLED
    
    def __str__(self) -> str:
        """String representation."""
        return self.value.value
    
    def __repr__(self) -> str:
        """Representation."""
        return f"TaskStatusValue({self.value.value})"
