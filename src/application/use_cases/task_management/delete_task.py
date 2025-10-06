"""
Delete Task use case.
Handles the business logic for deleting a task.
"""

from uuid import UUID

from src.domain.exceptions import EntityNotFound, PermissionDenied
from src.domain.task_management.entities.task import Task
from src.domain.task_management.repositories.task_repository import TaskRepository
from src.domain.task_management.value_objects.task_id import TaskId
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository


class DeleteTaskRequest:
    """Request model for deleting a task."""
    
    def __init__(self, task_id: TaskId, deleted_by: UUID):
        self.task_id = task_id
        self.deleted_by = deleted_by


class DeleteTaskResponse:
    """Response model for deleting a task."""
    
    def __init__(self, success: bool, message: str):
        self.success = success
        self.message = message


class DeleteTaskUseCase:
    """Use case for deleting a task."""
    
    def __init__(
        self,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ):
        self._task_repository = task_repository
        self._user_repository = user_repository
    
    async def execute(self, request: DeleteTaskRequest) -> DeleteTaskResponse:
        """
        Execute the delete task use case.
        
        Args:
            request: Delete task request
            
        Returns:
            DeleteTaskResponse: Deletion result
            
        Raises:
            EntityNotFound: If task is not found
            PermissionDenied: If user doesn't have permission to delete task
        """
        # Get the task
        task = await self._task_repository.get_by_id(request.task_id)
        if not task:
            raise EntityNotFound(
                entity_type="Task",
                entity_id=str(request.task_id.value),
                details={"task_id": str(request.task_id.value)}
            )
        
        # Get the user who is deleting
        user = await self._user_repository.get_by_id(request.deleted_by)
        if not user:
            raise EntityNotFound(
                entity_type="User",
                entity_id=str(request.deleted_by),
                details={"user_id": str(request.deleted_by)}
            )
        
        # Check permissions
        if not self._can_delete_task(user, task):
            raise PermissionDenied(
                operation="delete_task",
                resource=f"task_{request.task_id.value}",
                user_id=str(request.deleted_by)
            )
        
        # Delete the task
        success = await self._task_repository.delete(request.task_id)
        
        if success:
            return DeleteTaskResponse(
                success=True,
                message=f"Task {request.task_id.value} deleted successfully"
            )
        else:
            return DeleteTaskResponse(
                success=False,
                message=f"Failed to delete task {request.task_id.value}"
            )
    
    def _can_delete_task(self, user: User, task: Task) -> bool:
        """Check if user can delete the task."""
        # Task creator can delete their own tasks
        if task.creator_id == user.id:
            return True
        
        # Task assignee can delete their own tasks
        if task.assignee_id == user.id:
            return True
        
        # Managers can delete tasks of their subordinates
        if user.can_manage_users():
            # Check if task assignee is subordinate
            if task.assignee_id and user.is_subordinate_of(task.assignee_id):
                return True
        
        # Admins and CEOs can delete any task
        if user.can_access_admin_panel():
            return True
        
        return False
