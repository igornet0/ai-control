"""
Create KPI use case.
Handles the business logic for creating a new KPI.
"""

from typing import Optional, Dict, Any
from uuid import UUID

from src.application.use_cases.base import UseCase
from src.domain.kpi.entities.kpi import KPI, KPIType
from src.domain.kpi.repositories.kpi_repository import KPIRepository
from src.domain.exceptions import ValidationError, BusinessRuleViolation


class CreateKPIRequest:
    """Request for creating a KPI."""
    
    def __init__(
        self,
        name: str,
        formula: str,
        data_source: Dict[str, Any],
        created_by: UUID,
        description: Optional[str] = None,
        target_value: Optional[float] = None,
        previous_period_days: int = 30,
        refresh_interval: int = 3600,
        category: str = "general",
        unit: Optional[str] = None,
        kpi_type: KPIType = KPIType.NUMERIC,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
    ):
        self.name = name
        self.formula = formula
        self.data_source = data_source
        self.created_by = created_by
        self.description = description
        self.target_value = target_value
        self.previous_period_days = previous_period_days
        self.refresh_interval = refresh_interval
        self.category = category
        self.unit = unit
        self.kpi_type = kpi_type
        self.organization_id = organization_id
        self.department_id = department_id


class CreateKPIResponse:
    """Response for creating a KPI."""
    
    def __init__(self, kpi: KPI):
        self.kpi = kpi
        self.success = True
        self.message = "KPI created successfully"


class CreateKPIUseCase(UseCase[CreateKPIRequest, CreateKPIResponse]):
    """Use case for creating a KPI."""
    
    def __init__(self, kpi_repository: KPIRepository):
        self.kpi_repository = kpi_repository
    
    async def execute(self, request: CreateKPIRequest) -> CreateKPIResponse:
        """Execute the create KPI use case."""
        try:
            # Create the KPI entity
            kpi = KPI.create(
                name=request.name,
                formula=request.formula,
                data_source=request.data_source,
                created_by=request.created_by,
                description=request.description,
                target_value=request.target_value,
                previous_period_days=request.previous_period_days,
                refresh_interval=request.refresh_interval,
                category=request.category,
                unit=request.unit,
                kpi_type=request.kpi_type,
                organization_id=request.organization_id,
                department_id=request.department_id,
            )
            
            # Save the KPI
            created_kpi = await self.kpi_repository.create(kpi)
            
            return CreateKPIResponse(created_kpi)
            
        except ValidationError as e:
            raise ValidationError(
                field=e.field,
                value=e.value,
                reason=e.reason
            )
        except BusinessRuleViolation as e:
            raise BusinessRuleViolation(e.message, e.details)
        except Exception as e:
            raise Exception(f"Failed to create KPI: {str(e)}")
