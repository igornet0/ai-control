"""
KPI API controller.
Handles HTTP requests for KPI management operations.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from fastapi.responses import JSONResponse

from src.application.use_cases.kpi.create_kpi import CreateKPIUseCase, CreateKPIRequest
from src.application.use_cases.kpi.get_kpi import GetKPIUseCase, GetKPIRequest, GetKPIsUseCase, GetKPIsRequest
from src.application.dto.kpi_dto import (
    KPICreateDTO,
    KPIUpdateDTO,
    KPIResponseDTO,
    KPIListResponseDTO,
    KPICalculationCreateDTO,
    KPICalculationResponseDTO,
    KPIStatisticsDTO,
    KPICalculationStatisticsDTO,
)
from src.domain.kpi.entities.kpi import KPIType, KPIStatus
from src.domain.exceptions import EntityNotFound, ValidationError, BusinessRuleViolation
from src.presentation.api.dependencies import get_current_user_id, get_kpi_use_cases

router = APIRouter(prefix="/kpis", tags=["kpis"])


@router.post("/", response_model=KPIResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_kpi(
    kpi_data: KPICreateDTO,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Create a new KPI."""
    try:
        create_kpi_use_case = use_cases["create_kpi"]
        
        request = CreateKPIRequest(
            name=kpi_data.name,
            formula=kpi_data.formula,
            data_source=kpi_data.data_source,
            created_by=current_user_id,
            description=kpi_data.description,
            target_value=kpi_data.target_value,
            previous_period_days=kpi_data.previous_period_days,
            refresh_interval=kpi_data.refresh_interval,
            category=kpi_data.category,
            unit=kpi_data.unit,
            kpi_type=kpi_data.kpi_type,
            organization_id=kpi_data.organization_id,
            department_id=kpi_data.department_id,
        )
        
        response = await create_kpi_use_case.execute(request)
        return KPIResponseDTO.from_orm(response.kpi)
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {e.reason}"
        )
    except BusinessRuleViolation as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Business rule violation: {e.message}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create KPI: {str(e)}"
        )


@router.get("/{kpi_id}", response_model=KPIResponseDTO)
async def get_kpi(
    kpi_id: UUID = Path(..., description="KPI ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get a KPI by ID."""
    try:
        get_kpi_use_case = use_cases["get_kpi"]
        
        request = GetKPIRequest(kpi_id=kpi_id, user_id=current_user_id)
        response = await get_kpi_use_case.execute(request)
        
        return KPIResponseDTO.from_orm(response.kpi)
        
    except EntityNotFound as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{e.entity_type} not found: {e.entity_id}"
        )
    except BusinessRuleViolation as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {e.message}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KPI: {str(e)}"
        )


@router.get("/", response_model=KPIListResponseDTO)
async def get_kpis(
    kpi_type: Optional[KPIType] = Query(default=None, description="Filter by KPI type"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    organization_id: Optional[UUID] = Query(default=None, description="Filter by organization ID"),
    department_id: Optional[UUID] = Query(default=None, description="Filter by department ID"),
    is_active: Optional[bool] = Query(default=None, description="Filter by active status"),
    search_query: Optional[str] = Query(default=None, description="Search query"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get KPIs with optional filters."""
    try:
        get_kpis_use_case = use_cases["get_kpis"]
        
        request = GetKPIsRequest(
            user_id=current_user_id,
            kpi_type=kpi_type,
            category=category,
            organization_id=organization_id,
            department_id=department_id,
            is_active=is_active,
            search_query=search_query,
            limit=limit,
            offset=offset,
        )
        
        response = await get_kpis_use_case.execute(request)
        
        return KPIListResponseDTO(
            kpis=[KPIResponseDTO.from_orm(kpi) for kpi in response.kpis],
            total_count=response.total_count,
            limit=limit,
            offset=offset,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KPIs: {str(e)}"
        )


@router.put("/{kpi_id}", response_model=KPIResponseDTO)
async def update_kpi(
    kpi_id: UUID = Path(..., description="KPI ID"),
    kpi_data: KPIUpdateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Update a KPI."""
    try:
        # TODO: Implement update KPI use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Update KPI functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update KPI: {str(e)}"
        )


@router.delete("/{kpi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kpi(
    kpi_id: UUID = Path(..., description="KPI ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Delete a KPI."""
    try:
        # TODO: Implement delete KPI use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Delete KPI functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete KPI: {str(e)}"
        )


@router.get("/{kpi_id}/statistics", response_model=KPIStatisticsDTO)
async def get_kpi_statistics(
    kpi_id: UUID = Path(..., description="KPI ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get KPI statistics."""
    try:
        # TODO: Implement KPI statistics use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="KPI statistics functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KPI statistics: {str(e)}"
        )


# KPI Calculations endpoints
@router.post("/{kpi_id}/calculations", response_model=KPICalculationResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_kpi_calculation(
    kpi_id: UUID = Path(..., description="KPI ID"),
    calculation_data: KPICalculationCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Create a KPI calculation."""
    try:
        # TODO: Implement create KPI calculation use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create KPI calculation functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create KPI calculation: {str(e)}"
        )


@router.get("/{kpi_id}/calculations", response_model=List[KPICalculationResponseDTO])
async def get_kpi_calculations(
    kpi_id: UUID = Path(..., description="KPI ID"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get KPI calculations."""
    try:
        # TODO: Implement get KPI calculations use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get KPI calculations functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KPI calculations: {str(e)}"
        )


@router.get("/{kpi_id}/calculations/latest", response_model=KPICalculationResponseDTO)
async def get_latest_kpi_calculation(
    kpi_id: UUID = Path(..., description="KPI ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get latest KPI calculation."""
    try:
        # TODO: Implement get latest KPI calculation use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get latest KPI calculation functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get latest KPI calculation: {str(e)}"
        )


@router.get("/{kpi_id}/calculations/statistics", response_model=KPICalculationStatisticsDTO)
async def get_kpi_calculation_statistics(
    kpi_id: UUID = Path(..., description="KPI ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get KPI calculation statistics."""
    try:
        # TODO: Implement KPI calculation statistics use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="KPI calculation statistics functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KPI calculation statistics: {str(e)}"
        )


# KPI Templates endpoints
@router.get("/templates", response_model=List[Dict[str, Any]])
async def get_kpi_templates(
    category: Optional[str] = Query(default=None, description="Filter by category"),
    kpi_type: Optional[KPIType] = Query(default=None, description="Filter by KPI type"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get KPI templates."""
    try:
        # TODO: Implement get KPI templates use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get KPI templates functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KPI templates: {str(e)}"
        )


# KPI Schedules endpoints
@router.get("/{kpi_id}/schedules", response_model=List[Dict[str, Any]])
async def get_kpi_schedules(
    kpi_id: UUID = Path(..., description="KPI ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Get KPI schedules."""
    try:
        # TODO: Implement get KPI schedules use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get KPI schedules functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get KPI schedules: {str(e)}"
        )


@router.post("/{kpi_id}/schedules", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_kpi_schedule(
    kpi_id: UUID = Path(..., description="KPI ID"),
    schedule_data: Dict[str, Any] = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_kpi_use_cases),
):
    """Create a KPI schedule."""
    try:
        # TODO: Implement create KPI schedule use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create KPI schedule functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create KPI schedule: {str(e)}"
        )
