"""
User repository interface.
Defines the contract for user data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.base import Repository
from src.domain.user_management.entities.user import User, UserRole, UserStatus


class UserRepository(Repository, ABC):
    """Repository interface for User entities."""
    
    @abstractmethod
    async def get_by_login(self, login: str) -> Optional[User]:
        """Get user by login."""
        pass
    
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        pass
    
    @abstractmethod
    async def get_by_organization(self, organization_id: UUID) -> List[User]:
        """Get all users in an organization."""
        pass
    
    @abstractmethod
    async def get_by_department(self, department_id: UUID) -> List[User]:
        """Get all users in a department."""
        pass
    
    @abstractmethod
    async def get_by_manager(self, manager_id: UUID) -> List[User]:
        """Get all users managed by a specific manager."""
        pass
    
    @abstractmethod
    async def get_by_role(self, role: UserRole) -> List[User]:
        """Get all users with a specific role."""
        pass
    
    @abstractmethod
    async def get_by_status(self, status: UserStatus) -> List[User]:
        """Get all users with a specific status."""
        pass
    
    @abstractmethod
    async def search_users(
        self,
        query: str,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[User]:
        """Search users with filters."""
        pass
    
    @abstractmethod
    async def count_users(
        self,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
    ) -> int:
        """Count users with filters."""
        pass
    
    @abstractmethod
    async def exists_by_login(self, login: str) -> bool:
        """Check if user exists by login."""
        pass
    
    @abstractmethod
    async def exists_by_email(self, email: str) -> bool:
        """Check if user exists by email."""
        pass
    
    @abstractmethod
    async def get_user_hierarchy(self, user_id: UUID) -> List[User]:
        """Get user hierarchy (manager and all subordinates)."""
        pass
    
    @abstractmethod
    async def get_active_users(self, organization_id: Optional[UUID] = None) -> List[User]:
        """Get all active users."""
        pass
    
    @abstractmethod
    async def get_recently_logged_in_users(self, days: int = 7) -> List[User]:
        """Get users who logged in recently."""
        pass
