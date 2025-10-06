"""
Task repository interface.
Defines the contract for task data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from uuid import UUID

from src.domain.task_management.entities.task import Task, TaskStatus, TaskPriority, TaskType, TaskVisibility


class TaskRepository(ABC):
    """Abstract task repository interface."""
    
    @abstractmethod
    async def create(self, task: Task) -> Task:
        """Create a new task."""
        pass
    
    @abstractmethod
    async def get_by_id(self, task_id: UUID) -> Optional[Task]:
        """Get task by ID."""
        pass
    
    @abstractmethod
    async def update(self, task: Task) -> Task:
        """Update an existing task."""
        pass
    
    @abstractmethod
    async def delete(self, task_id: UUID) -> bool:
        """Delete a task."""
        pass
    
    @abstractmethod
    async def get_by_owner(self, owner_id: UUID, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by owner."""
        pass
    
    @abstractmethod
    async def get_by_executor(self, executor_id: UUID, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by executor."""
        pass
    
    @abstractmethod
    async def get_by_status(self, status: TaskStatus, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by status."""
        pass
    
    @abstractmethod
    async def get_by_priority(self, priority: TaskPriority, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by priority."""
        pass
    
    @abstractmethod
    async def get_by_type(self, task_type: TaskType, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by type."""
        pass
    
    @abstractmethod
    async def get_by_organization(self, organization_id: UUID, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by organization."""
        pass
    
    @abstractmethod
    async def get_by_department(self, department_id: UUID, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by department."""
        pass
    
    @abstractmethod
    async def get_by_parent(self, parent_id: UUID, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get subtasks by parent task ID."""
        pass
    
    @abstractmethod
    async def get_by_epic(self, epic_id: UUID, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by epic ID."""
        pass
    
    @abstractmethod
    async def get_overdue_tasks(self, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get overdue tasks."""
        pass
    
    @abstractmethod
    async def get_tasks_due_soon(self, days: int = 7, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks due within specified days."""
        pass
    
    @abstractmethod
    async def search_tasks(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Task]:
        """Search tasks by query and filters."""
        pass
    
    @abstractmethod
    async def get_task_statistics(self, user_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Get task statistics for user or globally."""
        pass
    
    @abstractmethod
    async def get_tasks_by_visibility(
        self,
        visibility: TaskVisibility,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[Task]:
        """Get tasks by visibility level for user."""
        pass
    
    @abstractmethod
    async def get_tasks_with_dependencies(self, task_id: UUID) -> List[Task]:
        """Get tasks that depend on the given task."""
        pass
    
    @abstractmethod
    async def get_tasks_depending_on(self, task_id: UUID) -> List[Task]:
        """Get tasks that the given task depends on."""
        pass
    
    @abstractmethod
    async def get_tasks_by_tag(self, tag: str, limit: int = 100, offset: int = 0) -> List[Task]:
        """Get tasks by tag."""
        pass
    
    @abstractmethod
    async def get_tasks_by_custom_field(
        self,
        field_name: str,
        field_value: Any,
        limit: int = 100,
        offset: int = 0
    ) -> List[Task]:
        """Get tasks by custom field value."""
        pass
    
    @abstractmethod
    async def count_tasks(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count tasks matching filters."""
        pass
    
    @abstractmethod
    async def exists(self, task_id: UUID) -> bool:
        """Check if task exists."""
        pass
