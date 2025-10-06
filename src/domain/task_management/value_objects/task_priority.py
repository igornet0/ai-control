"""
Task priority value object.
Represents the priority level of a task.
"""

from enum import Enum
from src.domain.base import ValueObject


class TaskPriority(Enum):
    """Task priority enumeration."""
    
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"
    CRITICAL = "critical"


class TaskPriorityValue(ValueObject):
    """Task priority value object."""
    
    def __init__(self, value: TaskPriority):
        if not isinstance(value, TaskPriority):
            raise ValueError(f"Invalid task priority: {value}")
        super().__init__(value=value)
    
    @classmethod
    def from_string(cls, value: str) -> "TaskPriorityValue":
        """Create TaskPriorityValue from string."""
        try:
            priority = TaskPriority(value.lower())
            return cls(priority)
        except ValueError:
            raise ValueError(f"Invalid task priority string: {value}")
    
    @classmethod
    def low(cls) -> "TaskPriorityValue":
        """Create low priority."""
        return cls(TaskPriority.LOW)
    
    @classmethod
    def medium(cls) -> "TaskPriorityValue":
        """Create medium priority."""
        return cls(TaskPriority.MEDIUM)
    
    @classmethod
    def high(cls) -> "TaskPriorityValue":
        """Create high priority."""
        return cls(TaskPriority.HIGH)
    
    @classmethod
    def urgent(cls) -> "TaskPriorityValue":
        """Create urgent priority."""
        return cls(TaskPriority.URGENT)
    
    @classmethod
    def critical(cls) -> "TaskPriorityValue":
        """Create critical priority."""
        return cls(TaskPriority.CRITICAL)
    
    def get_numeric_value(self) -> int:
        """Get numeric priority value (higher = more important)."""
        priority_values = {
            TaskPriority.LOW: 1,
            TaskPriority.MEDIUM: 2,
            TaskPriority.HIGH: 3,
            TaskPriority.URGENT: 4,
            TaskPriority.CRITICAL: 5,
        }
        return priority_values[self.value]
    
    def is_high_priority(self) -> bool:
        """Check if priority is high or above."""
        return self.get_numeric_value() >= 3
    
    def is_critical(self) -> bool:
        """Check if priority is critical."""
        return self.value == TaskPriority.CRITICAL
    
    def is_urgent(self) -> bool:
        """Check if priority is urgent or critical."""
        return self.value in [TaskPriority.URGENT, TaskPriority.CRITICAL]
    
    def __str__(self) -> str:
        """String representation."""
        return self.value.value
    
    def __repr__(self) -> str:
        """Representation."""
        return f"TaskPriorityValue({self.value.value})"
