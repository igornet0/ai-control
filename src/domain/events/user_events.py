"""
User domain events.
"""

from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from src.domain.events.domain_event import DomainEvent


class UserCreatedEvent(DomainEvent):
    """Event raised when a user is created."""
    
    def __init__(
        self,
        user_id: UUID,
        email: str,
        username: str,
        role: str,
        **kwargs
    ):
        super().__init__(
            aggregate_id=user_id,
            aggregate_type="User",
            event_data={
                "email": email,
                "username": username,
                "role": role
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "UserCreated"


class UserUpdatedEvent(DomainEvent):
    """Event raised when a user is updated."""
    
    def __init__(
        self,
        user_id: UUID,
        updated_fields: Dict[str, Any],
        **kwargs
    ):
        super().__init__(
            aggregate_id=user_id,
            aggregate_type="User",
            event_data={
                "updated_fields": updated_fields
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "UserUpdated"


class UserDeletedEvent(DomainEvent):
    """Event raised when a user is deleted."""
    
    def __init__(
        self,
        user_id: UUID,
        deleted_by: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=user_id,
            aggregate_type="User",
            event_data={
                "deleted_by": str(deleted_by)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "UserDeleted"


class UserLoggedInEvent(DomainEvent):
    """Event raised when a user logs in."""
    
    def __init__(
        self,
        user_id: UUID,
        login_time: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        **kwargs
    ):
        super().__init__(
            aggregate_id=user_id,
            aggregate_type="User",
            event_data={
                "login_time": login_time.isoformat(),
                "ip_address": ip_address,
                "user_agent": user_agent
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "UserLoggedIn"


class UserLoggedOutEvent(DomainEvent):
    """Event raised when a user logs out."""
    
    def __init__(
        self,
        user_id: UUID,
        logout_time: datetime,
        **kwargs
    ):
        super().__init__(
            aggregate_id=user_id,
            aggregate_type="User",
            event_data={
                "logout_time": logout_time.isoformat()
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "UserLoggedOut"


class UserRoleChangedEvent(DomainEvent):
    """Event raised when a user's role is changed."""
    
    def __init__(
        self,
        user_id: UUID,
        old_role: str,
        new_role: str,
        changed_by: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=user_id,
            aggregate_type="User",
            event_data={
                "old_role": old_role,
                "new_role": new_role,
                "changed_by": str(changed_by)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "UserRoleChanged"
