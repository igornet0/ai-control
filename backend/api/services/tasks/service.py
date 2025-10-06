"""
Сервис для работы с задачами
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.models.task_model import (
    Task, TaskComment, TaskTimeLog, TaskDependency, 
    TaskWatcher, TaskLabel, TaskTemplate,
    TaskStatus, TaskPriority, TaskType, TaskVisibility
)
from core.database.models.main_models import User

from ...repositories.tasks import (
    TaskRepository, TaskCommentRepository, TaskTimeLogRepository,
    TaskDependencyRepository, TaskWatcherRepository, TaskLabelRepository,
    TaskTemplateRepository
)

from .exceptions import (
    TaskNotFoundError, TaskAccessDeniedError, TaskEditDeniedError,
    TaskDeleteDeniedError, TaskValidationError, TaskDependencyError
)

logger = logging.getLogger(__name__)


class TaskService:
    """Сервис для работы с задачами"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.task_repo = TaskRepository(session)
        self.comment_repo = TaskCommentRepository(session)
        self.time_log_repo = TaskTimeLogRepository(session)
        self.dependency_repo = TaskDependencyRepository(session)
        self.watcher_repo = TaskWatcherRepository(session)
        self.label_repo = TaskLabelRepository(session)
        self.template_repo = TaskTemplateRepository(session)
    
    async def create_task(self, task_data: Dict[str, Any], user: User) -> Task:
        """Создать задачу"""
        try:
            # Валидация данных
            await self._validate_task_data(task_data, user)
            
            # Проверяем существование связанных задач
            if task_data.get("parent_id"):
                parent_task = await self.task_repo.get_task_by_id(task_data["parent_id"])
                if not parent_task:
                    raise TaskValidationError("Parent task not found")
            
            if task_data.get("epic_id"):
                epic_task = await self.task_repo.get_task_by_id(task_data["epic_id"])
                if not epic_task:
                    raise TaskValidationError("Epic task not found")
            
            # Создаем задачу
            task = await self.task_repo.create_task(task_data, user.id)
            
            logger.info(f"Task created: {task.id} by user {user.id}")
            return task
            
        except TaskValidationError:
            raise
        except Exception as e:
            logger.error(f"Error creating task: {e}")
            raise TaskServiceError(f"Failed to create task: {str(e)}")
    
    async def get_task(self, task_id: int, user: User) -> Task:
        """Получить задачу"""
        task = await self.task_repo.get_task_with_relations(task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")
        
        if not await self.task_repo.can_access_task(task, user):
            raise TaskAccessDeniedError(f"Access denied to task {task_id}")
        
        return task
    
    async def get_tasks(
        self,
        user: User,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        task_type: Optional[TaskType] = None,
        executor_id: Optional[int] = None,
        owner_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        department_id: Optional[int] = None,
        due_date_from: Optional[datetime] = None,
        due_date_to: Optional[datetime] = None,
        search: Optional[str] = None,
        page: int = 1,
        size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> List[Task]:
        """Получить список задач"""
        try:
            tasks = await self.task_repo.get_tasks(
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
            
            # Фильтруем задачи по правам доступа
            accessible_tasks = []
            for task in tasks:
                if await self.task_repo.can_access_task(task, user):
                    accessible_tasks.append(task)
            
            return accessible_tasks
            
        except Exception as e:
            logger.error(f"Error getting tasks: {e}")
            raise TaskServiceError(f"Failed to get tasks: {str(e)}")
    
    async def update_task(self, task_id: int, update_data: Dict[str, Any], user: User) -> Task:
        """Обновить задачу"""
        try:
            # Получаем задачу
            task = await self.task_repo.get_task_by_id(task_id)
            if not task:
                raise TaskNotFoundError(f"Task {task_id} not found")
            
            # Проверяем права на редактирование
            if not await self.task_repo.can_edit_task(task, user):
                raise TaskEditDeniedError(f"Edit denied for task {task_id}")
            
            # Валидация данных обновления
            await self._validate_task_update_data(update_data, user)
            
            # Обновляем задачу
            updated_task = await self.task_repo.update_task(task_id, update_data)
            if not updated_task:
                raise TaskNotFoundError(f"Task {task_id} not found after update")
            
            logger.info(f"Task updated: {task_id} by user {user.id}")
            return updated_task
            
        except (TaskNotFoundError, TaskEditDeniedError, TaskValidationError):
            raise
        except Exception as e:
            logger.error(f"Error updating task: {e}")
            raise TaskServiceError(f"Failed to update task: {str(e)}")
    
    async def delete_task(self, task_id: int, user: User) -> bool:
        """Удалить задачу"""
        try:
            # Получаем задачу
            task = await self.task_repo.get_task_by_id(task_id)
            if not task:
                raise TaskNotFoundError(f"Task {task_id} not found")
            
            # Проверяем права на удаление
            if not await self.task_repo.can_delete_task(task, user):
                raise TaskDeleteDeniedError(f"Delete denied for task {task_id}")
            
            # Проверяем, что нет активных подзадач
            if task.subtasks:
                active_subtasks = [
                    st for st in task.subtasks 
                    if st.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
                ]
                if active_subtasks:
                    raise TaskDependencyError("Cannot delete task with active subtasks")
            
            # Удаляем задачу
            success = await self.task_repo.delete_task(task_id)
            if not success:
                raise TaskServiceError(f"Failed to delete task {task_id}")
            
            logger.info(f"Task deleted: {task_id} by user {user.id}")
            return True
            
        except (TaskNotFoundError, TaskDeleteDeniedError, TaskDependencyError):
            raise
        except Exception as e:
            logger.error(f"Error deleting task: {e}")
            raise TaskServiceError(f"Failed to delete task: {str(e)}")
    
    async def create_comment(self, task_id: int, comment_data: Dict[str, Any], user: User) -> TaskComment:
        """Создать комментарий к задаче"""
        try:
            # Проверяем доступ к задаче
            task = await self.get_task(task_id, user)
            
            # Создаем комментарий
            comment = await self.comment_repo.create_comment(task_id, user.id, comment_data)
            
            logger.info(f"Comment created for task {task_id} by user {user.id}")
            return comment
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error creating comment: {e}")
            raise TaskServiceError(f"Failed to create comment: {str(e)}")
    
    async def get_comments(self, task_id: int, user: User) -> List[TaskComment]:
        """Получить комментарии к задаче"""
        try:
            # Проверяем доступ к задаче
            await self.get_task(task_id, user)
            
            # Получаем комментарии
            comments = await self.comment_repo.get_comments_by_task_id(task_id)
            return comments
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error getting comments: {e}")
            raise TaskServiceError(f"Failed to get comments: {str(e)}")
    
    async def create_time_log(self, task_id: int, time_log_data: Dict[str, Any], user: User) -> TaskTimeLog:
        """Создать запись времени"""
        try:
            # Проверяем доступ к задаче
            task = await self.get_task(task_id, user)
            
            # Создаем запись времени
            time_log = await self.time_log_repo.create_time_log(task_id, user.id, time_log_data)
            
            logger.info(f"Time log created for task {task_id} by user {user.id}")
            return time_log
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error creating time log: {e}")
            raise TaskServiceError(f"Failed to create time log: {str(e)}")
    
    async def get_time_logs(self, task_id: int, user: User) -> List[TaskTimeLog]:
        """Получить записи времени по задаче"""
        try:
            # Проверяем доступ к задаче
            await self.get_task(task_id, user)
            
            # Получаем записи времени
            time_logs = await self.time_log_repo.get_time_logs_by_task_id(task_id)
            return time_logs
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error getting time logs: {e}")
            raise TaskServiceError(f"Failed to get time logs: {str(e)}")
    
    async def create_dependency(self, task_id: int, dependency_data: Dict[str, Any], user: User) -> TaskDependency:
        """Создать зависимость задач"""
        try:
            # Проверяем доступ к задаче
            task = await self.get_task(task_id, user)
            
            # Проверяем существование зависимой задачи
            depends_on_task = await self.task_repo.get_task_by_id(dependency_data["depends_on_task_id"])
            if not depends_on_task:
                raise TaskValidationError("Depends on task not found")
            
            # Создаем зависимость
            dependency = await self.dependency_repo.create_dependency(task_id, dependency_data)
            
            logger.info(f"Dependency created for task {task_id} by user {user.id}")
            return dependency
            
        except (TaskNotFoundError, TaskAccessDeniedError, TaskValidationError):
            raise
        except Exception as e:
            logger.error(f"Error creating dependency: {e}")
            raise TaskServiceError(f"Failed to create dependency: {str(e)}")
    
    async def get_dependencies(self, task_id: int, user: User) -> List[TaskDependency]:
        """Получить зависимости задачи"""
        try:
            # Проверяем доступ к задаче
            await self.get_task(task_id, user)
            
            # Получаем зависимости
            dependencies = await self.dependency_repo.get_dependencies_by_task_id(task_id)
            return dependencies
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error getting dependencies: {e}")
            raise TaskServiceError(f"Failed to get dependencies: {str(e)}")
    
    async def create_watcher(self, task_id: int, watcher_data: Dict[str, Any], user: User) -> TaskWatcher:
        """Добавить наблюдателя"""
        try:
            # Проверяем доступ к задаче
            task = await self.get_task(task_id, user)
            
            # Создаем наблюдателя
            watcher = await self.watcher_repo.create_watcher(task_id, watcher_data)
            
            logger.info(f"Watcher added to task {task_id} by user {user.id}")
            return watcher
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error creating watcher: {e}")
            raise TaskServiceError(f"Failed to create watcher: {str(e)}")
    
    async def get_watchers(self, task_id: int, user: User) -> List[TaskWatcher]:
        """Получить наблюдателей задачи"""
        try:
            # Проверяем доступ к задаче
            await self.get_task(task_id, user)
            
            # Получаем наблюдателей
            watchers = await self.watcher_repo.get_watchers_by_task_id(task_id)
            return watchers
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error getting watchers: {e}")
            raise TaskServiceError(f"Failed to get watchers: {str(e)}")
    
    async def create_label(self, task_id: int, label_data: Dict[str, Any], user: User) -> TaskLabel:
        """Создать метку"""
        try:
            # Проверяем доступ к задаче
            task = await self.get_task(task_id, user)
            
            # Создаем метку
            label = await self.label_repo.create_label(task_id, label_data)
            
            logger.info(f"Label created for task {task_id} by user {user.id}")
            return label
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error creating label: {e}")
            raise TaskServiceError(f"Failed to create label: {str(e)}")
    
    async def get_labels(self, task_id: int, user: User) -> List[TaskLabel]:
        """Получить метки задачи"""
        try:
            # Проверяем доступ к задаче
            await self.get_task(task_id, user)
            
            # Получаем метки
            labels = await self.label_repo.get_labels_by_task_id(task_id)
            return labels
            
        except (TaskNotFoundError, TaskAccessDeniedError):
            raise
        except Exception as e:
            logger.error(f"Error getting labels: {e}")
            raise TaskServiceError(f"Failed to get labels: {str(e)}")
    
    async def create_template(self, template_data: Dict[str, Any], user: User) -> TaskTemplate:
        """Создать шаблон задачи"""
        try:
            # Валидация данных шаблона
            await self._validate_template_data(template_data)
            
            # Создаем шаблон
            template = await self.template_repo.create_template(user.id, template_data)
            
            logger.info(f"Template created by user {user.id}")
            return template
            
        except TaskValidationError:
            raise
        except Exception as e:
            logger.error(f"Error creating template: {e}")
            raise TaskServiceError(f"Failed to create template: {str(e)}")
    
    async def get_templates(self, user: User) -> List[TaskTemplate]:
        """Получить шаблоны задач"""
        try:
            templates = await self.template_repo.get_templates(
                organization_id=user.organization_id,
                department_id=user.department_id
            )
            return templates
            
        except Exception as e:
            logger.error(f"Error getting templates: {e}")
            raise TaskServiceError(f"Failed to get templates: {str(e)}")
    
    async def _validate_task_data(self, task_data: Dict[str, Any], user: User) -> None:
        """Валидация данных задачи"""
        if not task_data.get("title"):
            raise TaskValidationError("Title is required")
        
        if len(task_data["title"]) > 255:
            raise TaskValidationError("Title too long")
        
        if task_data.get("estimated_hours") is not None and task_data["estimated_hours"] < 0:
            raise TaskValidationError("Estimated hours must be non-negative")
        
        # Проверяем права на назначение исполнителя
        if task_data.get("executor_id") and task_data["executor_id"] != user.id:
            # TODO: Проверка прав на назначение задач
            pass
        
        # Проверяем права на назначение рецензента
        if task_data.get("reviewer_id") and task_data["reviewer_id"] != user.id:
            # TODO: Проверка прав на назначение рецензентов
            pass
    
    async def _validate_task_update_data(self, update_data: Dict[str, Any], user: User) -> None:
        """Валидация данных обновления задачи"""
        if "title" in update_data and not update_data["title"]:
            raise TaskValidationError("Title cannot be empty")
        
        if "title" in update_data and len(update_data["title"]) > 255:
            raise TaskValidationError("Title too long")
        
        if "estimated_hours" in update_data and update_data["estimated_hours"] is not None and update_data["estimated_hours"] < 0:
            raise TaskValidationError("Estimated hours must be non-negative")
        
        if "progress_percentage" in update_data and (update_data["progress_percentage"] < 0 or update_data["progress_percentage"] > 100):
            raise TaskValidationError("Progress percentage must be between 0 and 100")
    
    async def _validate_template_data(self, template_data: Dict[str, Any]) -> None:
        """Валидация данных шаблона"""
        if not template_data.get("name"):
            raise TaskValidationError("Template name is required")
        
        if len(template_data["name"]) > 255:
            raise TaskValidationError("Template name too long")
        
        if not template_data.get("template_fields"):
            raise TaskValidationError("Template fields are required")
        
        if template_data.get("estimated_hours") is not None and template_data["estimated_hours"] < 0:
            raise TaskValidationError("Estimated hours must be non-negative")
