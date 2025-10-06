"""
Base domain event class.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID, uuid4


class DomainEvent(ABC):
    """Base class for domain events."""
    
    def __init__(
        self,
        event_id: Optional[UUID] = None,
        occurred_at: Optional[datetime] = None,
        aggregate_id: Optional[UUID] = None,
        aggregate_type: Optional[str] = None,
        event_data: Optional[Dict[str, Any]] = None
    ):
        self.event_id = event_id or uuid4()
        self.occurred_at = occurred_at or datetime.utcnow()
        self.aggregate_id = aggregate_id
        self.aggregate_type = aggregate_type
        self.event_data = event_data or {}
    
    @property
    @abstractmethod
    def event_type(self) -> str:
        """Get the event type."""
        pass
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary."""
        return {
            "event_id": str(self.event_id),
            "event_type": self.event_type,
            "occurred_at": self.occurred_at.isoformat(),
            "aggregate_id": str(self.aggregate_id) if self.aggregate_id else None,
            "aggregate_type": self.aggregate_type,
            "event_data": self.event_data
        }
    
    def __str__(self) -> str:
        """String representation of the event."""
        return f"{self.event_type}(id={self.event_id}, aggregate_id={self.aggregate_id})"
    
    def __repr__(self) -> str:
        """Representation of the event."""
        return f"{self.__class__.__name__}(event_id={self.event_id}, aggregate_id={self.aggregate_id})"
