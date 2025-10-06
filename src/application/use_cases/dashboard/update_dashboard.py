"""
Update Dashboard use case.
Handles the business logic for updating a dashboard.
"""

from typing import Optional, Dict, Any
from uuid import UUID

from src.domain.exceptions import EntityNotFound, PermissionDenied, ValidationError
from src.domain.dashboard.entities.dashboard import Dashboard
from src.domain.dashboard.repositories.dashboard_repository import DashboardRepository
from src.domain.dashboard.value_objects.dashboard_id import DashboardId
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository


class UpdateDashboardRequest:
    """Request model for updating a dashboard."""
    
    def __init__(
        self,
        dashboard_id: DashboardId,
        updated_by: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_public: Optional[bool] = None,
        layout: Optional[Dict[str, Any]] = None,
    ):
        self.dashboard_id = dashboard_id
        self.updated_by = updated_by
        self.name = name
        self.description = description
        self.is_public = is_public
        self.layout = layout


class UpdateDashboardResponse:
    """Response model for updating a dashboard."""
    
    def __init__(self, dashboard: Dashboard):
        self.dashboard_id = dashboard.id
        self.name = dashboard.name
        self.description = dashboard.description
        self.is_public = dashboard.is_public
        self.layout = dashboard.layout
        self.updated_at = dashboard.updated_at


class UpdateDashboardUseCase:
    """Use case for updating a dashboard."""
    
    def __init__(
        self,
        dashboard_repository: DashboardRepository,
        user_repository: UserRepository,
    ):
        self._dashboard_repository = dashboard_repository
        self._user_repository = user_repository
    
    async def execute(self, request: UpdateDashboardRequest) -> UpdateDashboardResponse:
        """
        Execute the update dashboard use case.
        
        Args:
            request: Update dashboard request
            
        Returns:
            UpdateDashboardResponse: Updated dashboard information
            
        Raises:
            EntityNotFound: If dashboard or user is not found
            PermissionDenied: If user doesn't have permission to update dashboard
            ValidationError: If validation fails
        """
        # Get the dashboard
        dashboard = await self._dashboard_repository.get_by_id(request.dashboard_id)
        if not dashboard:
            raise EntityNotFound(
                entity_type="Dashboard",
                entity_id=str(request.dashboard_id.value),
                details={"dashboard_id": str(request.dashboard_id.value)}
            )
        
        # Get the user who is updating
        user = await self._user_repository.get_by_id(request.updated_by)
        if not user:
            raise EntityNotFound(
                entity_type="User",
                entity_id=str(request.updated_by),
                details={"user_id": str(request.updated_by)}
            )
        
        # Check permissions
        if not self._can_update_dashboard(user, dashboard):
            raise PermissionDenied(
                operation="update_dashboard",
                resource=f"dashboard_{request.dashboard_id.value}",
                user_id=str(request.updated_by)
            )
        
        # Validate input
        self._validate_request(request)
        
        # Update dashboard fields
        if request.name is not None:
            dashboard.name = request.name
        
        if request.description is not None:
            dashboard.description = request.description
        
        if request.is_public is not None:
            dashboard.is_public = request.is_public
        
        if request.layout is not None:
            dashboard.layout = request.layout
        
        # Mark as updated
        dashboard.mark_as_updated()
        
        # Save the updated dashboard
        updated_dashboard = await self._dashboard_repository.save(dashboard)
        
        return UpdateDashboardResponse(updated_dashboard)
    
    def _can_update_dashboard(self, user: User, dashboard: Dashboard) -> bool:
        """Check if user can update the dashboard."""
        # Dashboard owner can update their own dashboards
        if dashboard.user_id == user.id:
            return True
        
        # Admins and CEOs can update any dashboard
        if user.can_access_admin_panel():
            return True
        
        return False
    
    def _validate_request(self, request: UpdateDashboardRequest) -> None:
        """Validate the update request."""
        if request.name is not None:
            if not request.name.strip():
                raise ValidationError(
                    field="name",
                    value=request.name,
                    reason="Dashboard name cannot be empty"
                )
            
            if len(request.name) > 255:
                raise ValidationError(
                    field="name",
                    value=request.name,
                    reason="Dashboard name cannot exceed 255 characters"
                )
        
        if request.description is not None and len(request.description) > 1000:
            raise ValidationError(
                field="description",
                value=request.description,
                reason="Dashboard description cannot exceed 1000 characters"
            )
