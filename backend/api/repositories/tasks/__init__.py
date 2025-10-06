"""
Репозитории для задач
"""

from .repository import (
    TaskRepository, TaskCommentRepository, TaskTimeLogRepository,
    TaskDependencyRepository, TaskWatcherRepository, TaskLabelRepository,
    TaskTemplateRepository
)
from .interfaces import (
    ITaskRepository, ITaskCommentRepository, ITaskTimeLogRepository,
    ITaskDependencyRepository, ITaskWatcherRepository, ITaskLabelRepository,
    ITaskTemplateRepository
)

__all__ = [
    "TaskRepository",
    "TaskCommentRepository", 
    "TaskTimeLogRepository",
    "TaskDependencyRepository",
    "TaskWatcherRepository",
    "TaskLabelRepository",
    "TaskTemplateRepository",
    "ITaskRepository",
    "ITaskCommentRepository",
    "ITaskTimeLogRepository", 
    "ITaskDependencyRepository",
    "ITaskWatcherRepository",
    "ITaskLabelRepository",
    "ITaskTemplateRepository",
]
