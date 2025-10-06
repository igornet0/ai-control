"""
Base event handler class.
"""

from abc import ABC, abstractmethod
from typing import Type, List
from src.domain.events.domain_event import DomainEvent


class EventHandler(ABC):
    """Base class for event handlers."""
    
    @property
    @abstractmethod
    def event_type(self) -> Type[DomainEvent]:
        """Get the event type this handler processes."""
        pass
    
    @abstractmethod
    async def handle(self, event: DomainEvent) -> None:
        """Handle the domain event."""
        pass


class EventBus:
    """Event bus for publishing and subscribing to domain events."""
    
    def __init__(self):
        self._handlers: List[EventHandler] = []
    
    def subscribe(self, handler: EventHandler) -> None:
        """Subscribe an event handler."""
        self._handlers.append(handler)
    
    def unsubscribe(self, handler: EventHandler) -> None:
        """Unsubscribe an event handler."""
        if handler in self._handlers:
            self._handlers.remove(handler)
    
    async def publish(self, event: DomainEvent) -> None:
        """Publish a domain event to all subscribed handlers."""
        for handler in self._handlers:
            if isinstance(event, handler.event_type):
                try:
                    await handler.handle(event)
                except Exception as e:
                    # Log error but don't stop other handlers
                    print(f"Error handling event {event.event_type}: {e}")
    
    def get_handlers_for_event(self, event_type: Type[DomainEvent]) -> List[EventHandler]:
        """Get all handlers for a specific event type."""
        return [handler for handler in self._handlers if handler.event_type == event_type]


# Global event bus instance
event_bus = EventBus()
