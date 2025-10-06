"""
Роутер для задач
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime

from core.database.models.task_model import (
    TaskStatus, TaskPriority, TaskType, TaskVisibility
)

from ...schemas.tasks import (
    TaskCreateRequest, TaskUpdateRequest, TaskResponse,
    TaskCommentCreateRequest, TaskCommentResponse,
    TaskTimeLogCreateRequest, TaskTimeLogResponse,
    TaskDependencyCreateRequest, TaskDependencyResponse,
    TaskWatcherCreateRequest, TaskWatcherResponse,
    TaskLabelCreateRequest, TaskLabelResponse,
    TaskTemplateCreateRequest, TaskTemplateResponse,
)

from .dependencies import TaskServiceDep, UserDep
from backend.api.services.tasks.exceptions import (
    TaskNotFoundError, TaskAccessDeniedError, TaskEditDeniedError,
    TaskDeleteDeniedError, TaskValidationError, TaskDependencyError
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


def _format_task_response(task) -> TaskResponse:
    """Форматирует задачу в ответ"""
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status.value if hasattr(task.status, 'value') else str(task.status),
        priority=task.priority.value if hasattr(task.priority, 'value') else str(task.priority),
        task_type=task.task_type.value if hasattr(task.task_type, 'value') else str(task.task_type),
        visibility=task.visibility.value if hasattr(task.visibility, 'value') else str(task.visibility),
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


@router.post("/", response_model=TaskResponse)
async def create_task(
    request: TaskCreateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Создание новой задачи"""
    try:
        task_data = request.dict()
        task = await task_service.create_task(task_data, user)
        
        # Получаем задачу с отношениями для ответа
        task_with_relations = await task_service.task_repo.get_task_with_relations(task.id)
        return _format_task_response(task_with_relations)
        
    except TaskValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    task_service: TaskServiceDep,
    user: UserDep,
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
    """Получение списка задач с фильтрацией и пагинацией"""
    try:
        tasks = await task_service.get_tasks(
            user=user,
            status=status,
            priority=priority,
            task_type=task_type,
            executor_id=executor_id,
            owner_id=owner_id,
            organization_id=organization_id,
            department_id=department_id,
            due_date_from=due_date_from,
            due_date_to=due_date_to,
            search=search,
            page=page,
            size=size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return [_format_task_response(task) for task in tasks]
        
    except Exception as e:
        logger.error(f"Error listing tasks: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Получение задачи по ID"""
    try:
        task = await task_service.get_task(task_id, user)
        return _format_task_response(task)
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error getting task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    request: TaskUpdateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Обновление задачи"""
    try:
        update_data = request.dict(exclude_unset=True)
        task = await task_service.update_task(task_id, update_data, user)
        
        # Получаем задачу с отношениями для ответа
        task_with_relations = await task_service.task_repo.get_task_with_relations(task.id)
        return _format_task_response(task_with_relations)
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskEditDeniedError:
        raise HTTPException(status_code=403, detail="Edit denied")
    except TaskValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Удаление задачи"""
    try:
        await task_service.delete_task(task_id, user)
        return {"message": "Task deleted successfully"}
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskDeleteDeniedError:
        raise HTTPException(status_code=403, detail="Delete denied")
    except TaskDependencyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Комментарии к задачам
@router.post("/{task_id}/comments", response_model=TaskCommentResponse)
async def create_comment(
    task_id: int,
    request: TaskCommentCreateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Создание комментария к задаче"""
    try:
        comment_data = request.dict()
        comment = await task_service.create_comment(task_id, comment_data, user)
        
        return TaskCommentResponse(
            id=comment.id,
            task_id=comment.task_id,
            author_id=comment.author_id,
            content=comment.content,
            is_internal=comment.is_internal,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            author_name=comment.author.username if comment.author else None
        )
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error creating comment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{task_id}/comments", response_model=List[TaskCommentResponse])
async def get_comments(
    task_id: int,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Получение комментариев к задаче"""
    try:
        comments = await task_service.get_comments(task_id, user)
        
        return [
            TaskCommentResponse(
                id=comment.id,
                task_id=comment.task_id,
                author_id=comment.author_id,
                content=comment.content,
                is_internal=comment.is_internal,
                created_at=comment.created_at,
                updated_at=comment.updated_at,
                author_name=comment.author.username if comment.author else None
            )
            for comment in comments
        ]
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error getting comments: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Записи времени
@router.post("/{task_id}/time-logs", response_model=TaskTimeLogResponse)
async def create_time_log(
    task_id: int,
    request: TaskTimeLogCreateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Создание записи времени"""
    try:
        time_log_data = request.dict()
        time_log = await task_service.create_time_log(task_id, time_log_data, user)
        
        return TaskTimeLogResponse(
            id=time_log.id,
            task_id=time_log.task_id,
            user_id=time_log.user_id,
            hours=time_log.hours,
            description=time_log.description,
            start_time=time_log.start_time,
            end_time=time_log.end_time,
            created_at=time_log.created_at,
            user_name=time_log.user.username if time_log.user else None
        )
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error creating time log: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{task_id}/time-logs", response_model=List[TaskTimeLogResponse])
async def get_time_logs(
    task_id: int,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Получение записей времени по задаче"""
    try:
        time_logs = await task_service.get_time_logs(task_id, user)
        
        return [
            TaskTimeLogResponse(
                id=time_log.id,
                task_id=time_log.task_id,
                user_id=time_log.user_id,
                hours=time_log.hours,
                description=time_log.description,
                start_time=time_log.start_time,
                end_time=time_log.end_time,
                created_at=time_log.created_at,
                user_name=time_log.user.username if time_log.user else None
            )
            for time_log in time_logs
        ]
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error getting time logs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Зависимости задач
@router.post("/{task_id}/dependencies", response_model=TaskDependencyResponse)
async def create_dependency(
    task_id: int,
    request: TaskDependencyCreateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Создание зависимости задач"""
    try:
        dependency_data = request.dict()
        dependency = await task_service.create_dependency(task_id, dependency_data, user)
        
        return TaskDependencyResponse(
            id=dependency.id,
            task_id=dependency.task_id,
            depends_on_task_id=dependency.depends_on_task_id,
            dependency_type=dependency.dependency_type,
            created_at=dependency.created_at,
            depends_on_task_title=dependency.depends_on_task.title if dependency.depends_on_task else None
        )
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except TaskValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating dependency: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{task_id}/dependencies", response_model=List[TaskDependencyResponse])
async def get_dependencies(
    task_id: int,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Получение зависимостей задачи"""
    try:
        dependencies = await task_service.get_dependencies(task_id, user)
        
        return [
            TaskDependencyResponse(
                id=dependency.id,
                task_id=dependency.task_id,
                depends_on_task_id=dependency.depends_on_task_id,
                dependency_type=dependency.dependency_type,
                created_at=dependency.created_at,
                depends_on_task_title=dependency.depends_on_task.title if dependency.depends_on_task else None
            )
            for dependency in dependencies
        ]
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error getting dependencies: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Наблюдатели задач
@router.post("/{task_id}/watchers", response_model=TaskWatcherResponse)
async def create_watcher(
    task_id: int,
    request: TaskWatcherCreateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Добавление наблюдателя"""
    try:
        watcher_data = request.dict()
        watcher = await task_service.create_watcher(task_id, watcher_data, user)
        
        return TaskWatcherResponse(
            id=watcher.id,
            task_id=watcher.task_id,
            user_id=watcher.user_id,
            notification_preferences=watcher.notification_preferences,
            created_at=watcher.created_at,
            user_name=watcher.user.username if watcher.user else None
        )
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error creating watcher: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{task_id}/watchers", response_model=List[TaskWatcherResponse])
async def get_watchers(
    task_id: int,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Получение наблюдателей задачи"""
    try:
        watchers = await task_service.get_watchers(task_id, user)
        
        return [
            TaskWatcherResponse(
                id=watcher.id,
                task_id=watcher.task_id,
                user_id=watcher.user_id,
                notification_preferences=watcher.notification_preferences,
                created_at=watcher.created_at,
                user_name=watcher.user.username if watcher.user else None
            )
            for watcher in watchers
        ]
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error getting watchers: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Метки задач
@router.post("/{task_id}/labels", response_model=TaskLabelResponse)
async def create_label(
    task_id: int,
    request: TaskLabelCreateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Создание метки"""
    try:
        label_data = request.dict()
        label = await task_service.create_label(task_id, label_data, user)
        
        return TaskLabelResponse(
            id=label.id,
            task_id=label.task_id,
            name=label.name,
            color=label.color,
            description=label.description,
            created_at=label.created_at
        )
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error creating label: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{task_id}/labels", response_model=List[TaskLabelResponse])
async def get_labels(
    task_id: int,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Получение меток задачи"""
    try:
        labels = await task_service.get_labels(task_id, user)
        
        return [
            TaskLabelResponse(
                id=label.id,
                task_id=label.task_id,
                name=label.name,
                color=label.color,
                description=label.description,
                created_at=label.created_at
            )
            for label in labels
        ]
        
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except TaskAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        logger.error(f"Error getting labels: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Шаблоны задач
@router.post("/templates", response_model=TaskTemplateResponse)
async def create_template(
    request: TaskTemplateCreateRequest,
    task_service: TaskServiceDep,
    user: UserDep
):
    """Создание шаблона задачи"""
    try:
        template_data = request.dict()
        template = await task_service.create_template(template_data, user)
        
        return TaskTemplateResponse(
            id=template.id,
            name=template.name,
            description=template.description,
            task_type=template.task_type.value if hasattr(template.task_type, 'value') else str(template.task_type),
            priority=template.priority.value if hasattr(template.priority, 'value') else str(template.priority),
            template_fields=template.template_fields,
            estimated_hours=template.estimated_hours,
            created_by=template.created_by,
            organization_id=template.organization_id,
            department_id=template.department_id,
            is_active=template.is_active,
            created_at=template.created_at,
            updated_at=template.updated_at
        )
        
    except TaskValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/templates", response_model=List[TaskTemplateResponse])
async def get_templates(
    task_service: TaskServiceDep,
    user: UserDep
):
    """Получение шаблонов задач"""
    try:
        templates = await task_service.get_templates(user)
        
        return [
            TaskTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                task_type=template.task_type.value if hasattr(template.task_type, 'value') else str(template.task_type),
                priority=template.priority.value if hasattr(template.priority, 'value') else str(template.priority),
                template_fields=template.template_fields,
                estimated_hours=template.estimated_hours,
                created_by=template.created_by,
                organization_id=template.organization_id,
                department_id=template.department_id,
                is_active=template.is_active,
                created_at=template.created_at,
                updated_at=template.updated_at
            )
            for template in templates
        ]
        
    except Exception as e:
        logger.error(f"Error getting templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
