"""
Task comment repository interface.
Defines the contract for task comment data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.task_management.entities.task_comment import TaskComment


class TaskCommentRepository(ABC):
    """Abstract task comment repository interface."""
    
    @abstractmethod
    async def create(self, comment: TaskComment) -> TaskComment:
        """Create a new task comment."""
        pass
    
    @abstractmethod
    async def get_by_id(self, comment_id: UUID) -> Optional[TaskComment]:
        """Get comment by ID."""
        pass
    
    @abstractmethod
    async def update(self, comment: TaskComment) -> TaskComment:
        """Update an existing comment."""
        pass
    
    @abstractmethod
    async def delete(self, comment_id: UUID) -> bool:
        """Delete a comment."""
        pass
    
    @abstractmethod
    async def get_by_task(self, task_id: UUID, limit: int = 100, offset: int = 0) -> List[TaskComment]:
        """Get comments by task ID."""
        pass
    
    @abstractmethod
    async def get_by_author(self, author_id: UUID, limit: int = 100, offset: int = 0) -> List[TaskComment]:
        """Get comments by author ID."""
        pass
    
    @abstractmethod
    async def get_internal_comments(self, task_id: UUID, limit: int = 100, offset: int = 0) -> List[TaskComment]:
        """Get internal comments for a task."""
        pass
    
    @abstractmethod
    async def get_public_comments(self, task_id: UUID, limit: int = 100, offset: int = 0) -> List[TaskComment]:
        """Get public comments for a task."""
        pass
    
    @abstractmethod
    async def count_comments(self, task_id: UUID) -> int:
        """Count comments for a task."""
        pass
    
    @abstractmethod
    async def exists(self, comment_id: UUID) -> bool:
        """Check if comment exists."""
        pass
