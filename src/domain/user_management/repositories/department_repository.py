"""
Department repository interface.
Defines the contract for department data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.base import Repository
from src.domain.user_management.entities.department import Department


class DepartmentRepository(Repository, ABC):
    """Repository interface for Department entities."""
    
    @abstractmethod
    async def get_by_organization(self, organization_id: UUID) -> List[Department]:
        """Get all departments in an organization."""
        pass
    
    @abstractmethod
    async def get_by_manager(self, manager_id: UUID) -> List[Department]:
        """Get departments managed by a specific manager."""
        pass
    
    @abstractmethod
    async def get_by_name_and_organization(
        self,
        name: str,
        organization_id: UUID,
    ) -> Optional[Department]:
        """Get department by name within an organization."""
        pass
    
    @abstractmethod
    async def search_departments(
        self,
        query: str,
        organization_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Department]:
        """Search departments with filters."""
        pass
    
    @abstractmethod
    async def count_departments(
        self,
        organization_id: Optional[UUID] = None,
    ) -> int:
        """Count departments with filters."""
        pass
    
    @abstractmethod
    async def exists_by_name_and_organization(
        self,
        name: str,
        organization_id: UUID,
    ) -> bool:
        """Check if department exists by name within organization."""
        pass
    
    @abstractmethod
    async def get_departments_without_manager(
        self,
        organization_id: Optional[UUID] = None,
    ) -> List[Department]:
        """Get departments without a manager."""
        pass
