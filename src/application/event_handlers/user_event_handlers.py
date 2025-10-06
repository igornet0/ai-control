"""
Event handlers for user domain events.
"""

from typing import Type
from src.domain.events.domain_event import DomainEvent
from src.domain.events.user_events import (
    UserCreatedEvent,
    UserUpdatedEvent,
    UserDeletedEvent,
    UserLoggedInEvent,
    UserLoggedOutEvent,
    UserRoleChangedEvent
)
from src.domain.events.event_handler import EventHandler
from src.infrastructure.config.logging import get_logger
from src.presentation.websockets.event_broadcaster import event_broadcaster
from src.infrastructure.caching.cache_service import cache_service


class UserCreatedEventHandler(EventHandler):
    """Handler for UserCreatedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return UserCreatedEvent
    
    async def handle(self, event: UserCreatedEvent) -> None:
        """Handle user created event."""
        self.logger.info(
            "User created",
            extra={
                "user_id": str(event.aggregate_id),
                "email": event.event_data.get("email"),
                "username": event.event_data.get("username"),
                "role": event.event_data.get("role")
            }
        )
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_user_event(
            user_id=str(event.aggregate_id),
            event_type="user_created",
            data=event.event_data
        )
        
        # Send notification to admins
        await event_broadcaster.broadcast_notification(
            user_id="admin",  # This would be a system user or broadcast to all admins
            notification_type="user_management",
            data={
                "message": f"New user {event.event_data.get('username')} has been created",
                "user_id": str(event.aggregate_id),
                "event_type": "user_created"
            }
        )


class UserUpdatedEventHandler(EventHandler):
    """Handler for UserUpdatedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return UserUpdatedEvent
    
    async def handle(self, event: UserUpdatedEvent) -> None:
        """Handle user updated event."""
        self.logger.info(
            "User updated",
            extra={
                "user_id": str(event.aggregate_id),
                "updated_fields": event.event_data.get("updated_fields")
            }
        )
        
        # Invalidate user cache
        await cache_service.invalidate_user_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_user_event(
            user_id=str(event.aggregate_id),
            event_type="user_updated",
            data=event.event_data
        )


class UserDeletedEventHandler(EventHandler):
    """Handler for UserDeletedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return UserDeletedEvent
    
    async def handle(self, event: UserDeletedEvent) -> None:
        """Handle user deleted event."""
        self.logger.info(
            "User deleted",
            extra={
                "user_id": str(event.aggregate_id),
                "deleted_by": event.event_data.get("deleted_by")
            }
        )
        
        # Invalidate user cache
        await cache_service.invalidate_user_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_user_event(
            user_id=str(event.aggregate_id),
            event_type="user_deleted",
            data=event.event_data
        )


class UserLoggedInEventHandler(EventHandler):
    """Handler for UserLoggedInEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return UserLoggedInEvent
    
    async def handle(self, event: UserLoggedInEvent) -> None:
        """Handle user logged in event."""
        self.logger.info(
            "User logged in",
            extra={
                "user_id": str(event.aggregate_id),
                "login_time": event.event_data.get("login_time"),
                "ip_address": event.event_data.get("ip_address")
            }
        )
        
        # Update user session cache
        await cache_service.cache_session(
            session_id=f"user_session_{event.aggregate_id}",
            data={
                "user_id": str(event.aggregate_id),
                "login_time": event.event_data.get("login_time"),
                "ip_address": event.event_data.get("ip_address")
            },
            ttl=3600  # 1 hour
        )
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_user_event(
            user_id=str(event.aggregate_id),
            event_type="user_logged_in",
            data=event.event_data
        )


class UserLoggedOutEventHandler(EventHandler):
    """Handler for UserLoggedOutEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return UserLoggedOutEvent
    
    async def handle(self, event: UserLoggedOutEvent) -> None:
        """Handle user logged out event."""
        self.logger.info(
            "User logged out",
            extra={
                "user_id": str(event.aggregate_id),
                "logout_time": event.event_data.get("logout_time")
            }
        )
        
        # Delete user session cache
        await cache_service.delete_session(f"user_session_{event.aggregate_id}")
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_user_event(
            user_id=str(event.aggregate_id),
            event_type="user_logged_out",
            data=event.event_data
        )


class UserRoleChangedEventHandler(EventHandler):
    """Handler for UserRoleChangedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return UserRoleChangedEvent
    
    async def handle(self, event: UserRoleChangedEvent) -> None:
        """Handle user role changed event."""
        self.logger.info(
            "User role changed",
            extra={
                "user_id": str(event.aggregate_id),
                "old_role": event.event_data.get("old_role"),
                "new_role": event.event_data.get("new_role"),
                "changed_by": event.event_data.get("changed_by")
            }
        )
        
        # Invalidate user cache
        await cache_service.invalidate_user_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_user_event(
            user_id=str(event.aggregate_id),
            event_type="user_role_changed",
            data=event.event_data
        )
        
        # Send notification to user
        await event_broadcaster.broadcast_notification(
            user_id=str(event.aggregate_id),
            notification_type="role_change",
            data={
                "message": f"Your role has been changed from {event.event_data.get('old_role')} to {event.event_data.get('new_role')}",
                "old_role": event.event_data.get("old_role"),
                "new_role": event.event_data.get("new_role")
            }
        )
