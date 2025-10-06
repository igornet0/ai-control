"""
Search Query ID value object.
Represents a unique identifier for a search query.
"""

from uuid import UUID, uuid4
from src.domain.base import ValueObject


class SearchQueryId(ValueObject):
    """Search Query ID value object."""
    
    def __init__(self, value: UUID):
        if not isinstance(value, UUID):
            raise ValueError("Search Query ID must be a valid UUID")
        super().__init__(value=value)
    
    @classmethod
    def generate(cls) -> "SearchQueryId":
        """Generate a new Search Query ID."""
        return cls(uuid4())
    
    @classmethod
    def from_string(cls, value: str) -> "SearchQueryId":
        """Create Search Query ID from string."""
        try:
            return cls(UUID(value))
        except ValueError:
            raise ValueError(f"Invalid UUID string: {value}")
    
    def __str__(self) -> str:
        """String representation."""
        return str(self.value)
    
    def __repr__(self) -> str:
        """Representation."""
        return f"SearchQueryId({self.value})"
