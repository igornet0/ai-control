"""
Task watcher domain entity.
Represents a user watching a task for notifications.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID

from pydantic import Field

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import BusinessRuleViolation


class TaskWatcherAddedEvent(DomainEvent):
    """Event raised when a user starts watching a task."""
    
    def __init__(self, watcher_id: UUID, task_id: UUID, user_id: UUID):
        super().__init__(
            event_type="task_watcher_added",
            aggregate_id=str(watcher_id),
            aggregate_type="TaskWatcher",
            data={
                "watcher_id": str(watcher_id),
                "task_id": str(task_id),
                "user_id": str(user_id),
            }
        )


class TaskWatcherRemovedEvent(DomainEvent):
    """Event raised when a user stops watching a task."""
    
    def __init__(self, watcher_id: UUID, task_id: UUID, user_id: UUID):
        super().__init__(
            event_type="task_watcher_removed",
            aggregate_id=str(watcher_id),
            aggregate_type="TaskWatcher",
            data={
                "watcher_id": str(watcher_id),
                "task_id": str(task_id),
                "user_id": str(user_id),
            }
        )


class TaskWatcher(Entity):
    """Task watcher domain entity."""
    
    # Basic information
    task_id: UUID = Field(..., description="Task ID")
    user_id: UUID = Field(..., description="User ID watching the task")
    notification_preferences: Dict[str, Any] = Field(default_factory=dict, description="Notification preferences")
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the watcher."""
        # Check if user is trying to watch their own task
        # This is allowed, but we might want to handle it differently
        pass
    
    def can_be_created_by(self, user_id: UUID) -> bool:
        """Check if watcher can be created by user."""
        # User can watch any task they have access to
        return True
    
    def can_be_removed_by(self, user_id: UUID) -> bool:
        """Check if watcher can be removed by user."""
        # User can remove their own watcher, or task owner can remove any watcher
        return user_id == self.user_id
    
    def update_notification_preferences(self, preferences: Dict[str, Any], updated_by: UUID) -> None:
        """Update notification preferences."""
        if not self.can_be_removed_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot update notification preferences for this watcher",
                {"user_id": str(updated_by), "watcher_id": str(self.id)}
            )
        
        self.notification_preferences = preferences
        self.mark_as_updated()
    
    def get_notification_preference(self, key: str, default: Any = None) -> Any:
        """Get notification preference value."""
        return self.notification_preferences.get(key, default)
    
    def set_notification_preference(self, key: str, value: Any) -> None:
        """Set notification preference value."""
        self.notification_preferences[key] = value
        self.mark_as_updated()
    
    def remove_notification_preference(self, key: str) -> None:
        """Remove notification preference."""
        if key in self.notification_preferences:
            del self.notification_preferences[key]
            self.mark_as_updated()
    
    @classmethod
    def create(
        cls,
        task_id: UUID,
        user_id: UUID,
        notification_preferences: Optional[Dict[str, Any]] = None,
    ) -> "TaskWatcher":
        """Create a new task watcher."""
        watcher = cls(
            task_id=task_id,
            user_id=user_id,
            notification_preferences=notification_preferences or {},
        )
        
        # Validate business rules
        watcher.validate_business_rules()
        
        # Add domain event
        watcher.add_domain_event(TaskWatcherAddedEvent(watcher.id, task_id, user_id))
        
        return watcher
