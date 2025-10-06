"""
Event handlers for task domain events.
"""

from typing import Type
from src.domain.events.domain_event import DomainEvent
from src.domain.events.task_events import (
    TaskCreatedEvent,
    TaskUpdatedEvent,
    TaskDeletedEvent,
    TaskStatusChangedEvent,
    TaskAssignedEvent,
    TaskDueDateChangedEvent,
    TaskCommentAddedEvent,
    TaskTimeLoggedEvent
)
from src.domain.events.event_handler import EventHandler
from src.infrastructure.config.logging import get_logger
from src.presentation.websockets.event_broadcaster import event_broadcaster
from src.infrastructure.caching.cache_service import cache_service


class TaskCreatedEventHandler(EventHandler):
    """Handler for TaskCreatedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskCreatedEvent
    
    async def handle(self, event: TaskCreatedEvent) -> None:
        """Handle task created event."""
        self.logger.info(
            "Task created",
            extra={
                "task_id": str(event.aggregate_id),
                "title": event.event_data.get("title"),
                "assignee_id": event.event_data.get("assignee_id"),
                "creator_id": event.event_data.get("creator_id"),
                "priority": event.event_data.get("priority")
            }
        )
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_created",
            data=event.event_data,
            user_ids=[event.event_data.get("assignee_id"), event.event_data.get("creator_id")]
        )
        
        # Send notification to assignee
        await event_broadcaster.broadcast_notification(
            user_id=event.event_data.get("assignee_id"),
            notification_type="task_assignment",
            data={
                "message": f"New task '{event.event_data.get('title')}' has been assigned to you",
                "task_id": str(event.aggregate_id),
                "priority": event.event_data.get("priority")
            }
        )


class TaskUpdatedEventHandler(EventHandler):
    """Handler for TaskUpdatedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskUpdatedEvent
    
    async def handle(self, event: TaskUpdatedEvent) -> None:
        """Handle task updated event."""
        self.logger.info(
            "Task updated",
            extra={
                "task_id": str(event.aggregate_id),
                "updated_fields": event.event_data.get("updated_fields"),
                "updated_by": event.event_data.get("updated_by")
            }
        )
        
        # Invalidate task cache
        await cache_service.invalidate_task_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_updated",
            data=event.event_data
        )


class TaskDeletedEventHandler(EventHandler):
    """Handler for TaskDeletedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskDeletedEvent
    
    async def handle(self, event: TaskDeletedEvent) -> None:
        """Handle task deleted event."""
        self.logger.info(
            "Task deleted",
            extra={
                "task_id": str(event.aggregate_id),
                "deleted_by": event.event_data.get("deleted_by")
            }
        )
        
        # Invalidate task cache
        await cache_service.invalidate_task_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_deleted",
            data=event.event_data
        )


class TaskStatusChangedEventHandler(EventHandler):
    """Handler for TaskStatusChangedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskStatusChangedEvent
    
    async def handle(self, event: TaskStatusChangedEvent) -> None:
        """Handle task status changed event."""
        self.logger.info(
            "Task status changed",
            extra={
                "task_id": str(event.aggregate_id),
                "old_status": event.event_data.get("old_status"),
                "new_status": event.event_data.get("new_status"),
                "changed_by": event.event_data.get("changed_by")
            }
        )
        
        # Invalidate task cache
        await cache_service.invalidate_task_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_status_changed",
            data=event.event_data
        )
        
        # Send notification if task is completed
        if event.event_data.get("new_status") == "done":
            await event_broadcaster.broadcast_notification(
                user_id=event.event_data.get("changed_by"),
                notification_type="task_completion",
                data={
                    "message": f"Task has been completed",
                    "task_id": str(event.aggregate_id),
                    "status": event.event_data.get("new_status")
                }
            )


class TaskAssignedEventHandler(EventHandler):
    """Handler for TaskAssignedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskAssignedEvent
    
    async def handle(self, event: TaskAssignedEvent) -> None:
        """Handle task assigned event."""
        self.logger.info(
            "Task assigned",
            extra={
                "task_id": str(event.aggregate_id),
                "assignee_id": event.event_data.get("assignee_id"),
                "assigned_by": event.event_data.get("assigned_by")
            }
        )
        
        # Invalidate task cache
        await cache_service.invalidate_task_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_assigned",
            data=event.event_data,
            user_ids=[event.event_data.get("assignee_id")]
        )
        
        # Send notification to new assignee
        await event_broadcaster.broadcast_notification(
            user_id=event.event_data.get("assignee_id"),
            notification_type="task_assignment",
            data={
                "message": f"Task has been assigned to you",
                "task_id": str(event.aggregate_id)
            }
        )


class TaskDueDateChangedEventHandler(EventHandler):
    """Handler for TaskDueDateChangedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskDueDateChangedEvent
    
    async def handle(self, event: TaskDueDateChangedEvent) -> None:
        """Handle task due date changed event."""
        self.logger.info(
            "Task due date changed",
            extra={
                "task_id": str(event.aggregate_id),
                "old_due_date": event.event_data.get("old_due_date"),
                "new_due_date": event.event_data.get("new_due_date"),
                "changed_by": event.event_data.get("changed_by")
            }
        )
        
        # Invalidate task cache
        await cache_service.invalidate_task_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_due_date_changed",
            data=event.event_data
        )


class TaskCommentAddedEventHandler(EventHandler):
    """Handler for TaskCommentAddedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskCommentAddedEvent
    
    async def handle(self, event: TaskCommentAddedEvent) -> None:
        """Handle task comment added event."""
        self.logger.info(
            "Task comment added",
            extra={
                "task_id": str(event.aggregate_id),
                "comment_id": event.event_data.get("comment_id"),
                "commenter_id": event.event_data.get("commenter_id")
            }
        )
        
        # Invalidate task cache
        await cache_service.invalidate_task_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_comment_added",
            data=event.event_data
        )


class TaskTimeLoggedEventHandler(EventHandler):
    """Handler for TaskTimeLoggedEvent."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    @property
    def event_type(self) -> Type[DomainEvent]:
        return TaskTimeLoggedEvent
    
    async def handle(self, event: TaskTimeLoggedEvent) -> None:
        """Handle task time logged event."""
        self.logger.info(
            "Task time logged",
            extra={
                "task_id": str(event.aggregate_id),
                "time_log_id": event.event_data.get("time_log_id"),
                "user_id": event.event_data.get("user_id"),
                "duration_minutes": event.event_data.get("duration_minutes")
            }
        )
        
        # Invalidate task cache
        await cache_service.invalidate_task_cache(str(event.aggregate_id))
        
        # Broadcast event via WebSocket
        await event_broadcaster.broadcast_task_event(
            task_id=str(event.aggregate_id),
            event_type="task_time_logged",
            data=event.event_data
        )
