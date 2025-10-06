"""
User ID value object.
Represents a unique identifier for a user.
"""

from uuid import UUID, uuid4
from src.domain.base import ValueObject


class UserId(ValueObject):
    """User ID value object."""
    
    def __init__(self, value: UUID):
        if not isinstance(value, UUID):
            raise ValueError("User ID must be a valid UUID")
        super().__init__(value=value)
    
    @classmethod
    def generate(cls) -> "UserId":
        """Generate a new User ID."""
        return cls(uuid4())
    
    @classmethod
    def from_string(cls, value: str) -> "UserId":
        """Create User ID from string."""
        try:
            return cls(UUID(value))
        except ValueError:
            raise ValueError(f"Invalid UUID string: {value}")
    
    def __str__(self) -> str:
        """String representation."""
        return str(self.value)
    
    def __repr__(self) -> str:
        """Representation."""
        return f"UserId({self.value})"
