"""
Organization repository interface.
Defines the contract for organization data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.base import Repository
from src.domain.user_management.entities.organization import Organization


class OrganizationRepository(Repository, ABC):
    """Repository interface for Organization entities."""
    
    @abstractmethod
    async def get_by_domain(self, domain: str) -> Optional[Organization]:
        """Get organization by domain."""
        pass
    
    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[Organization]:
        """Get organization by name."""
        pass
    
    @abstractmethod
    async def search_organizations(
        self,
        query: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Organization]:
        """Search organizations by name or description."""
        pass
    
    @abstractmethod
    async def count_organizations(self) -> int:
        """Count total organizations."""
        pass
    
    @abstractmethod
    async def exists_by_domain(self, domain: str) -> bool:
        """Check if organization exists by domain."""
        pass
    
    @abstractmethod
    async def exists_by_name(self, name: str) -> bool:
        """Check if organization exists by name."""
        pass
    
    @abstractmethod
    async def get_all_organizations(self) -> List[Organization]:
        """Get all organizations."""
        pass
