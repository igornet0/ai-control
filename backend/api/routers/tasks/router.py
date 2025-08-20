"""
API для управления задачами
"""

import uuid
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timedelta

from backend.api.configuration.auth import verify_authorization, require_role
from backend.api.configuration.server import Server
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload, joinedload

from core.database.models.task_model import (
    Task, TaskComment, TaskTimeLog, TaskDependency, TaskWatcher, TaskLabel, TaskTemplate,
    TaskStatus, TaskPriority, TaskType, TaskVisibility
)
from core.database.models.main_models import User, Organization, Department

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# Pydantic модели для API

class TaskCreateRequest(BaseModel):
    """Запрос на создание задачи"""
    title: str = Field(..., min_length=1, max_length=255, description="Название задачи")
    description: Optional[str] = Field(None, description="Описание задачи")
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

class TaskCommentCreateRequest(BaseModel):
    """Запрос на создание комментария"""
    content: str = Field(..., min_length=1, description="Содержание комментария")
    is_internal: bool = Field(default=False, description="Внутренний комментарий")

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

class TaskTimeLogCreateRequest(BaseModel):
    """Запрос на создание записи времени"""
    hours: float = Field(..., gt=0, description="Количество часов")
    description: Optional[str] = Field(None, description="Описание работы")
    start_time: datetime = Field(..., description="Время начала")
    end_time: Optional[datetime] = Field(None, description="Время окончания")

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

class TaskDependencyCreateRequest(BaseModel):
    """Запрос на создание зависимости"""
    depends_on_task_id: int = Field(..., description="ID задачи, от которой зависит")
    dependency_type: str = Field(default="blocks", description="Тип зависимости")

class TaskDependencyResponse(BaseModel):
    """Ответ с данными зависимости"""
    id: int
    task_id: int
    depends_on_task_id: int
    dependency_type: str
    created_at: datetime
    depends_on_task_title: Optional[str]

class TaskWatcherCreateRequest(BaseModel):
    """Запрос на добавление наблюдателя"""
    user_id: int = Field(..., description="ID пользователя-наблюдателя")
    notification_preferences: Optional[Dict[str, Any]] = Field(None, description="Настройки уведомлений")

class TaskWatcherResponse(BaseModel):
    """Ответ с данными наблюдателя"""
    id: int
    task_id: int
    user_id: int
    notification_preferences: Optional[Dict[str, Any]]
    created_at: datetime
    user_name: Optional[str]

class TaskLabelCreateRequest(BaseModel):
    """Запрос на создание метки"""
    name: str = Field(..., min_length=1, max_length=100, description="Название метки")
    color: str = Field(default="#007bff", description="Цвет метки")
    description: Optional[str] = Field(None, description="Описание метки")

class TaskLabelResponse(BaseModel):
    """Ответ с данными метки"""
    id: int
    task_id: int
    name: str
    color: str
    description: Optional[str]
    created_at: datetime

class TaskTemplateCreateRequest(BaseModel):
    """Запрос на создание шаблона задачи"""
    name: str = Field(..., min_length=1, max_length=255, description="Название шаблона")
    description: Optional[str] = Field(None, description="Описание шаблона")
    task_type: TaskType = Field(default=TaskType.TASK, description="Тип задачи")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Приоритет")
    template_fields: Dict[str, Any] = Field(..., description="Поля шаблона")
    estimated_hours: Optional[float] = Field(None, ge=0, description="Оценка в часах")

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

# API эндпоинты

@router.post("/", response_model=TaskResponse)
async def create_task(
    request: TaskCreateRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Создание новой задачи
    """
    try:
        # Проверяем права доступа
        if request.executor_id and request.executor_id != user.id:
            # TODO: Проверка прав на назначение задач
            pass
        
        if request.reviewer_id and request.reviewer_id != user.id:
            # TODO: Проверка прав на назначение рецензентов
            pass
        
        # Проверяем существование связанных задач
        if request.parent_id:
            parent_task = await session.get(Task, request.parent_id)
            if not parent_task:
                raise HTTPException(status_code=404, detail="Parent task not found")
        
        if request.epic_id:
            epic_task = await session.get(Task, request.epic_id)
            if not epic_task:
                raise HTTPException(status_code=404, detail="Epic task not found")
        
        # Создаем задачу
        task = Task(
            title=request.title,
            description=request.description,
            task_type=request.task_type,
            priority=request.priority,
            visibility=request.visibility,
            parent_id=request.parent_id,
            epic_id=request.epic_id,
            due_date=request.due_date,
            start_date=request.start_date,
            estimated_hours=request.estimated_hours,
            executor_id=request.executor_id,
            reviewer_id=request.reviewer_id,
            organization_id=request.organization_id or user.organization_id,
            department_id=request.department_id or user.department_id,
            tags=request.tags,
            custom_fields=request.custom_fields,
            owner_id=user.id
        )
        
        session.add(task)
        await session.commit()
        await session.refresh(task)
        
        # Получаем связанные данные для ответа
        response_data = await _get_task_response_data(task, session)
        
        logger.info(f"Task created: {task.id} by user {user.id}")
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db),
    status: Optional[TaskStatus] = Query(None, description="Фильтр по статусу"),
    priority: Optional[TaskPriority] = Query(None, description="Фильтр по приоритету"),
    task_type: Optional[TaskType] = Query(None, description="Фильтр по типу"),
    executor_id: Optional[int] = Query(None, description="Фильтр по исполнителю"),
    owner_id: Optional[int] = Query(None, description="Фильтр по владельцу"),
    organization_id: Optional[int] = Query(None, description="Фильтр по организации"),
    department_id: Optional[int] = Query(None, description="Фильтр по департаменту"),
    due_date_from: Optional[datetime] = Query(None, description="Фильтр по дате с"),
    due_date_to: Optional[datetime] = Query(None, description="Фильтр по дате до"),
    search: Optional[str] = Query(None, description="Поиск по названию и описанию"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    size: int = Query(20, ge=1, le=100, description="Размер страницы"),
    sort_by: str = Query("created_at", description="Поле для сортировки"),
    sort_order: str = Query("desc", description="Порядок сортировки (asc/desc)")
):
    """
    Получение списка задач с фильтрацией и пагинацией
    """
    try:
        # Строим базовый запрос
        query = select(Task).options(
            selectinload(Task.owner),
            selectinload(Task.executor),
            selectinload(Task.reviewer),
            selectinload(Task.organization),
            selectinload(Task.department),
            selectinload(Task.subtasks),
            selectinload(Task.comments),
            selectinload(Task.watchers)
        )
        
        # Применяем фильтры
        filters = []
        
        # Фильтр по статусу
        if status:
            filters.append(Task.status == status)
        
        # Фильтр по приоритету
        if priority:
            filters.append(Task.priority == priority)
        
        # Фильтр по типу
        if task_type:
            filters.append(Task.task_type == task_type)
        
        # Фильтр по исполнителю
        if executor_id:
            filters.append(Task.executor_id == executor_id)
        
        # Фильтр по владельцу
        if owner_id:
            filters.append(Task.owner_id == owner_id)
        
        # Фильтр по организации
        if organization_id:
            filters.append(Task.organization_id == organization_id)
        elif user.organization_id:
            filters.append(Task.organization_id == user.organization_id)
        
        # Фильтр по департаменту
        if department_id:
            filters.append(Task.department_id == department_id)
        elif user.department_id:
            filters.append(Task.department_id == user.department_id)
        
        # Фильтр по датам
        if due_date_from:
            filters.append(Task.due_date >= due_date_from)
        if due_date_to:
            filters.append(Task.due_date <= due_date_to)
        
        # Поиск
        if search:
            search_filter = or_(
                Task.title.ilike(f"%{search}%"),
                Task.description.ilike(f"%{search}%")
            )
            filters.append(search_filter)
        
        # Применяем фильтры
        if filters:
            query = query.where(and_(*filters))
        
        # Сортировка
        sort_column = getattr(Task, sort_by, Task.created_at)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # Пагинация
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        # Выполняем запрос
        result = await session.execute(query)
        tasks = result.scalars().unique().all()
        
        # Формируем ответы
        responses = []
        for task in tasks:
            response_data = await _get_task_response_data(task, session)
            responses.append(response_data)
        
        return responses
        
    except Exception as e:
        logger.error(f"Error listing tasks: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение задачи по ID
    """
    try:
        # Получаем задачу с связанными данными
        query = select(Task).options(
            selectinload(Task.owner),
            selectinload(Task.executor),
            selectinload(Task.reviewer),
            selectinload(Task.organization),
            selectinload(Task.department),
            selectinload(Task.subtasks),
            selectinload(Task.comments),
            selectinload(Task.watchers),
            selectinload(Task.labels),
            selectinload(Task.time_logs),
            selectinload(Task.dependencies)
        ).where(Task.id == task_id)
        
        result = await session.execute(query)
        task = result.scalar_one_or_none()
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Проверяем права доступа
        if not await _can_access_task(task, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Формируем ответ
        response_data = await _get_task_response_data(task, session)
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    request: TaskUpdateRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Обновление задачи
    """
    try:
        # Получаем задачу
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Проверяем права доступа
        if not await _can_edit_task(task, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Обновляем поля
        update_data = request.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if hasattr(task, field):
                setattr(task, field, value)
        
        # Обновляем время завершения при изменении статуса
        if request.status == TaskStatus.COMPLETED and task.completed_at is None:
            task.completed_at = datetime.utcnow()
        elif request.status != TaskStatus.COMPLETED:
            task.completed_at = None
        
        await session.commit()
        await session.refresh(task)
        
        # Формируем ответ
        response_data = await _get_task_response_data(task, session)
        
        logger.info(f"Task updated: {task_id} by user {user.id}")
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Удаление задачи
    """
    try:
        # Получаем задачу
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Проверяем права доступа
        if not await _can_delete_task(task, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Проверяем, что нет активных подзадач
        if task.subtasks:
            active_subtasks = [st for st in task.subtasks if st.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]]
            if active_subtasks:
                raise HTTPException(status_code=400, detail="Cannot delete task with active subtasks")
        
        # Удаляем задачу
        await session.delete(task)
        await session.commit()
        
        logger.info(f"Task deleted: {task_id} by user {user.id}")
        
        return {"message": "Task deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Вспомогательные функции

async def _get_task_response_data(task: Task, session: AsyncSession) -> TaskResponse:
    """Формирует данные ответа для задачи"""
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status.value,
        priority=task.priority.value,
        task_type=task.task_type.value,
        visibility=task.visibility.value,
        parent_id=task.parent_id,
        epic_id=task.epic_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
        due_date=task.due_date,
        start_date=task.start_date,
        completed_at=task.completed_at,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours,
        progress_percentage=task.progress_percentage,
        owner_id=task.owner_id,
        executor_id=task.executor_id,
        reviewer_id=task.reviewer_id,
        organization_id=task.organization_id,
        department_id=task.department_id,
        tags=task.tags,
        custom_fields=task.custom_fields,
        attachments=task.attachments,
        owner_name=task.owner.username if task.owner else None,
        executor_name=task.executor.username if task.executor else None,
        reviewer_name=task.reviewer.username if task.reviewer else None,
        organization_name=task.organization.name if task.organization else None,
        department_name=task.department.name if task.department else None,
        subtasks_count=len(task.subtasks) if task.subtasks else 0,
        comments_count=len(task.comments) if task.comments else 0,
        watchers_count=len(task.watchers) if task.watchers else 0
    )

async def _can_access_task(task: Task, user: User, session: AsyncSession) -> bool:
    """Проверяет права доступа к задаче"""
    # Владелец всегда имеет доступ
    if task.owner_id == user.id:
        return True
    
    # Исполнитель имеет доступ
    if task.executor_id == user.id:
        return True
    
    # Рецензент имеет доступ
    if task.reviewer_id == user.id:
        return True
    
    # Проверяем видимость
    if task.visibility == TaskVisibility.PUBLIC:
        return True
    
    if task.visibility == TaskVisibility.TEAM:
        # TODO: Проверка команды
        return True
    
    if task.visibility == TaskVisibility.DEPARTMENT:
        if task.department_id and user.department_id == task.department_id:
            return True
    
    if task.visibility == TaskVisibility.ORGANIZATION:
        if task.organization_id and user.organization_id == task.organization_id:
            return True
    
    # Администраторы имеют доступ ко всем задачам
    if user.role in ["admin", "CEO"]:
        return True
    
    return False

async def _can_edit_task(task: Task, user: User, session: AsyncSession) -> bool:
    """Проверяет права на редактирование задачи"""
    # Владелец может редактировать
    if task.owner_id == user.id:
        return True
    
    # Исполнитель может редактировать
    if task.executor_id == user.id:
        return True
    
    # Администраторы могут редактировать
    if user.role in ["admin", "CEO"]:
        return True
    
    return False

async def _can_delete_task(task: Task, user: User, session: AsyncSession) -> bool:
    """Проверяет права на удаление задачи"""
    # Только владелец или администраторы могут удалять
    if task.owner_id == user.id:
        return True
    
    if user.role in ["admin", "CEO"]:
        return True
    
    return False
