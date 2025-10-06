"""
Task time log repository interface.
Defines the contract for task time log data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.task_management.entities.task_time_log import TaskTimeLog


class TaskTimeLogRepository(ABC):
    """Abstract task time log repository interface."""
    
    @abstractmethod
    async def create(self, time_log: TaskTimeLog) -> TaskTimeLog:
        """Create a new task time log."""
        pass
    
    @abstractmethod
    async def get_by_id(self, time_log_id: UUID) -> Optional[TaskTimeLog]:
        """Get time log by ID."""
        pass
    
    @abstractmethod
    async def update(self, time_log: TaskTimeLog) -> TaskTimeLog:
        """Update an existing time log."""
        pass
    
    @abstractmethod
    async def delete(self, time_log_id: UUID) -> bool:
        """Delete a time log."""
        pass
    
    @abstractmethod
    async def get_by_task(self, task_id: UUID, limit: int = 100, offset: int = 0) -> List[TaskTimeLog]:
        """Get time logs by task ID."""
        pass
    
    @abstractmethod
    async def get_by_user(self, user_id: UUID, limit: int = 100, offset: int = 0) -> List[TaskTimeLog]:
        """Get time logs by user ID."""
        pass
    
    @abstractmethod
    async def get_active_time_logs(self, user_id: UUID) -> List[TaskTimeLog]:
        """Get active time logs for user (no end time)."""
        pass
    
    @abstractmethod
    async def get_time_logs_by_date_range(
        self,
        user_id: UUID,
        start_date: str,
        end_date: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[TaskTimeLog]:
        """Get time logs by date range for user."""
        pass
    
    @abstractmethod
    async def get_total_hours_by_task(self, task_id: UUID) -> float:
        """Get total hours logged for a task."""
        pass
    
    @abstractmethod
    async def get_total_hours_by_user(self, user_id: UUID, start_date: Optional[str] = None, end_date: Optional[str] = None) -> float:
        """Get total hours logged by user."""
        pass
    
    @abstractmethod
    async def count_time_logs(self, task_id: UUID) -> int:
        """Count time logs for a task."""
        pass
    
    @abstractmethod
    async def exists(self, time_log_id: UUID) -> bool:
        """Check if time log exists."""
        pass
