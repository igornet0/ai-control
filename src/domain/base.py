"""
Base classes for domain entities and value objects.
Provides common functionality for domain objects.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class DomainEvent(BaseModel):
    """Base class for domain events."""
    
    event_id: UUID = Field(default_factory=uuid4)
    event_type: str
    aggregate_id: str
    aggregate_type: str
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    version: int = Field(default=1)
    data: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        validate_assignment = True


class ValueObject(BaseModel, ABC):
    """Base class for value objects."""
    
    class Config:
        """Pydantic configuration."""
        frozen = True
        use_enum_values = True
        validate_assignment = True
    
    def __eq__(self, other: Any) -> bool:
        """Check equality with another value object."""
        if not isinstance(other, self.__class__):
            return False
        return self.dict() == other.dict()
    
    def __hash__(self) -> int:
        """Get hash of the value object."""
        return hash(tuple(sorted(self.dict().items())))


class Entity(BaseModel, ABC):
    """Base class for domain entities."""
    
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    version: int = Field(default=1)
    _domain_events: List[DomainEvent] = Field(default_factory=list, exclude=True)
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        validate_assignment = True
    
    def __eq__(self, other: Any) -> bool:
        """Check equality with another entity."""
        if not isinstance(other, self.__class__):
            return False
        return self.id == other.id
    
    def __hash__(self) -> int:
        """Get hash of the entity."""
        return hash(self.id)
    
    def add_domain_event(self, event: DomainEvent) -> None:
        """Add a domain event to the entity."""
        self._domain_events.append(event)
    
    def clear_domain_events(self) -> List[DomainEvent]:
        """Clear and return all domain events."""
        events = self._domain_events.copy()
        self._domain_events.clear()
        return events
    
    def get_domain_events(self) -> List[DomainEvent]:
        """Get all domain events without clearing them."""
        return self._domain_events.copy()
    
    def mark_as_updated(self) -> None:
        """Mark the entity as updated."""
        self.updated_at = datetime.utcnow()
        self.version += 1


class AggregateRoot(Entity, ABC):
    """Base class for aggregate roots."""
    
    def __init__(self, **data):
        super().__init__(**data)
        self._domain_events = []
    
    @abstractmethod
    def validate_business_rules(self) -> None:
        """Validate business rules for the aggregate."""
        pass
    
    def add_domain_event(self, event: DomainEvent) -> None:
        """Add a domain event to the aggregate."""
        super().add_domain_event(event)
    
    def clear_domain_events(self) -> List[DomainEvent]:
        """Clear and return all domain events."""
        return super().clear_domain_events()


class Repository(ABC):
    """Base interface for repositories."""
    
    @abstractmethod
    async def get_by_id(self, entity_id: UUID) -> Optional[Entity]:
        """Get entity by ID."""
        pass
    
    @abstractmethod
    async def save(self, entity: Entity) -> Entity:
        """Save entity."""
        pass
    
    @abstractmethod
    async def delete(self, entity_id: UUID) -> bool:
        """Delete entity by ID."""
        pass
    
    @abstractmethod
    async def exists(self, entity_id: UUID) -> bool:
        """Check if entity exists."""
        pass


class DomainService(ABC):
    """Base class for domain services."""
    
    @abstractmethod
    async def execute(self, *args, **kwargs) -> Any:
        """Execute the domain service."""
        pass


class Specification(ABC):
    """Base class for specifications."""
    
    @abstractmethod
    def is_satisfied_by(self, entity: Entity) -> bool:
        """Check if entity satisfies the specification."""
        pass
    
    def and_specification(self, other: "Specification") -> "AndSpecification":
        """Create AND specification."""
        return AndSpecification(self, other)
    
    def or_specification(self, other: "Specification") -> "OrSpecification":
        """Create OR specification."""
        return OrSpecification(self, other)
    
    def not_specification(self) -> "NotSpecification":
        """Create NOT specification."""
        return NotSpecification(self)


class AndSpecification(Specification):
    """AND specification."""
    
    def __init__(self, left: Specification, right: Specification):
        self.left = left
        self.right = right
    
    def is_satisfied_by(self, entity: Entity) -> bool:
        """Check if entity satisfies both specifications."""
        return self.left.is_satisfied_by(entity) and self.right.is_satisfied_by(entity)


class OrSpecification(Specification):
    """OR specification."""
    
    def __init__(self, left: Specification, right: Specification):
        self.left = left
        self.right = right
    
    def is_satisfied_by(self, entity: Entity) -> bool:
        """Check if entity satisfies either specification."""
        return self.left.is_satisfied_by(entity) or self.right.is_satisfied_by(entity)


class NotSpecification(Specification):
    """NOT specification."""
    
    def __init__(self, specification: Specification):
        self.specification = specification
    
    def is_satisfied_by(self, entity: Entity) -> bool:
        """Check if entity does not satisfy the specification."""
        return not self.specification.is_satisfied_by(entity)
