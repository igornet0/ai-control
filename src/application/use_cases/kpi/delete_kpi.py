"""
Delete KPI use case.
Handles the business logic for deleting a KPI.
"""

from uuid import UUID

from src.domain.exceptions import EntityNotFound, PermissionDenied
from src.domain.kpi.entities.kpi import KPI
from src.domain.kpi.repositories.kpi_repository import KPIRepository
from src.domain.kpi.value_objects.kpi_id import KPIId
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository


class DeleteKPIRequest:
    """Request model for deleting a KPI."""
    
    def __init__(self, kpi_id: KPIId, deleted_by: UUID):
        self.kpi_id = kpi_id
        self.deleted_by = deleted_by


class DeleteKPIResponse:
    """Response model for deleting a KPI."""
    
    def __init__(self, success: bool, message: str):
        self.success = success
        self.message = message


class DeleteKPIUseCase:
    """Use case for deleting a KPI."""
    
    def __init__(
        self,
        kpi_repository: KPIRepository,
        user_repository: UserRepository,
    ):
        self._kpi_repository = kpi_repository
        self._user_repository = user_repository
    
    async def execute(self, request: DeleteKPIRequest) -> DeleteKPIResponse:
        """
        Execute the delete KPI use case.
        
        Args:
            request: Delete KPI request
            
        Returns:
            DeleteKPIResponse: Deletion result
            
        Raises:
            EntityNotFound: If KPI or user is not found
            PermissionDenied: If user doesn't have permission to delete KPI
        """
        # Get the KPI
        kpi = await self._kpi_repository.get_by_id(request.kpi_id)
        if not kpi:
            raise EntityNotFound(
                entity_type="KPI",
                entity_id=str(request.kpi_id.value),
                details={"kpi_id": str(request.kpi_id.value)}
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
        if not self._can_delete_kpi(user, kpi):
            raise PermissionDenied(
                operation="delete_kpi",
                resource=f"kpi_{request.kpi_id.value}",
                user_id=str(request.deleted_by)
            )
        
        # Delete the KPI
        success = await self._kpi_repository.delete(request.kpi_id)
        
        if success:
            return DeleteKPIResponse(
                success=True,
                message=f"KPI {request.kpi_id.value} deleted successfully"
            )
        else:
            return DeleteKPIResponse(
                success=False,
                message=f"Failed to delete KPI {request.kpi_id.value}"
            )
    
    def _can_delete_kpi(self, user: User, kpi: KPI) -> bool:
        """Check if user can delete the KPI."""
        # KPI owner can delete their own KPIs
        if kpi.user_id == user.id:
            return True
        
        # Admins and CEOs can delete any KPI
        if user.can_access_admin_panel():
            return True
        
        return False
