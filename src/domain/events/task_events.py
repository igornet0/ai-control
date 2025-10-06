"""
Task domain events.
"""

from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from src.domain.events.domain_event import DomainEvent


class TaskCreatedEvent(DomainEvent):
    """Event raised when a task is created."""
    
    def __init__(
        self,
        task_id: UUID,
        title: str,
        assignee_id: UUID,
        creator_id: UUID,
        priority: str,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "title": title,
                "assignee_id": str(assignee_id),
                "creator_id": str(creator_id),
                "priority": priority
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskCreated"


class TaskUpdatedEvent(DomainEvent):
    """Event raised when a task is updated."""
    
    def __init__(
        self,
        task_id: UUID,
        updated_fields: Dict[str, Any],
        updated_by: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "updated_fields": updated_fields,
                "updated_by": str(updated_by)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskUpdated"


class TaskDeletedEvent(DomainEvent):
    """Event raised when a task is deleted."""
    
    def __init__(
        self,
        task_id: UUID,
        deleted_by: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "deleted_by": str(deleted_by)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskDeleted"


class TaskStatusChangedEvent(DomainEvent):
    """Event raised when a task status is changed."""
    
    def __init__(
        self,
        task_id: UUID,
        old_status: str,
        new_status: str,
        changed_by: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "old_status": old_status,
                "new_status": new_status,
                "changed_by": str(changed_by)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskStatusChanged"


class TaskAssignedEvent(DomainEvent):
    """Event raised when a task is assigned to a user."""
    
    def __init__(
        self,
        task_id: UUID,
        assignee_id: UUID,
        assigned_by: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "assignee_id": str(assignee_id),
                "assigned_by": str(assigned_by)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskAssigned"


class TaskDueDateChangedEvent(DomainEvent):
    """Event raised when a task due date is changed."""
    
    def __init__(
        self,
        task_id: UUID,
        old_due_date: Optional[datetime],
        new_due_date: Optional[datetime],
        changed_by: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "old_due_date": old_due_date.isoformat() if old_due_date else None,
                "new_due_date": new_due_date.isoformat() if new_due_date else None,
                "changed_by": str(changed_by)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskDueDateChanged"


class TaskCommentAddedEvent(DomainEvent):
    """Event raised when a comment is added to a task."""
    
    def __init__(
        self,
        task_id: UUID,
        comment_id: UUID,
        commenter_id: UUID,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "comment_id": str(comment_id),
                "commenter_id": str(commenter_id)
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskCommentAdded"


class TaskTimeLoggedEvent(DomainEvent):
    """Event raised when time is logged for a task."""
    
    def __init__(
        self,
        task_id: UUID,
        time_log_id: UUID,
        user_id: UUID,
        duration_minutes: int,
        **kwargs
    ):
        super().__init__(
            aggregate_id=task_id,
            aggregate_type="Task",
            event_data={
                "time_log_id": str(time_log_id),
                "user_id": str(user_id),
                "duration_minutes": duration_minutes
            },
            **kwargs
        )
    
    @property
    def event_type(self) -> str:
        return "TaskTimeLogged"
