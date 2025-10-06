"""
Event ID value object.
Represents a unique identifier for an event.
"""

from uuid import UUID, uuid4
from src.domain.base import ValueObject


class EventId(ValueObject):
    """Event ID value object."""
    
    def __init__(self, value: UUID):
        if not isinstance(value, UUID):
            raise ValueError("Event ID must be a valid UUID")
        super().__init__(value=value)
    
    @classmethod
    def generate(cls) -> "EventId":
        """Generate a new Event ID."""
        return cls(uuid4())
    
    @classmethod
    def from_string(cls, value: str) -> "EventId":
        """Create Event ID from string."""
        try:
            return cls(UUID(value))
        except ValueError:
            raise ValueError(f"Invalid UUID string: {value}")
    
    def __str__(self) -> str:
        """String representation."""
        return str(self.value)
    
    def __repr__(self) -> str:
        """Representation."""
        return f"EventId({self.value})"
