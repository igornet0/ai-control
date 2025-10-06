"""
Update KPI use case.
Handles the business logic for updating a KPI.
"""

from typing import Optional
from uuid import UUID

from src.domain.exceptions import EntityNotFound, PermissionDenied, ValidationError
from src.domain.kpi.entities.kpi import KPI
from src.domain.kpi.repositories.kpi_repository import KPIRepository
from src.domain.kpi.value_objects.kpi_id import KPIId
from src.domain.kpi.value_objects.kpi_type import KPIType
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository


class UpdateKPIRequest:
    """Request model for updating a KPI."""
    
    def __init__(
        self,
        kpi_id: KPIId,
        updated_by: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        kpi_type: Optional[KPIType] = None,
        target_value: Optional[float] = None,
        current_value: Optional[float] = None,
        unit: Optional[str] = None,
        is_public: Optional[bool] = None,
        calculation_formula: Optional[str] = None,
        data_source: Optional[str] = None,
    ):
        self.kpi_id = kpi_id
        self.updated_by = updated_by
        self.name = name
        self.description = description
        self.kpi_type = kpi_type
        self.target_value = target_value
        self.current_value = current_value
        self.unit = unit
        self.is_public = is_public
        self.calculation_formula = calculation_formula
        self.data_source = data_source


class UpdateKPIResponse:
    """Response model for updating a KPI."""
    
    def __init__(self, kpi: KPI):
        self.kpi_id = kpi.id
        self.name = kpi.name
        self.description = kpi.description
        self.kpi_type = kpi.kpi_type
        self.target_value = kpi.target_value
        self.current_value = kpi.current_value
        self.unit = kpi.unit
        self.is_public = kpi.is_public
        self.calculation_formula = kpi.calculation_formula
        self.data_source = kpi.data_source
        self.updated_at = kpi.updated_at


class UpdateKPIUseCase:
    """Use case for updating a KPI."""
    
    def __init__(
        self,
        kpi_repository: KPIRepository,
        user_repository: UserRepository,
    ):
        self._kpi_repository = kpi_repository
        self._user_repository = user_repository
    
    async def execute(self, request: UpdateKPIRequest) -> UpdateKPIResponse:
        """
        Execute the update KPI use case.
        
        Args:
            request: Update KPI request
            
        Returns:
            UpdateKPIResponse: Updated KPI information
            
        Raises:
            EntityNotFound: If KPI or user is not found
            PermissionDenied: If user doesn't have permission to update KPI
            ValidationError: If validation fails
        """
        # Get the KPI
        kpi = await self._kpi_repository.get_by_id(request.kpi_id)
        if not kpi:
            raise EntityNotFound(
                entity_type="KPI",
                entity_id=str(request.kpi_id.value),
                details={"kpi_id": str(request.kpi_id.value)}
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
        if not self._can_update_kpi(user, kpi):
            raise PermissionDenied(
                operation="update_kpi",
                resource=f"kpi_{request.kpi_id.value}",
                user_id=str(request.updated_by)
            )
        
        # Validate input
        self._validate_request(request)
        
        # Update KPI fields
        if request.name is not None:
            kpi.name = request.name
        
        if request.description is not None:
            kpi.description = request.description
        
        if request.kpi_type is not None:
            kpi.kpi_type = request.kpi_type
        
        if request.target_value is not None:
            kpi.target_value = request.target_value
        
        if request.current_value is not None:
            kpi.current_value = request.current_value
        
        if request.unit is not None:
            kpi.unit = request.unit
        
        if request.is_public is not None:
            kpi.is_public = request.is_public
        
        if request.calculation_formula is not None:
            kpi.calculation_formula = request.calculation_formula
        
        if request.data_source is not None:
            kpi.data_source = request.data_source
        
        # Mark as updated
        kpi.mark_as_updated()
        
        # Save the updated KPI
        updated_kpi = await self._kpi_repository.save(kpi)
        
        return UpdateKPIResponse(updated_kpi)
    
    def _can_update_kpi(self, user: User, kpi: KPI) -> bool:
        """Check if user can update the KPI."""
        # KPI owner can update their own KPIs
        if kpi.user_id == user.id:
            return True
        
        # Admins and CEOs can update any KPI
        if user.can_access_admin_panel():
            return True
        
        return False
    
    def _validate_request(self, request: UpdateKPIRequest) -> None:
        """Validate the update request."""
        if request.name is not None:
            if not request.name.strip():
                raise ValidationError(
                    field="name",
                    value=request.name,
                    reason="KPI name cannot be empty"
                )
            
            if len(request.name) > 255:
                raise ValidationError(
                    field="name",
                    value=request.name,
                    reason="KPI name cannot exceed 255 characters"
                )
        
        if request.description is not None and len(request.description) > 1000:
            raise ValidationError(
                field="description",
                value=request.description,
                reason="KPI description cannot exceed 1000 characters"
            )
        
        if request.target_value is not None and request.target_value < 0:
            raise ValidationError(
                field="target_value",
                value=request.target_value,
                reason="Target value cannot be negative"
            )
        
        if request.current_value is not None and request.current_value < 0:
            raise ValidationError(
                field="current_value",
                value=request.current_value,
                reason="Current value cannot be negative"
            )
        
        if request.unit is not None and len(request.unit) > 50:
            raise ValidationError(
                field="unit",
                value=request.unit,
                reason="Unit cannot exceed 50 characters"
            )
