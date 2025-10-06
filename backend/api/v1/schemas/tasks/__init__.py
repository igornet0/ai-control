"""
Схемы для задач
"""

from .requests import (
    TaskCreateRequest,
    TaskUpdateRequest,
    TaskCommentCreateRequest,
    TaskTimeLogCreateRequest,
    TaskDependencyCreateRequest,
    TaskWatcherCreateRequest,
    TaskLabelCreateRequest,
    TaskTemplateCreateRequest,
)

from .responses import (
    TaskResponse,
    TaskCommentResponse,
    TaskTimeLogResponse,
    TaskDependencyResponse,
    TaskWatcherResponse,
    TaskLabelResponse,
    TaskTemplateResponse,
)

from .base import (
    TaskBase,
    TaskCommentBase,
    TaskTimeLogBase,
    TaskDependencyBase,
    TaskWatcherBase,
    TaskLabelBase,
    TaskTemplateBase,
)

__all__ = [
    # Requests
    "TaskCreateRequest",
    "TaskUpdateRequest",
    "TaskCommentCreateRequest",
    "TaskTimeLogCreateRequest",
    "TaskDependencyCreateRequest",
    "TaskWatcherCreateRequest",
    "TaskLabelCreateRequest",
    "TaskTemplateCreateRequest",
    
    # Responses
    "TaskResponse",
    "TaskCommentResponse",
    "TaskTimeLogResponse",
    "TaskDependencyResponse",
    "TaskWatcherResponse",
    "TaskLabelResponse",
    "TaskTemplateResponse",
    
    # Base
    "TaskBase",
    "TaskCommentBase",
    "TaskTimeLogBase",
    "TaskDependencyBase",
    "TaskWatcherBase",
    "TaskLabelBase",
    "TaskTemplateBase",
]
