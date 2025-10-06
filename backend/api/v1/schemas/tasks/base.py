"""
Базовые схемы для задач
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from core.database.models.task_model import (
    TaskStatus, TaskPriority, TaskType, TaskVisibility
)


class TaskBase(BaseModel):
    """Базовая схема задачи"""
    title: str = Field(..., min_length=1, max_length=255, description="Название задачи")
    description: Optional[str] = Field(None, description="Описание задачи")
    status: TaskStatus = Field(default=TaskStatus.CREATED, description="Статус задачи")
    task_type: TaskType = Field(default=TaskType.TASK, description="Тип задачи")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Приоритет")
    visibility: TaskVisibility = Field(default=TaskVisibility.TEAM, description="Видимость")
    
    # Иерархия
    parent_id: Optional[int] = Field(None, description="ID родительской задачи")
    epic_id: Optional[int] = Field(None, description="ID эпика")
    
    # Временные рамки
    due_date: Optional[datetime] = Field(None, description="Срок выполнения")
    start_date: Optional[datetime] = Field(None, description="Дата начала")
    estimated_hours: Optional[float] = Field(None, ge=0, description="Оценка в часах")
    
    # Назначения
    executor_id: Optional[int] = Field(None, description="ID исполнителя")
    reviewer_id: Optional[int] = Field(None, description="ID рецензента")
    
    # Организация
    organization_id: Optional[int] = Field(None, description="ID организации")
    department_id: Optional[int] = Field(None, description="ID департамента")
    
    # Метаданные
    tags: Optional[List[str]] = Field(None, description="Теги")
    custom_fields: Optional[Dict[str, Any]] = Field(None, description="Пользовательские поля")


class TaskCommentBase(BaseModel):
    """Базовая схема комментария к задаче"""
    content: str = Field(..., min_length=1, description="Содержание комментария")
    is_internal: bool = Field(default=False, description="Внутренний комментарий")


class TaskTimeLogBase(BaseModel):
    """Базовая схема записи времени"""
    hours: float = Field(..., gt=0, description="Количество часов")
    description: Optional[str] = Field(None, description="Описание работы")
    start_time: datetime = Field(..., description="Время начала")
    end_time: Optional[datetime] = Field(None, description="Время окончания")


class TaskDependencyBase(BaseModel):
    """Базовая схема зависимости задач"""
    depends_on_task_id: int = Field(..., description="ID задачи, от которой зависит")
    dependency_type: str = Field(default="blocks", description="Тип зависимости")


class TaskWatcherBase(BaseModel):
    """Базовая схема наблюдателя за задачей"""
    user_id: int = Field(..., description="ID пользователя-наблюдателя")
    notification_preferences: Optional[Dict[str, Any]] = Field(None, description="Настройки уведомлений")


class TaskLabelBase(BaseModel):
    """Базовая схема метки задачи"""
    name: str = Field(..., min_length=1, max_length=100, description="Название метки")
    color: str = Field(default="#007bff", description="Цвет метки")
    description: Optional[str] = Field(None, description="Описание метки")


class TaskTemplateBase(BaseModel):
    """Базовая схема шаблона задачи"""
    name: str = Field(..., min_length=1, max_length=255, description="Название шаблона")
    description: Optional[str] = Field(None, description="Описание шаблона")
    task_type: TaskType = Field(default=TaskType.TASK, description="Тип задачи")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Приоритет")
    template_fields: Dict[str, Any] = Field(..., description="Поля шаблона")
    estimated_hours: Optional[float] = Field(None, ge=0, description="Оценка в часах")
