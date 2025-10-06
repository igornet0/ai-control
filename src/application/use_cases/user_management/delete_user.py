"""
Delete User use case.
Handles the business logic for deleting a user.
"""

from uuid import UUID

from src.domain.exceptions import EntityNotFound, PermissionDenied, BusinessRuleViolation
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository
from src.domain.user_management.value_objects.user_id import UserId


class DeleteUserRequest:
    """Request model for deleting a user."""
    
    def __init__(self, user_id: UserId, deleted_by: UUID):
        self.user_id = user_id
        self.deleted_by = deleted_by


class DeleteUserResponse:
    """Response model for deleting a user."""
    
    def __init__(self, success: bool, message: str):
        self.success = success
        self.message = message


class DeleteUserUseCase:
    """Use case for deleting a user."""
    
    def __init__(self, user_repository: UserRepository):
        self._user_repository = user_repository
    
    async def execute(self, request: DeleteUserRequest) -> DeleteUserResponse:
        """
        Execute the delete user use case.
        
        Args:
            request: Delete user request
            
        Returns:
            DeleteUserResponse: Deletion result
            
        Raises:
            EntityNotFound: If user is not found
            PermissionDenied: If user doesn't have permission to delete user
            BusinessRuleViolation: If business rules prevent deletion
        """
        # Get the user to be deleted
        user = await self._user_repository.get_by_id(request.user_id)
        if not user:
            raise EntityNotFound(
                entity_type="User",
                entity_id=str(request.user_id.value),
                details={"user_id": str(request.user_id.value)}
            )
        
        # Get the user who is deleting
        deleting_user = await self._user_repository.get_by_id(request.deleted_by)
        if not deleting_user:
            raise EntityNotFound(
                entity_type="User",
                entity_id=str(request.deleted_by),
                details={"user_id": str(request.deleted_by)}
            )
        
        # Check permissions
        if not self._can_delete_user(deleting_user, user):
            raise PermissionDenied(
                operation="delete_user",
                resource=f"user_{request.user_id.value}",
                user_id=str(request.deleted_by)
            )
        
        # Check business rules
        self._validate_deletion_rules(user)
        
        # Delete the user
        success = await self._user_repository.delete(request.user_id)
        
        if success:
            return DeleteUserResponse(
                success=True,
                message=f"User {request.user_id.value} deleted successfully"
            )
        else:
            return DeleteUserResponse(
                success=False,
                message=f"Failed to delete user {request.user_id.value}"
            )
    
    def _can_delete_user(self, deleting_user: User, user_to_delete: User) -> bool:
        """Check if user can delete another user."""
        # Users cannot delete themselves
        if deleting_user.id == user_to_delete.id:
            return False
        
        # Admins and CEOs can delete any user
        if deleting_user.can_access_admin_panel():
            return True
        
        # Managers can delete their subordinates
        if deleting_user.can_manage_users():
            if user_to_delete.manager_id == deleting_user.id:
                return True
        
        return False
    
    def _validate_deletion_rules(self, user: User) -> None:
        """Validate business rules for user deletion."""
        # Check if user has active tasks
        # This would require checking task repository
        # For now, we'll just check if user is active
        
        if user.is_active:
            # In a real system, you might want to check for:
            # - Active tasks assigned to the user
            # - Active projects managed by the user
            # - Pending approvals
            # etc.
            pass
        
        # Check if user is the last admin
        # This would require checking if there are other admins
        # For now, we'll just allow deletion
        pass
