"""
Схемы ответов для задач
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class TaskResponse(BaseModel):
    """Ответ с данными задачи"""
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    task_type: str
    visibility: str
    
    # Иерархия
    parent_id: Optional[int]
    epic_id: Optional[int]
    
    # Временные рамки
    created_at: datetime
    updated_at: datetime
    due_date: Optional[datetime]
    start_date: Optional[datetime]
    completed_at: Optional[datetime]
    
    # Оценки и прогресс
    estimated_hours: Optional[float]
    actual_hours: Optional[float]
    progress_percentage: int
    
    # Назначения
    owner_id: int
    executor_id: Optional[int]
    reviewer_id: Optional[int]
    
    # Организация
    organization_id: Optional[int]
    department_id: Optional[int]
    
    # Метаданные
    tags: Optional[List[str]]
    custom_fields: Optional[Dict[str, Any]]
    attachments: Optional[List[str]]
    
    # Связанные данные
    owner_name: Optional[str]
    executor_name: Optional[str]
    reviewer_name: Optional[str]
    organization_name: Optional[str]
    department_name: Optional[str]
    
    # Статистика
    subtasks_count: int = 0
    comments_count: int = 0
    watchers_count: int = 0

    class Config:
        from_attributes = True


class TaskCommentResponse(BaseModel):
    """Ответ с данными комментария"""
    id: int
    task_id: int
    author_id: int
    content: str
    is_internal: bool
    created_at: datetime
    updated_at: datetime
    author_name: Optional[str]

    class Config:
        from_attributes = True


class TaskTimeLogResponse(BaseModel):
    """Ответ с данными записи времени"""
    id: int
    task_id: int
    user_id: int
    hours: float
    description: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    created_at: datetime
    user_name: Optional[str]

    class Config:
        from_attributes = True


class TaskDependencyResponse(BaseModel):
    """Ответ с данными зависимости"""
    id: int
    task_id: int
    depends_on_task_id: int
    dependency_type: str
    created_at: datetime
    depends_on_task_title: Optional[str]

    class Config:
        from_attributes = True


class TaskWatcherResponse(BaseModel):
    """Ответ с данными наблюдателя"""
    id: int
    task_id: int
    user_id: int
    notification_preferences: Optional[Dict[str, Any]]
    created_at: datetime
    user_name: Optional[str]

    class Config:
        from_attributes = True


class TaskLabelResponse(BaseModel):
    """Ответ с данными метки"""
    id: int
    task_id: int
    name: str
    color: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TaskTemplateResponse(BaseModel):
    """Ответ с данными шаблона"""
    id: int
    name: str
    description: Optional[str]
    task_type: str
    priority: str
    template_fields: Dict[str, Any]
    estimated_hours: Optional[float]
    created_by: int
    organization_id: Optional[int]
    department_id: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
