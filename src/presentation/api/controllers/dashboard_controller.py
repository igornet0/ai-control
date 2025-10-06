"""
Dashboard API controller.
Handles HTTP requests for dashboard management operations.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from fastapi.responses import JSONResponse

from src.application.use_cases.dashboard.create_dashboard import CreateDashboardUseCase, CreateDashboardRequest
from src.application.use_cases.dashboard.get_dashboard import GetDashboardUseCase, GetDashboardRequest, GetDashboardsUseCase, GetDashboardsRequest
from src.application.dto.dashboard_dto import (
    DashboardCreateDTO,
    DashboardUpdateDTO,
    DashboardResponseDTO,
    DashboardListResponseDTO,
    WidgetCreateDTO,
    WidgetResponseDTO,
    DashboardWidgetCreateDTO,
    DashboardWidgetResponseDTO,
    DashboardShareDTO,
    DashboardShareResponseDTO,
    DashboardVersionResponseDTO,
    DashboardStatisticsDTO,
)
from src.domain.exceptions import EntityNotFound, ValidationError, BusinessRuleViolation
from src.presentation.api.dependencies import get_current_user_id, get_dashboard_use_cases

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.post("/", response_model=DashboardResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    dashboard_data: DashboardCreateDTO,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Create a new dashboard."""
    try:
        create_dashboard_use_case = use_cases["create_dashboard"]
        
        request = CreateDashboardRequest(
            name=dashboard_data.name,
            user_id=current_user_id,
            description=dashboard_data.description,
            theme=dashboard_data.theme,
            is_public=dashboard_data.is_public,
            is_template=dashboard_data.is_template,
            layout_config=dashboard_data.layout_config,
            organization_id=dashboard_data.organization_id,
            department_id=dashboard_data.department_id,
        )
        
        response = await create_dashboard_use_case.execute(request)
        return DashboardResponseDTO.from_orm(response.dashboard)
        
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
            detail=f"Failed to create dashboard: {str(e)}"
        )


@router.get("/{dashboard_id}", response_model=DashboardResponseDTO)
async def get_dashboard(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Get a dashboard by ID."""
    try:
        get_dashboard_use_case = use_cases["get_dashboard"]
        
        request = GetDashboardRequest(dashboard_id=dashboard_id, user_id=current_user_id)
        response = await get_dashboard_use_case.execute(request)
        
        return DashboardResponseDTO.from_orm(response.dashboard)
        
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
            detail=f"Failed to get dashboard: {str(e)}"
        )


@router.get("/", response_model=DashboardListResponseDTO)
async def get_dashboards(
    is_public: Optional[bool] = Query(default=None, description="Filter by public status"),
    is_template: Optional[bool] = Query(default=None, description="Filter by template status"),
    organization_id: Optional[UUID] = Query(default=None, description="Filter by organization ID"),
    department_id: Optional[UUID] = Query(default=None, description="Filter by department ID"),
    search_query: Optional[str] = Query(default=None, description="Search query"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Get dashboards with optional filters."""
    try:
        get_dashboards_use_case = use_cases["get_dashboards"]
        
        request = GetDashboardsRequest(
            user_id=current_user_id,
            is_public=is_public,
            is_template=is_template,
            organization_id=organization_id,
            department_id=department_id,
            search_query=search_query,
            limit=limit,
            offset=offset,
        )
        
        response = await get_dashboards_use_case.execute(request)
        
        return DashboardListResponseDTO(
            dashboards=[DashboardResponseDTO.from_orm(dashboard) for dashboard in response.dashboards],
            total_count=response.total_count,
            limit=limit,
            offset=offset,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboards: {str(e)}"
        )


@router.put("/{dashboard_id}", response_model=DashboardResponseDTO)
async def update_dashboard(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    dashboard_data: DashboardUpdateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Update a dashboard."""
    try:
        # TODO: Implement update dashboard use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Update dashboard functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update dashboard: {str(e)}"
        )


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Delete a dashboard."""
    try:
        # TODO: Implement delete dashboard use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Delete dashboard functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete dashboard: {str(e)}"
        )


@router.get("/{dashboard_id}/statistics", response_model=DashboardStatisticsDTO)
async def get_dashboard_statistics(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Get dashboard statistics."""
    try:
        # TODO: Implement dashboard statistics use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Dashboard statistics functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard statistics: {str(e)}"
        )


# Dashboard Widgets endpoints
@router.post("/{dashboard_id}/widgets", response_model=DashboardWidgetResponseDTO, status_code=status.HTTP_201_CREATED)
async def add_dashboard_widget(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    widget_data: DashboardWidgetCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Add a widget to a dashboard."""
    try:
        # TODO: Implement add dashboard widget use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Add dashboard widget functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add dashboard widget: {str(e)}"
        )


@router.get("/{dashboard_id}/widgets", response_model=List[DashboardWidgetResponseDTO])
async def get_dashboard_widgets(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Get widgets for a dashboard."""
    try:
        # TODO: Implement get dashboard widgets use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get dashboard widgets functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard widgets: {str(e)}"
        )


@router.put("/{dashboard_id}/widgets/{widget_id}", response_model=DashboardWidgetResponseDTO)
async def update_dashboard_widget(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    widget_id: UUID = Path(..., description="Widget ID"),
    widget_data: DashboardWidgetCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Update a dashboard widget."""
    try:
        # TODO: Implement update dashboard widget use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Update dashboard widget functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update dashboard widget: {str(e)}"
        )


@router.delete("/{dashboard_id}/widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_dashboard_widget(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    widget_id: UUID = Path(..., description="Widget ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Remove a widget from a dashboard."""
    try:
        # TODO: Implement remove dashboard widget use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Remove dashboard widget functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove dashboard widget: {str(e)}"
        )


# Dashboard Sharing endpoints
@router.post("/{dashboard_id}/share", response_model=DashboardShareResponseDTO, status_code=status.HTTP_201_CREATED)
async def share_dashboard(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    share_data: DashboardShareDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Share a dashboard with a user."""
    try:
        # TODO: Implement share dashboard use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Share dashboard functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to share dashboard: {str(e)}"
        )


@router.get("/{dashboard_id}/shares", response_model=List[DashboardShareResponseDTO])
async def get_dashboard_shares(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Get dashboard shares."""
    try:
        # TODO: Implement get dashboard shares use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get dashboard shares functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard shares: {str(e)}"
        )


@router.delete("/{dashboard_id}/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unshare_dashboard(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    share_id: UUID = Path(..., description="Share ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Unshare a dashboard."""
    try:
        # TODO: Implement unshare dashboard use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Unshare dashboard functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unshare dashboard: {str(e)}"
        )


# Dashboard Versions endpoints
@router.get("/{dashboard_id}/versions", response_model=List[DashboardVersionResponseDTO])
async def get_dashboard_versions(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Get dashboard versions."""
    try:
        # TODO: Implement get dashboard versions use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get dashboard versions functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard versions: {str(e)}"
        )


@router.post("/{dashboard_id}/versions", response_model=DashboardVersionResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_dashboard_version(
    dashboard_id: UUID = Path(..., description="Dashboard ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Create a new dashboard version."""
    try:
        # TODO: Implement create dashboard version use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create dashboard version functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create dashboard version: {str(e)}"
        )


# Widget Templates endpoints
@router.post("/widgets", response_model=WidgetResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_widget(
    widget_data: WidgetCreateDTO,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Create a new widget template."""
    try:
        # TODO: Implement create widget use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create widget functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create widget: {str(e)}"
        )


@router.get("/widgets", response_model=List[WidgetResponseDTO])
async def get_widgets(
    widget_type: Optional[str] = Query(default=None, description="Filter by widget type"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    is_active: Optional[bool] = Query(default=None, description="Filter by active status"),
    is_system: Optional[bool] = Query(default=None, description="Filter by system status"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_dashboard_use_cases),
):
    """Get widget templates."""
    try:
        # TODO: Implement get widgets use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get widgets functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get widgets: {str(e)}"
        )
