"""
Dashboard repository interface.
Defines the contract for dashboard data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from uuid import UUID

from src.domain.dashboard.entities.dashboard import Dashboard


class DashboardRepository(ABC):
    """Abstract dashboard repository interface."""
    
    @abstractmethod
    async def create(self, dashboard: Dashboard) -> Dashboard:
        """Create a new dashboard."""
        pass
    
    @abstractmethod
    async def get_by_id(self, dashboard_id: UUID) -> Optional[Dashboard]:
        """Get dashboard by ID."""
        pass
    
    @abstractmethod
    async def update(self, dashboard: Dashboard) -> Dashboard:
        """Update an existing dashboard."""
        pass
    
    @abstractmethod
    async def delete(self, dashboard_id: UUID) -> bool:
        """Delete a dashboard."""
        pass
    
    @abstractmethod
    async def get_by_user(self, user_id: UUID, limit: int = 100, offset: int = 0) -> List[Dashboard]:
        """Get dashboards by user ID."""
        pass
    
    @abstractmethod
    async def get_public_dashboards(self, limit: int = 100, offset: int = 0) -> List[Dashboard]:
        """Get public dashboards."""
        pass
    
    @abstractmethod
    async def get_template_dashboards(self, limit: int = 100, offset: int = 0) -> List[Dashboard]:
        """Get template dashboards."""
        pass
    
    @abstractmethod
    async def get_by_organization(self, organization_id: UUID, limit: int = 100, offset: int = 0) -> List[Dashboard]:
        """Get dashboards by organization ID."""
        pass
    
    @abstractmethod
    async def get_by_department(self, department_id: UUID, limit: int = 100, offset: int = 0) -> List[Dashboard]:
        """Get dashboards by department ID."""
        pass
    
    @abstractmethod
    async def search_dashboards(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dashboard]:
        """Search dashboards by query and filters."""
        pass
    
    @abstractmethod
    async def get_shared_dashboards(self, user_id: UUID, limit: int = 100, offset: int = 0) -> List[Dashboard]:
        """Get dashboards shared with user."""
        pass
    
    @abstractmethod
    async def get_dashboard_statistics(self, user_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Get dashboard statistics for user or globally."""
        pass
    
    @abstractmethod
    async def count_dashboards(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count dashboards matching filters."""
        pass
    
    @abstractmethod
    async def exists(self, dashboard_id: UUID) -> bool:
        """Check if dashboard exists."""
        pass
    
    @abstractmethod
    async def get_dashboard_versions(self, dashboard_id: UUID, limit: int = 100, offset: int = 0) -> List[Dashboard]:
        """Get dashboard versions."""
        pass
    
    @abstractmethod
    async def create_dashboard_version(self, dashboard: Dashboard, version_number: int, created_by: UUID) -> Dashboard:
        """Create a new dashboard version."""
        pass
    
    @abstractmethod
    async def get_dashboard_shares(self, dashboard_id: UUID) -> List[Dict[str, Any]]:
        """Get dashboard shares."""
        pass
    
    @abstractmethod
    async def share_dashboard(
        self,
        dashboard_id: UUID,
        shared_with: UUID,
        permissions: Dict[str, bool],
        shared_by: UUID
    ) -> bool:
        """Share dashboard with user."""
        pass
    
    @abstractmethod
    async def unshare_dashboard(self, dashboard_id: UUID, shared_with: UUID, unshared_by: UUID) -> bool:
        """Unshare dashboard with user."""
        pass
    
    @abstractmethod
    async def update_dashboard_share_permissions(
        self,
        dashboard_id: UUID,
        shared_with: UUID,
        permissions: Dict[str, bool],
        updated_by: UUID
    ) -> bool:
        """Update dashboard share permissions."""
        pass
