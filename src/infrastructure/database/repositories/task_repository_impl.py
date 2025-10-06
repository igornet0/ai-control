"""
Task repository implementation using SQLAlchemy.
Implements the TaskRepository interface for database operations.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.task_management.entities.task import Task
from src.domain.task_management.repositories.task_repository import TaskRepository
from src.domain.task_management.value_objects.task_id import TaskId
from src.domain.task_management.value_objects.task_status import TaskStatus
from src.domain.task_management.value_objects.task_priority import TaskPriority
from src.domain.user_management.value_objects.user_id import UserId
from src.infrastructure.database.models.task_model import TaskModel


class TaskRepositoryImpl(TaskRepository):
    """SQLAlchemy implementation of TaskRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, task_id: TaskId) -> Optional[Task]:
        """Get task by ID."""
        query = select(TaskModel).where(TaskModel.id == task_id.value)
        result = await self._session.execute(query)
        task_model = result.scalar_one_or_none()
        
        if not task_model:
            return None
        
        return self._to_domain_entity(task_model)

    async def get_by_assignee(self, assignee_id: UserId) -> List[Task]:
        """Get tasks by assignee."""
        query = select(TaskModel).where(TaskModel.assignee_id == assignee_id.value)
        result = await self._session.execute(query)
        task_models = result.scalars().all()
        
        return [self._to_domain_entity(task_model) for task_model in task_models]

    async def get_by_creator(self, creator_id: UserId) -> List[Task]:
        """Get tasks by creator."""
        query = select(TaskModel).where(TaskModel.creator_id == creator_id.value)
        result = await self._session.execute(query)
        task_models = result.scalars().all()
        
        return [self._to_domain_entity(task_model) for task_model in task_models]

    async def get_by_status(self, status: TaskStatus) -> List[Task]:
        """Get tasks by status."""
        query = select(TaskModel).where(TaskModel.status == status.value)
        result = await self._session.execute(query)
        task_models = result.scalars().all()
        
        return [self._to_domain_entity(task_model) for task_model in task_models]

    async def get_by_priority(self, priority: TaskPriority) -> List[Task]:
        """Get tasks by priority."""
        query = select(TaskModel).where(TaskModel.priority == priority.value)
        result = await self._session.execute(query)
        task_models = result.scalars().all()
        
        return [self._to_domain_entity(task_model) for task_model in task_models]

    async def get_overdue_tasks(self) -> List[Task]:
        """Get overdue tasks."""
        from datetime import datetime
        query = select(TaskModel).where(
            and_(
                TaskModel.due_date < datetime.utcnow(),
                TaskModel.status != TaskStatus.DONE.value
            )
        )
        result = await self._session.execute(query)
        task_models = result.scalars().all()
        
        return [self._to_domain_entity(task_model) for task_model in task_models]

    async def search_tasks(
        self,
        query_text: Optional[str] = None,
        assignee_id: Optional[UserId] = None,
        creator_id: Optional[UserId] = None,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Task]:
        """Search tasks with filters."""
        query = select(TaskModel)
        
        conditions = []
        
        if query_text:
            conditions.append(
                or_(
                    TaskModel.title.ilike(f"%{query_text}%"),
                    TaskModel.description.ilike(f"%{query_text}%")
                )
            )
        
        if assignee_id:
            conditions.append(TaskModel.assignee_id == assignee_id.value)
        
        if creator_id:
            conditions.append(TaskModel.creator_id == creator_id.value)
        
        if status:
            conditions.append(TaskModel.status == status.value)
        
        if priority:
            conditions.append(TaskModel.priority == priority.value)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.limit(limit).offset(offset)
        
        result = await self._session.execute(query)
        task_models = result.scalars().all()
        
        return [self._to_domain_entity(task_model) for task_model in task_models]

    async def save(self, task: Task) -> Task:
        """Save task."""
        task_model = self._to_model(task)
        
        # Check if task exists
        existing_task = await self.get_by_id(task.id)
        
        if existing_task:
            # Update existing task
            task_model.id = task.id.value
            self._session.merge(task_model)
        else:
            # Create new task
            self._session.add(task_model)
        
        await self._session.commit()
        await self._session.refresh(task_model)
        
        return self._to_domain_entity(task_model)

    async def delete(self, task_id: TaskId) -> bool:
        """Delete task by ID."""
        query = select(TaskModel).where(TaskModel.id == task_id.value)
        result = await self._session.execute(query)
        task_model = result.scalar_one_or_none()
        
        if not task_model:
            return False
        
        await self._session.delete(task_model)
        await self._session.commit()
        
        return True

    async def exists(self, task_id: TaskId) -> bool:
        """Check if task exists."""
        query = select(TaskModel.id).where(TaskModel.id == task_id.value)
        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def count_by_assignee(self, assignee_id: UserId) -> int:
        """Count tasks by assignee."""
        query = select(TaskModel.id).where(TaskModel.assignee_id == assignee_id.value)
        result = await self._session.execute(query)
        return len(result.scalars().all())

    async def count_by_status(self, status: TaskStatus) -> int:
        """Count tasks by status."""
        query = select(TaskModel.id).where(TaskModel.status == status.value)
        result = await self._session.execute(query)
        return len(result.scalars().all())

    def _to_domain_entity(self, task_model: TaskModel) -> Task:
        """Convert TaskModel to Task domain entity."""
        return Task(
            id=TaskId(task_model.id),
            title=task_model.title,
            description=task_model.description,
            assignee_id=UserId(task_model.assignee_id),
            creator_id=UserId(task_model.creator_id),
            priority=TaskPriority.from_string(task_model.priority),
            status=TaskStatus.from_string(task_model.status),
            due_date=task_model.due_date,
            tags=task_model.tags or [],
            created_at=task_model.created_at,
            updated_at=task_model.updated_at,
        )

    def _to_model(self, task: Task) -> TaskModel:
        """Convert Task domain entity to TaskModel."""
        return TaskModel(
            id=task.id.value,
            title=task.title,
            description=task.description,
            assignee_id=task.assignee_id.value,
            creator_id=task.creator_id.value,
            priority=task.priority.value,
            status=task.status.value,
            due_date=task.due_date,
            tags=task.tags,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
