"""
Task ID value object.
Represents a unique identifier for a task.
"""

from uuid import UUID, uuid4
from src.domain.base import ValueObject


class TaskId(ValueObject):
    """Task ID value object."""
    
    def __init__(self, value: UUID):
        if not isinstance(value, UUID):
            raise ValueError("Task ID must be a valid UUID")
        super().__init__(value=value)
    
    @classmethod
    def generate(cls) -> "TaskId":
        """Generate a new Task ID."""
        return cls(uuid4())
    
    @classmethod
    def from_string(cls, value: str) -> "TaskId":
        """Create Task ID from string."""
        try:
            return cls(UUID(value))
        except ValueError:
            raise ValueError(f"Invalid UUID string: {value}")
    
    def __str__(self) -> str:
        """String representation."""
        return str(self.value)
    
    def __repr__(self) -> str:
        """Representation."""
        return f"TaskId({self.value})"
