"""
Organization ID value object.
Represents a unique identifier for an organization.
"""

from uuid import UUID, uuid4
from src.domain.base import ValueObject


class OrganizationId(ValueObject):
    """Organization ID value object."""
    
    def __init__(self, value: UUID):
        if not isinstance(value, UUID):
            raise ValueError("Organization ID must be a valid UUID")
        super().__init__(value=value)
    
    @classmethod
    def generate(cls) -> "OrganizationId":
        """Generate a new Organization ID."""
        return cls(uuid4())
    
    @classmethod
    def from_string(cls, value: str) -> "OrganizationId":
        """Create Organization ID from string."""
        try:
            return cls(UUID(value))
        except ValueError:
            raise ValueError(f"Invalid UUID string: {value}")
    
    def __str__(self) -> str:
        """String representation."""
        return str(self.value)
    
    def __repr__(self) -> str:
        """Representation."""
        return f"OrganizationId({self.value})"
