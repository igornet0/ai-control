"""Application event handlers."""

from .user_event_handlers import (
    UserCreatedEventHandler,
    UserUpdatedEventHandler,
    UserDeletedEventHandler,
    UserLoggedInEventHandler,
    UserLoggedOutEventHandler,
    UserRoleChangedEventHandler
)
from .task_event_handlers import (
    TaskCreatedEventHandler,
    TaskUpdatedEventHandler,
    TaskDeletedEventHandler,
    TaskStatusChangedEventHandler,
    TaskAssignedEventHandler,
    TaskDueDateChangedEventHandler,
    TaskCommentAddedEventHandler,
    TaskTimeLoggedEventHandler
)

__all__ = [
    "UserCreatedEventHandler",
    "UserUpdatedEventHandler",
    "UserDeletedEventHandler",
    "UserLoggedInEventHandler",
    "UserLoggedOutEventHandler",
    "UserRoleChangedEventHandler",
    "TaskCreatedEventHandler",
    "TaskUpdatedEventHandler",
    "TaskDeletedEventHandler",
    "TaskStatusChangedEventHandler",
    "TaskAssignedEventHandler",
    "TaskDueDateChangedEventHandler",
    "TaskCommentAddedEventHandler",
    "TaskTimeLoggedEventHandler",
]
