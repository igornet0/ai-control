"""
Get User use case.
Handles the business logic for retrieving user information.
"""

from typing import List, Optional
from uuid import UUID

from src.domain.exceptions import EntityNotFound
from src.domain.user_management.entities.user import User, UserRole, UserStatus
from src.domain.user_management.repositories.user_repository import UserRepository


class GetUserRequest:
    """Request model for getting a user."""
    
    def __init__(self, user_id: UUID):
        self.user_id = user_id


class GetUserResponse:
    """Response model for getting a user."""
    
    def __init__(self, user: User):
        self.user_id = user.id
        self.login = user.login
        self.username = user.username
        self.email = str(user.email)
        self.role = user.role
        self.status = user.status
        self.is_active = user.is_active
        self.manager_id = user.manager_id
        self.department_id = user.department_id
        self.organization_id = user.organization_id
        self.position = user.position
        self.phone = user.phone
        self.avatar_url = user.avatar_url
        self.bio = user.bio
        self.created_at = user.created_at
        self.updated_at = user.updated_at
        self.last_login = user.last_login


class GetUserUseCase:
    """Use case for getting user information."""
    
    def __init__(self, user_repository: UserRepository):
        self._user_repository = user_repository
    
    async def execute(self, request: GetUserRequest) -> GetUserResponse:
        """
        Execute the get user use case.
        
        Args:
            request: Get user request
            
        Returns:
            GetUserResponse: User information
            
        Raises:
            EntityNotFound: If user not found
        """
        user = await self._user_repository.get_by_id(request.user_id)
        if not user:
            raise EntityNotFound(
                entity_type="User",
                entity_id=request.user_id
            )
        
        return GetUserResponse(user)


class GetUsersRequest:
    """Request model for getting multiple users."""
    
    def __init__(
        self,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ):
        self.organization_id = organization_id
        self.department_id = department_id
        self.role = role
        self.status = status
        self.search_query = search_query
        self.limit = limit
        self.offset = offset


class GetUsersResponse:
    """Response model for getting multiple users."""
    
    def __init__(self, users: List[User], total_count: int):
        self.users = [
            {
                "user_id": user.id,
                "login": user.login,
                "username": user.username,
                "email": str(user.email),
                "role": user.role,
                "status": user.status,
                "is_active": user.is_active,
                "manager_id": user.manager_id,
                "department_id": user.department_id,
                "organization_id": user.organization_id,
                "position": user.position,
                "phone": user.phone,
                "avatar_url": user.avatar_url,
                "created_at": user.created_at,
                "updated_at": user.updated_at,
                "last_login": user.last_login,
            }
            for user in users
        ]
        self.total_count = total_count
        self.limit = len(users)


class GetUsersUseCase:
    """Use case for getting multiple users."""
    
    def __init__(self, user_repository: UserRepository):
        self._user_repository = user_repository
    
    async def execute(self, request: GetUsersRequest) -> GetUsersResponse:
        """
        Execute the get users use case.
        
        Args:
            request: Get users request
            
        Returns:
            GetUsersResponse: List of users with pagination info
        """
        if request.search_query:
            users = await self._user_repository.search_users(
                query=request.search_query,
                organization_id=request.organization_id,
                department_id=request.department_id,
                role=request.role,
                status=request.status,
                limit=request.limit,
                offset=request.offset,
            )
            total_count = await self._user_repository.count_users(
                organization_id=request.organization_id,
                department_id=request.department_id,
                role=request.role,
                status=request.status,
            )
        else:
            # Get users by filters
            if request.organization_id:
                users = await self._user_repository.get_by_organization(request.organization_id)
            elif request.department_id:
                users = await self._user_repository.get_by_department(request.department_id)
            elif request.role:
                users = await self._user_repository.get_by_role(request.role)
            elif request.status:
                users = await self._user_repository.get_by_status(request.status)
            else:
                users = await self._user_repository.get_active_users()
            
            # Apply pagination
            total_count = len(users)
            users = users[request.offset:request.offset + request.limit]
        
        return GetUsersResponse(users, total_count)
