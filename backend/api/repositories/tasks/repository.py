"""
Репозиторий для задач
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload

from core.database.models.task_model import (
    Task, TaskComment, TaskTimeLog, TaskDependency, 
    TaskWatcher, TaskLabel, TaskTemplate,
    TaskStatus, TaskPriority, TaskType, TaskVisibility
)
from core.database.models.main_models import User

from .interfaces import (
    ITaskRepository, ITaskCommentRepository, ITaskTimeLogRepository,
    ITaskDependencyRepository, ITaskWatcherRepository, ITaskLabelRepository,
    ITaskTemplateRepository
)


class TaskRepository(ITaskRepository):
    """Репозиторий для работы с задачами"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_task(self, task_data: Dict[str, Any], owner_id: int) -> Task:
        """Создать задачу"""
        task = Task(
            title=task_data["title"],
            description=task_data.get("description"),
            task_type=task_data.get("task_type", TaskType.TASK),
            priority=task_data.get("priority", TaskPriority.MEDIUM),
            visibility=task_data.get("visibility", TaskVisibility.TEAM),
            parent_id=task_data.get("parent_id"),
            epic_id=task_data.get("epic_id"),
            due_date=task_data.get("due_date"),
            start_date=task_data.get("start_date"),
            estimated_hours=task_data.get("estimated_hours"),
            executor_id=task_data.get("executor_id"),
            reviewer_id=task_data.get("reviewer_id"),
            organization_id=task_data.get("organization_id"),
            department_id=task_data.get("department_id"),
            tags=task_data.get("tags"),
            custom_fields=task_data.get("custom_fields"),
            owner_id=owner_id
        )
        
        self.session.add(task)
        await self.session.commit()
        await self.session.refresh(task)
        return task
    
    async def get_task_by_id(self, task_id: int) -> Optional[Task]:
        """Получить задачу по ID"""
        return await self.session.get(Task, task_id)
    
    async def get_task_with_relations(self, task_id: int) -> Optional[Task]:
        """Получить задачу с загруженными отношениями"""
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
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
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
        
        if status:
            filters.append(Task.status == status)
        if priority:
            filters.append(Task.priority == priority)
        if task_type:
            filters.append(Task.task_type == task_type)
        if executor_id:
            filters.append(Task.executor_id == executor_id)
        if owner_id:
            filters.append(Task.owner_id == owner_id)
        if organization_id:
            filters.append(Task.organization_id == organization_id)
        elif user.organization_id:
            filters.append(Task.organization_id == user.organization_id)
        if department_id:
            filters.append(Task.department_id == department_id)
        elif user.department_id:
            filters.append(Task.department_id == user.department_id)
        if due_date_from:
            filters.append(Task.due_date >= due_date_from)
        if due_date_to:
            filters.append(Task.due_date <= due_date_to)
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
        result = await self.session.execute(query)
        return result.scalars().unique().all()
    
    async def update_task(self, task_id: int, update_data: Dict[str, Any]) -> Optional[Task]:
        """Обновить задачу"""
        task = await self.session.get(Task, task_id)
        if not task:
            return None
        
        for field, value in update_data.items():
            if hasattr(task, field):
                setattr(task, field, value)
        
        await self.session.commit()
        await self.session.refresh(task)
        return task
    
    async def delete_task(self, task_id: int) -> bool:
        """Удалить задачу"""
        task = await self.session.get(Task, task_id)
        if not task:
            return False
        
        await self.session.delete(task)
        await self.session.commit()
        return True
    
    async def can_access_task(self, task: Task, user: User) -> bool:
        """Проверить права доступа к задаче"""
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
    
    async def can_edit_task(self, task: Task, user: User) -> bool:
        """Проверить права на редактирование задачи"""
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
    
    async def can_delete_task(self, task: Task, user: User) -> bool:
        """Проверить права на удаление задачи"""
        # Только владелец или администраторы могут удалять
        if task.owner_id == user.id:
            return True
        
        if user.role in ["admin", "CEO"]:
            return True
        
        return False


class TaskCommentRepository(ITaskCommentRepository):
    """Репозиторий для комментариев к задачам"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_comment(self, task_id: int, author_id: int, comment_data: Dict[str, Any]) -> TaskComment:
        """Создать комментарий"""
        comment = TaskComment(
            task_id=task_id,
            author_id=author_id,
            content=comment_data["content"],
            is_internal=comment_data.get("is_internal", False)
        )
        
        self.session.add(comment)
        await self.session.commit()
        await self.session.refresh(comment)
        return comment
    
    async def get_comments_by_task_id(self, task_id: int) -> List[TaskComment]:
        """Получить комментарии к задаче"""
        query = select(TaskComment).where(TaskComment.task_id == task_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def delete_comment(self, comment_id: int) -> bool:
        """Удалить комментарий"""
        comment = await self.session.get(TaskComment, comment_id)
        if not comment:
            return False
        
        await self.session.delete(comment)
        await self.session.commit()
        return True


class TaskTimeLogRepository(ITaskTimeLogRepository):
    """Репозиторий для записей времени"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_time_log(self, task_id: int, user_id: int, time_log_data: Dict[str, Any]) -> TaskTimeLog:
        """Создать запись времени"""
        time_log = TaskTimeLog(
            task_id=task_id,
            user_id=user_id,
            hours=time_log_data["hours"],
            description=time_log_data.get("description"),
            start_time=time_log_data["start_time"],
            end_time=time_log_data.get("end_time")
        )
        
        self.session.add(time_log)
        await self.session.commit()
        await self.session.refresh(time_log)
        return time_log
    
    async def get_time_logs_by_task_id(self, task_id: int) -> List[TaskTimeLog]:
        """Получить записи времени по задаче"""
        query = select(TaskTimeLog).where(TaskTimeLog.task_id == task_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def delete_time_log(self, time_log_id: int) -> bool:
        """Удалить запись времени"""
        time_log = await self.session.get(TaskTimeLog, time_log_id)
        if not time_log:
            return False
        
        await self.session.delete(time_log)
        await self.session.commit()
        return True


class TaskDependencyRepository(ITaskDependencyRepository):
    """Репозиторий для зависимостей задач"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_dependency(self, task_id: int, dependency_data: Dict[str, Any]) -> TaskDependency:
        """Создать зависимость"""
        dependency = TaskDependency(
            task_id=task_id,
            depends_on_task_id=dependency_data["depends_on_task_id"],
            dependency_type=dependency_data.get("dependency_type", "blocks")
        )
        
        self.session.add(dependency)
        await self.session.commit()
        await self.session.refresh(dependency)
        return dependency
    
    async def get_dependencies_by_task_id(self, task_id: int) -> List[TaskDependency]:
        """Получить зависимости задачи"""
        query = select(TaskDependency).where(TaskDependency.task_id == task_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def delete_dependency(self, dependency_id: int) -> bool:
        """Удалить зависимость"""
        dependency = await self.session.get(TaskDependency, dependency_id)
        if not dependency:
            return False
        
        await self.session.delete(dependency)
        await self.session.commit()
        return True


class TaskWatcherRepository(ITaskWatcherRepository):
    """Репозиторий для наблюдателей задач"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_watcher(self, task_id: int, watcher_data: Dict[str, Any]) -> TaskWatcher:
        """Добавить наблюдателя"""
        watcher = TaskWatcher(
            task_id=task_id,
            user_id=watcher_data["user_id"],
            notification_preferences=watcher_data.get("notification_preferences")
        )
        
        self.session.add(watcher)
        await self.session.commit()
        await self.session.refresh(watcher)
        return watcher
    
    async def get_watchers_by_task_id(self, task_id: int) -> List[TaskWatcher]:
        """Получить наблюдателей задачи"""
        query = select(TaskWatcher).where(TaskWatcher.task_id == task_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def delete_watcher(self, watcher_id: int) -> bool:
        """Удалить наблюдателя"""
        watcher = await self.session.get(TaskWatcher, watcher_id)
        if not watcher:
            return False
        
        await self.session.delete(watcher)
        await self.session.commit()
        return True


class TaskLabelRepository(ITaskLabelRepository):
    """Репозиторий для меток задач"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_label(self, task_id: int, label_data: Dict[str, Any]) -> TaskLabel:
        """Создать метку"""
        label = TaskLabel(
            task_id=task_id,
            name=label_data["name"],
            color=label_data.get("color", "#007bff"),
            description=label_data.get("description")
        )
        
        self.session.add(label)
        await self.session.commit()
        await self.session.refresh(label)
        return label
    
    async def get_labels_by_task_id(self, task_id: int) -> List[TaskLabel]:
        """Получить метки задачи"""
        query = select(TaskLabel).where(TaskLabel.task_id == task_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def delete_label(self, label_id: int) -> bool:
        """Удалить метку"""
        label = await self.session.get(TaskLabel, label_id)
        if not label:
            return False
        
        await self.session.delete(label)
        await self.session.commit()
        return True


class TaskTemplateRepository(ITaskTemplateRepository):
    """Репозиторий для шаблонов задач"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_template(self, created_by: int, template_data: Dict[str, Any]) -> TaskTemplate:
        """Создать шаблон"""
        template = TaskTemplate(
            name=template_data["name"],
            description=template_data.get("description"),
            task_type=template_data.get("task_type", TaskType.TASK),
            priority=template_data.get("priority", TaskPriority.MEDIUM),
            template_fields=template_data["template_fields"],
            estimated_hours=template_data.get("estimated_hours"),
            created_by=created_by,
            organization_id=template_data.get("organization_id"),
            department_id=template_data.get("department_id")
        )
        
        self.session.add(template)
        await self.session.commit()
        await self.session.refresh(template)
        return template
    
    async def get_templates(self, organization_id: Optional[int] = None, department_id: Optional[int] = None) -> List[TaskTemplate]:
        """Получить шаблоны"""
        query = select(TaskTemplate).where(TaskTemplate.is_active == True)
        
        if organization_id:
            query = query.where(TaskTemplate.organization_id == organization_id)
        if department_id:
            query = query.where(TaskTemplate.department_id == department_id)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_template_by_id(self, template_id: int) -> Optional[TaskTemplate]:
        """Получить шаблон по ID"""
        return await self.session.get(TaskTemplate, template_id)
    
    async def delete_template(self, template_id: int) -> bool:
        """Удалить шаблон"""
        template = await self.session.get(TaskTemplate, template_id)
        if not template:
            return False
        
        await self.session.delete(template)
        await self.session.commit()
        return True
