"""
Интерфейсы репозиториев для задач
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.models.task_model import (
    Task, TaskComment, TaskTimeLog, TaskDependency, 
    TaskWatcher, TaskLabel, TaskTemplate,
    TaskStatus, TaskPriority, TaskType, TaskVisibility
)
from core.database.models.main_models import User


class ITaskRepository(ABC):
    """Интерфейс репозитория для задач"""
    
    @abstractmethod
    async def create_task(self, task_data: Dict[str, Any], owner_id: int) -> Task:
        """Создать задачу"""
        pass
    
    @abstractmethod
    async def get_task_by_id(self, task_id: int) -> Optional[Task]:
        """Получить задачу по ID"""
        pass
    
    @abstractmethod
    async def get_task_with_relations(self, task_id: int) -> Optional[Task]:
        """Получить задачу с загруженными отношениями"""
        pass
    
    @abstractmethod
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
        """Получить список задач с фильтрацией"""
        pass
    
    @abstractmethod
    async def update_task(self, task_id: int, update_data: Dict[str, Any]) -> Optional[Task]:
        """Обновить задачу"""
        pass
    
    @abstractmethod
    async def delete_task(self, task_id: int) -> bool:
        """Удалить задачу"""
        pass
    
    @abstractmethod
    async def can_access_task(self, task: Task, user: User) -> bool:
        """Проверить права доступа к задаче"""
        pass
    
    @abstractmethod
    async def can_edit_task(self, task: Task, user: User) -> bool:
        """Проверить права на редактирование задачи"""
        pass
    
    @abstractmethod
    async def can_delete_task(self, task: Task, user: User) -> bool:
        """Проверить права на удаление задачи"""
        pass


class ITaskCommentRepository(ABC):
    """Интерфейс репозитория для комментариев к задачам"""
    
    @abstractmethod
    async def create_comment(self, task_id: int, author_id: int, comment_data: Dict[str, Any]) -> TaskComment:
        """Создать комментарий"""
        pass
    
    @abstractmethod
    async def get_comments_by_task_id(self, task_id: int) -> List[TaskComment]:
        """Получить комментарии к задаче"""
        pass
    
    @abstractmethod
    async def delete_comment(self, comment_id: int) -> bool:
        """Удалить комментарий"""
        pass


class ITaskTimeLogRepository(ABC):
    """Интерфейс репозитория для записей времени"""
    
    @abstractmethod
    async def create_time_log(self, task_id: int, user_id: int, time_log_data: Dict[str, Any]) -> TaskTimeLog:
        """Создать запись времени"""
        pass
    
    @abstractmethod
    async def get_time_logs_by_task_id(self, task_id: int) -> List[TaskTimeLog]:
        """Получить записи времени по задаче"""
        pass
    
    @abstractmethod
    async def delete_time_log(self, time_log_id: int) -> bool:
        """Удалить запись времени"""
        pass


class ITaskDependencyRepository(ABC):
    """Интерфейс репозитория для зависимостей задач"""
    
    @abstractmethod
    async def create_dependency(self, task_id: int, dependency_data: Dict[str, Any]) -> TaskDependency:
        """Создать зависимость"""
        pass
    
    @abstractmethod
    async def get_dependencies_by_task_id(self, task_id: int) -> List[TaskDependency]:
        """Получить зависимости задачи"""
        pass
    
    @abstractmethod
    async def delete_dependency(self, dependency_id: int) -> bool:
        """Удалить зависимость"""
        pass


class ITaskWatcherRepository(ABC):
    """Интерфейс репозитория для наблюдателей задач"""
    
    @abstractmethod
    async def create_watcher(self, task_id: int, watcher_data: Dict[str, Any]) -> TaskWatcher:
        """Добавить наблюдателя"""
        pass
    
    @abstractmethod
    async def get_watchers_by_task_id(self, task_id: int) -> List[TaskWatcher]:
        """Получить наблюдателей задачи"""
        pass
    
    @abstractmethod
    async def delete_watcher(self, watcher_id: int) -> bool:
        """Удалить наблюдателя"""
        pass


class ITaskLabelRepository(ABC):
    """Интерфейс репозитория для меток задач"""
    
    @abstractmethod
    async def create_label(self, task_id: int, label_data: Dict[str, Any]) -> TaskLabel:
        """Создать метку"""
        pass
    
    @abstractmethod
    async def get_labels_by_task_id(self, task_id: int) -> List[TaskLabel]:
        """Получить метки задачи"""
        pass
    
    @abstractmethod
    async def delete_label(self, label_id: int) -> bool:
        """Удалить метку"""
        pass


class ITaskTemplateRepository(ABC):
    """Интерфейс репозитория для шаблонов задач"""
    
    @abstractmethod
    async def create_template(self, created_by: int, template_data: Dict[str, Any]) -> TaskTemplate:
        """Создать шаблон"""
        pass
    
    @abstractmethod
    async def get_templates(self, organization_id: Optional[int] = None, department_id: Optional[int] = None) -> List[TaskTemplate]:
        """Получить шаблоны"""
        pass
    
    @abstractmethod
    async def get_template_by_id(self, template_id: int) -> Optional[TaskTemplate]:
        """Получить шаблон по ID"""
        pass
    
    @abstractmethod
    async def delete_template(self, template_id: int) -> bool:
        """Удалить шаблон"""
        pass
