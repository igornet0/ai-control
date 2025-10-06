"""
User hierarchy domain service.
Handles complex business logic related to user hierarchy and organizational structure.
"""

from typing import List, Set
from uuid import UUID

from src.domain.base import DomainService
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.exceptions import BusinessRuleViolation


class UserHierarchyService(DomainService):
    """Domain service for user hierarchy operations."""
    
    def __init__(self, user_repository: UserRepository):
        self._user_repository = user_repository
    
    async def execute(self, *args, **kwargs) -> any:
        """Execute the domain service."""
        pass
    
    async def get_user_subordinates(self, manager_id: UserId) -> List[User]:
        """Get all subordinates of a manager (direct and indirect)."""
        subordinates = []
        visited = set()
        
        # Get direct subordinates
        direct_subordinates = await self._get_direct_subordinates(manager_id)
        
        # Recursively get indirect subordinates
        for subordinate in direct_subordinates:
            if subordinate.id not in visited:
                visited.add(subordinate.id)
                subordinates.append(subordinate)
                
                # Get subordinates of this subordinate
                indirect_subordinates = await self.get_user_subordinates(subordinate.id)
                subordinates.extend(indirect_subordinates)
        
        return subordinates
    
    async def get_user_managers(self, user_id: UserId) -> List[User]:
        """Get all managers of a user (direct and indirect)."""
        managers = []
        visited = set()
        
        user = await self._user_repository.get_by_id(user_id)
        if not user or not user.manager_id:
            return managers
        
        current_manager_id = user.manager_id
        
        while current_manager_id and current_manager_id not in visited:
            visited.add(current_manager_id)
            manager = await self._user_repository.get_by_id(current_manager_id)
            
            if manager:
                managers.append(manager)
                current_manager_id = manager.manager_id
            else:
                break
        
        return managers
    
    async def validate_hierarchy_assignment(
        self,
        user_id: UserId,
        new_manager_id: UserId
    ) -> bool:
        """Validate if a user can be assigned to a manager."""
        # Check if user is trying to be their own manager
        if user_id == new_manager_id:
            raise BusinessRuleViolation(
                "User cannot be their own manager",
                {"user_id": str(user_id.value), "manager_id": str(new_manager_id.value)}
            )
        
        # Check if new manager exists
        new_manager = await self._user_repository.get_by_id(new_manager_id)
        if not new_manager:
            raise BusinessRuleViolation(
                "Manager does not exist",
                {"manager_id": str(new_manager_id.value)}
            )
        
        # Check if new manager can manage users
        if not new_manager.can_manage_users():
            raise BusinessRuleViolation(
                "User cannot be a manager",
                {"manager_id": str(new_manager_id.value), "role": new_manager.role.value}
            )
        
        # Check for circular hierarchy
        if await self._would_create_circular_hierarchy(user_id, new_manager_id):
            raise BusinessRuleViolation(
                "Assignment would create circular hierarchy",
                {"user_id": str(user_id.value), "manager_id": str(new_manager_id.value)}
            )
        
        return True
    
    async def get_team_members(self, manager_id: UserId) -> List[User]:
        """Get all team members under a manager."""
        return await self.get_user_subordinates(manager_id)
    
    async def get_peers(self, user_id: UserId) -> List[User]:
        """Get users who have the same manager."""
        user = await self._user_repository.get_by_id(user_id)
        if not user or not user.manager_id:
            return []
        
        return await self._get_direct_subordinates(user.manager_id)
    
    async def _get_direct_subordinates(self, manager_id: UserId) -> List[User]:
        """Get direct subordinates of a manager."""
        # This would need to be implemented in the repository
        # For now, we'll return an empty list
        return []
    
    async def _would_create_circular_hierarchy(
        self,
        user_id: UserId,
        new_manager_id: UserId
    ) -> bool:
        """Check if assigning a manager would create circular hierarchy."""
        # Get all managers of the new manager
        managers = await self.get_user_managers(new_manager_id)
        
        # Check if the user is in the manager chain
        for manager in managers:
            if manager.id == user_id:
                return True
        
        return False
