"""
Delete Dashboard use case.
Handles the business logic for deleting a dashboard.
"""

from uuid import UUID

from src.domain.exceptions import EntityNotFound, PermissionDenied
from src.domain.dashboard.entities.dashboard import Dashboard
from src.domain.dashboard.repositories.dashboard_repository import DashboardRepository
from src.domain.dashboard.value_objects.dashboard_id import DashboardId
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository


class DeleteDashboardRequest:
    """Request model for deleting a dashboard."""
    
    def __init__(self, dashboard_id: DashboardId, deleted_by: UUID):
        self.dashboard_id = dashboard_id
        self.deleted_by = deleted_by


class DeleteDashboardResponse:
    """Response model for deleting a dashboard."""
    
    def __init__(self, success: bool, message: str):
        self.success = success
        self.message = message


class DeleteDashboardUseCase:
    """Use case for deleting a dashboard."""
    
    def __init__(
        self,
        dashboard_repository: DashboardRepository,
        user_repository: UserRepository,
    ):
        self._dashboard_repository = dashboard_repository
        self._user_repository = user_repository
    
    async def execute(self, request: DeleteDashboardRequest) -> DeleteDashboardResponse:
        """
        Execute the delete dashboard use case.
        
        Args:
            request: Delete dashboard request
            
        Returns:
            DeleteDashboardResponse: Deletion result
            
        Raises:
            EntityNotFound: If dashboard or user is not found
            PermissionDenied: If user doesn't have permission to delete dashboard
        """
        # Get the dashboard
        dashboard = await self._dashboard_repository.get_by_id(request.dashboard_id)
        if not dashboard:
            raise EntityNotFound(
                entity_type="Dashboard",
                entity_id=str(request.dashboard_id.value),
                details={"dashboard_id": str(request.dashboard_id.value)}
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
        if not self._can_delete_dashboard(user, dashboard):
            raise PermissionDenied(
                operation="delete_dashboard",
                resource=f"dashboard_{request.dashboard_id.value}",
                user_id=str(request.deleted_by)
            )
        
        # Delete the dashboard
        success = await self._dashboard_repository.delete(request.dashboard_id)
        
        if success:
            return DeleteDashboardResponse(
                success=True,
                message=f"Dashboard {request.dashboard_id.value} deleted successfully"
            )
        else:
            return DeleteDashboardResponse(
                success=False,
                message=f"Failed to delete dashboard {request.dashboard_id.value}"
            )
    
    def _can_delete_dashboard(self, user: User, dashboard: Dashboard) -> bool:
        """Check if user can delete the dashboard."""
        # Dashboard owner can delete their own dashboards
        if dashboard.user_id == user.id:
            return True
        
        # Admins and CEOs can delete any dashboard
        if user.can_access_admin_panel():
            return True
        
        return False
