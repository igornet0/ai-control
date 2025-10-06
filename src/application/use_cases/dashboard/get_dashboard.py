"""
Get dashboard use case.
Handles the business logic for retrieving dashboard information.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID

from src.application.use_cases.base import UseCase
from src.domain.dashboard.entities.dashboard import Dashboard
from src.domain.dashboard.repositories.dashboard_repository import DashboardRepository
from src.domain.exceptions import EntityNotFound, BusinessRuleViolation


class GetDashboardRequest:
    """Request for getting a dashboard."""
    
    def __init__(self, dashboard_id: UUID, user_id: UUID):
        self.dashboard_id = dashboard_id
        self.user_id = user_id


class GetDashboardResponse:
    """Response for getting a dashboard."""
    
    def __init__(self, dashboard: Dashboard):
        self.dashboard = dashboard
        self.success = True


class GetDashboardsRequest:
    """Request for getting multiple dashboards."""
    
    def __init__(
        self,
        user_id: UUID,
        is_public: Optional[bool] = None,
        is_template: Optional[bool] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        search_query: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ):
        self.user_id = user_id
        self.is_public = is_public
        self.is_template = is_template
        self.organization_id = organization_id
        self.department_id = department_id
        self.search_query = search_query
        self.filters = filters or {}
        self.limit = limit
        self.offset = offset


class GetDashboardsResponse:
    """Response for getting multiple dashboards."""
    
    def __init__(self, dashboards: List[Dashboard], total_count: int):
        self.dashboards = dashboards
        self.total_count = total_count
        self.success = True


class GetDashboardUseCase(UseCase[GetDashboardRequest, GetDashboardResponse]):
    """Use case for getting a single dashboard."""
    
    def __init__(self, dashboard_repository: DashboardRepository):
        self.dashboard_repository = dashboard_repository
    
    async def execute(self, request: GetDashboardRequest) -> GetDashboardResponse:
        """Execute the get dashboard use case."""
        try:
            # Get the dashboard
            dashboard = await self.dashboard_repository.get_by_id(request.dashboard_id)
            if not dashboard:
                raise EntityNotFound("Dashboard", str(request.dashboard_id))
            
            # Check if user can access the dashboard
            if not dashboard.can_be_viewed_by(request.user_id):
                raise BusinessRuleViolation(
                    f"User {request.user_id} cannot access this dashboard",
                    {"user_id": str(request.user_id), "dashboard_id": str(request.dashboard_id)}
                )
            
            return GetDashboardResponse(dashboard)
            
        except EntityNotFound as e:
            raise EntityNotFound(e.entity_type, e.entity_id)
        except BusinessRuleViolation as e:
            raise BusinessRuleViolation(e.message, e.details)
        except Exception as e:
            raise Exception(f"Failed to get dashboard: {str(e)}")


class GetDashboardsUseCase(UseCase[GetDashboardsRequest, GetDashboardsResponse]):
    """Use case for getting multiple dashboards."""
    
    def __init__(self, dashboard_repository: DashboardRepository):
        self.dashboard_repository = dashboard_repository
    
    async def execute(self, request: GetDashboardsRequest) -> GetDashboardsResponse:
        """Execute the get dashboards use case."""
        try:
            dashboards = []
            total_count = 0
            
            # Build filters
            filters = request.filters.copy()
            if request.is_public is not None:
                filters["is_public"] = request.is_public
            if request.is_template is not None:
                filters["is_template"] = request.is_template
            if request.organization_id:
                filters["organization_id"] = request.organization_id
            if request.department_id:
                filters["department_id"] = request.department_id
            
            # Search or filter dashboards
            if request.search_query:
                dashboards = await self.dashboard_repository.search_dashboards(
                    query=request.search_query,
                    filters=filters,
                    limit=request.limit,
                    offset=request.offset
                )
                total_count = await self.dashboard_repository.count_dashboards(filters)
            else:
                # Get dashboards based on filters
                if request.is_public:
                    dashboards = await self.dashboard_repository.get_public_dashboards(
                        request.limit, request.offset
                    )
                elif request.is_template:
                    dashboards = await self.dashboard_repository.get_template_dashboards(
                        request.limit, request.offset
                    )
                elif request.organization_id:
                    dashboards = await self.dashboard_repository.get_by_organization(
                        request.organization_id, request.limit, request.offset
                    )
                elif request.department_id:
                    dashboards = await self.dashboard_repository.get_by_department(
                        request.department_id, request.limit, request.offset
                    )
                else:
                    # Get user's dashboards
                    dashboards = await self.dashboard_repository.get_by_user(
                        request.user_id, request.limit, request.offset
                    )
                
                total_count = await self.dashboard_repository.count_dashboards(filters)
            
            # Filter dashboards based on user access
            accessible_dashboards = []
            for dashboard in dashboards:
                if dashboard.can_be_viewed_by(request.user_id):
                    accessible_dashboards.append(dashboard)
            
            return GetDashboardsResponse(accessible_dashboards, total_count)
            
        except Exception as e:
            raise Exception(f"Failed to get dashboards: {str(e)}")
