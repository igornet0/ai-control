"""
Widget ID value object.
Represents a unique identifier for a widget.
"""

from uuid import UUID, uuid4
from src.domain.base import ValueObject


class WidgetId(ValueObject):
    """Widget ID value object."""
    
    def __init__(self, value: UUID):
        if not isinstance(value, UUID):
            raise ValueError("Widget ID must be a valid UUID")
        super().__init__(value=value)
    
    @classmethod
    def generate(cls) -> "WidgetId":
        """Generate a new Widget ID."""
        return cls(uuid4())
    
    @classmethod
    def from_string(cls, value: str) -> "WidgetId":
        """Create Widget ID from string."""
        try:
            return cls(UUID(value))
        except ValueError:
            raise ValueError(f"Invalid UUID string: {value}")
    
    def __str__(self) -> str:
        """String representation."""
        return str(self.value)
    
    def __repr__(self) -> str:
        """Representation."""
        return f"WidgetId({self.value})"
