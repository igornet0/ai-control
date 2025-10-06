"""
Схемы запросов для задач
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from core.database.models.task_model import (
    TaskStatus, TaskPriority, TaskType, TaskVisibility
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


class TaskCreateRequest(TaskBase):
    """Запрос на создание задачи"""
    pass


class TaskUpdateRequest(BaseModel):
    """Запрос на обновление задачи"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None)
    task_type: Optional[TaskType] = Field(None)
    priority: Optional[TaskPriority] = Field(None)
    visibility: Optional[TaskVisibility] = Field(None)
    status: Optional[TaskStatus] = Field(None)
    
    # Иерархия
    parent_id: Optional[int] = Field(None)
    epic_id: Optional[int] = Field(None)
    
    # Временные рамки
    due_date: Optional[datetime] = Field(None)
    start_date: Optional[datetime] = Field(None)
    estimated_hours: Optional[float] = Field(None, ge=0)
    
    # Назначения
    executor_id: Optional[int] = Field(None)
    reviewer_id: Optional[int] = Field(None)
    
    # Прогресс
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    
    # Метаданные
    tags: Optional[List[str]] = Field(None)
    custom_fields: Optional[Dict[str, Any]] = Field(None)


class TaskCommentCreateRequest(TaskCommentBase):
    """Запрос на создание комментария"""
    pass


class TaskTimeLogCreateRequest(TaskTimeLogBase):
    """Запрос на создание записи времени"""
    pass


class TaskDependencyCreateRequest(TaskDependencyBase):
    """Запрос на создание зависимости"""
    pass


class TaskWatcherCreateRequest(TaskWatcherBase):
    """Запрос на добавление наблюдателя"""
    pass


class TaskLabelCreateRequest(TaskLabelBase):
    """Запрос на создание метки"""
    pass


class TaskTemplateCreateRequest(TaskTemplateBase):
    """Запрос на создание шаблона задачи"""
    pass
