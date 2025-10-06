"""
Create dashboard use case.
Handles the business logic for creating a new dashboard.
"""

from typing import Optional, Dict, Any
from uuid import UUID

from src.application.use_cases.base import UseCase
from src.domain.dashboard.entities.dashboard import Dashboard
from src.domain.dashboard.repositories.dashboard_repository import DashboardRepository
from src.domain.exceptions import ValidationError, BusinessRuleViolation


class CreateDashboardRequest:
    """Request for creating a dashboard."""
    
    def __init__(
        self,
        name: str,
        user_id: UUID,
        description: Optional[str] = None,
        theme: str = "default",
        is_public: bool = False,
        is_template: bool = False,
        layout_config: Optional[Dict[str, Any]] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
    ):
        self.name = name
        self.user_id = user_id
        self.description = description
        self.theme = theme
        self.is_public = is_public
        self.is_template = is_template
        self.layout_config = layout_config
        self.organization_id = organization_id
        self.department_id = department_id


class CreateDashboardResponse:
    """Response for creating a dashboard."""
    
    def __init__(self, dashboard: Dashboard):
        self.dashboard = dashboard
        self.success = True
        self.message = "Dashboard created successfully"


class CreateDashboardUseCase(UseCase[CreateDashboardRequest, CreateDashboardResponse]):
    """Use case for creating a dashboard."""
    
    def __init__(self, dashboard_repository: DashboardRepository):
        self.dashboard_repository = dashboard_repository
    
    async def execute(self, request: CreateDashboardRequest) -> CreateDashboardResponse:
        """Execute the create dashboard use case."""
        try:
            # Create the dashboard entity
            dashboard = Dashboard.create(
                name=request.name,
                user_id=request.user_id,
                description=request.description,
                theme=request.theme,
                is_public=request.is_public,
                is_template=request.is_template,
                layout_config=request.layout_config,
                organization_id=request.organization_id,
                department_id=request.department_id,
            )
            
            # Save the dashboard
            created_dashboard = await self.dashboard_repository.create(dashboard)
            
            return CreateDashboardResponse(created_dashboard)
            
        except ValidationError as e:
            raise ValidationError(
                field=e.field,
                value=e.value,
                reason=e.reason
            )
        except BusinessRuleViolation as e:
            raise BusinessRuleViolation(e.message, e.details)
        except Exception as e:
            raise Exception(f"Failed to create dashboard: {str(e)}")
