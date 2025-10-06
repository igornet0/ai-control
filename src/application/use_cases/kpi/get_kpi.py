"""
Get KPI use case.
Handles the business logic for retrieving KPI information.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID

from src.application.use_cases.base import UseCase
from src.domain.kpi.entities.kpi import KPI, KPIType, KPIStatus
from src.domain.kpi.repositories.kpi_repository import KPIRepository
from src.domain.exceptions import EntityNotFound, BusinessRuleViolation


class GetKPIRequest:
    """Request for getting a KPI."""
    
    def __init__(self, kpi_id: UUID, user_id: UUID):
        self.kpi_id = kpi_id
        self.user_id = user_id


class GetKPIResponse:
    """Response for getting a KPI."""
    
    def __init__(self, kpi: KPI):
        self.kpi = kpi
        self.success = True


class GetKPIsRequest:
    """Request for getting multiple KPIs."""
    
    def __init__(
        self,
        user_id: UUID,
        kpi_type: Optional[KPIType] = None,
        category: Optional[str] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        is_active: Optional[bool] = None,
        search_query: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ):
        self.user_id = user_id
        self.kpi_type = kpi_type
        self.category = category
        self.organization_id = organization_id
        self.department_id = department_id
        self.is_active = is_active
        self.search_query = search_query
        self.filters = filters or {}
        self.limit = limit
        self.offset = offset


class GetKPIsResponse:
    """Response for getting multiple KPIs."""
    
    def __init__(self, kpis: List[KPI], total_count: int):
        self.kpis = kpis
        self.total_count = total_count
        self.success = True


class GetKPIUseCase(UseCase[GetKPIRequest, GetKPIResponse]):
    """Use case for getting a single KPI."""
    
    def __init__(self, kpi_repository: KPIRepository):
        self.kpi_repository = kpi_repository
    
    async def execute(self, request: GetKPIRequest) -> GetKPIResponse:
        """Execute the get KPI use case."""
        try:
            # Get the KPI
            kpi = await self.kpi_repository.get_by_id(request.kpi_id)
            if not kpi:
                raise EntityNotFound("KPI", str(request.kpi_id))
            
            # Check if user can access the KPI
            if not self._can_access_kpi(kpi, request.user_id):
                raise BusinessRuleViolation(
                    f"User {request.user_id} cannot access this KPI",
                    {"user_id": str(request.user_id), "kpi_id": str(request.kpi_id)}
                )
            
            return GetKPIResponse(kpi)
            
        except EntityNotFound as e:
            raise EntityNotFound(e.entity_type, e.entity_id)
        except BusinessRuleViolation as e:
            raise BusinessRuleViolation(e.message, e.details)
        except Exception as e:
            raise Exception(f"Failed to get KPI: {str(e)}")
    
    def _can_access_kpi(self, kpi: KPI, user_id: UUID) -> bool:
        """Check if user can access the KPI."""
        # Creator can always access
        if kpi.created_by == user_id:
            return True
        
        # Add more business logic for organizational permissions
        return True


class GetKPIsUseCase(UseCase[GetKPIsRequest, GetKPIsResponse]):
    """Use case for getting multiple KPIs."""
    
    def __init__(self, kpi_repository: KPIRepository):
        self.kpi_repository = kpi_repository
    
    async def execute(self, request: GetKPIsRequest) -> GetKPIsResponse:
        """Execute the get KPIs use case."""
        try:
            kpis = []
            total_count = 0
            
            # Build filters
            filters = request.filters.copy()
            if request.kpi_type:
                filters["kpi_type"] = request.kpi_type
            if request.category:
                filters["category"] = request.category
            if request.organization_id:
                filters["organization_id"] = request.organization_id
            if request.department_id:
                filters["department_id"] = request.department_id
            if request.is_active is not None:
                filters["is_active"] = request.is_active
            
            # Search or filter KPIs
            if request.search_query:
                kpis = await self.kpi_repository.search_kpis(
                    query=request.search_query,
                    filters=filters,
                    limit=request.limit,
                    offset=request.offset
                )
                total_count = await self.kpi_repository.count_kpis(filters)
            else:
                # Get KPIs based on filters
                if request.kpi_type:
                    kpis = await self.kpi_repository.get_by_type(
                        request.kpi_type, request.limit, request.offset
                    )
                elif request.category:
                    kpis = await self.kpi_repository.get_by_category(
                        request.category, request.limit, request.offset
                    )
                elif request.organization_id:
                    kpis = await self.kpi_repository.get_by_organization(
                        request.organization_id, request.limit, request.offset
                    )
                elif request.department_id:
                    kpis = await self.kpi_repository.get_by_department(
                        request.department_id, request.limit, request.offset
                    )
                elif request.is_active is not None:
                    if request.is_active:
                        kpis = await self.kpi_repository.get_active_kpis(
                            request.limit, request.offset
                        )
                else:
                    # Get user's KPIs
                    kpis = await self.kpi_repository.get_by_creator(
                        request.user_id, request.limit, request.offset
                    )
                
                total_count = await self.kpi_repository.count_kpis(filters)
            
            # Filter KPIs based on user access
            accessible_kpis = []
            for kpi in kpis:
                if self._can_access_kpi(kpi, request.user_id):
                    accessible_kpis.append(kpi)
            
            return GetKPIsResponse(accessible_kpis, total_count)
            
        except Exception as e:
            raise Exception(f"Failed to get KPIs: {str(e)}")
    
    def _can_access_kpi(self, kpi: KPI, user_id: UUID) -> bool:
        """Check if user can access the KPI."""
        # Creator can always access
        if kpi.created_by == user_id:
            return True
        
        # Add more business logic for organizational permissions
        return True
