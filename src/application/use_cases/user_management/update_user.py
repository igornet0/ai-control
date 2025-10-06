"""
Update User use case.
Handles the business logic for updating user information.
"""

from typing import Optional
from uuid import UUID

from pydantic import EmailStr

from src.domain.exceptions import EntityNotFound, EntityAlreadyExists, ValidationError
from src.domain.user_management.entities.user import User, UserRole
from src.domain.user_management.repositories.user_repository import UserRepository
from src.domain.user_management.repositories.organization_repository import OrganizationRepository
from src.domain.user_management.repositories.department_repository import DepartmentRepository


class UpdateUserRequest:
    """Request model for updating a user."""
    
    def __init__(
        self,
        user_id: UUID,
        username: Optional[str] = None,
        email: Optional[EmailStr] = None,
        phone: Optional[str] = None,
        bio: Optional[str] = None,
        avatar_url: Optional[str] = None,
        position: Optional[str] = None,
        manager_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        updated_by: Optional[UUID] = None,
    ):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.phone = phone
        self.bio = bio
        self.avatar_url = avatar_url
        self.position = position
        self.manager_id = manager_id
        self.department_id = department_id
        self.updated_by = updated_by


class UpdateUserResponse:
    """Response model for updating a user."""
    
    def __init__(self, user: User):
        self.user_id = user.id
        self.login = user.login
        self.username = user.username
        self.email = str(user.email)
        self.role = user.role
        self.is_active = user.is_active
        self.updated_at = user.updated_at


class UpdateUserUseCase:
    """Use case for updating user information."""
    
    def __init__(
        self,
        user_repository: UserRepository,
        organization_repository: OrganizationRepository,
        department_repository: DepartmentRepository,
    ):
        self._user_repository = user_repository
        self._organization_repository = organization_repository
        self._department_repository = department_repository
    
    async def execute(self, request: UpdateUserRequest) -> UpdateUserResponse:
        """
        Execute the update user use case.
        
        Args:
            request: Update user request
            
        Returns:
            UpdateUserResponse: Updated user information
            
        Raises:
            EntityNotFound: If user not found
            ValidationError: If validation fails
        """
        # Get the user
        user = await self._user_repository.get_by_id(request.user_id)
        if not user:
            raise EntityNotFound(
                entity_type="User",
                entity_id=request.user_id
            )
        
        # Check if email is being changed and if it already exists
        if request.email and request.email != user.email:
            if await self._user_repository.exists_by_email(str(request.email)):
                raise EntityAlreadyExists(
                    entity_type="User",
                    entity_id=str(request.email),
                    details={"field": "email", "value": str(request.email)}
                )
        
        # Validate department exists if provided
        if request.department_id:
            department = await self._department_repository.get_by_id(request.department_id)
            if not department:
                raise ValidationError(
                    field="department_id",
                    value=str(request.department_id),
                    reason="Department not found"
                )
            
            # Validate department belongs to the same organization
            if user.organization_id and department.organization_id != user.organization_id:
                raise ValidationError(
                    field="department_id",
                    value=str(request.department_id),
                    reason="Department does not belong to the user's organization"
                )
        
        # Validate manager exists if provided
        if request.manager_id:
            manager = await self._user_repository.get_by_id(request.manager_id)
            if not manager:
                raise ValidationError(
                    field="manager_id",
                    value=str(request.manager_id),
                    reason="Manager not found"
                )
            
            # Validate manager can manage users
            if not manager.can_manage_users():
                raise ValidationError(
                    field="manager_id",
                    value=str(request.manager_id),
                    reason="User cannot be a manager"
                )
        
        # Update user profile
        user.update_profile(
            username=request.username,
            email=request.email,
            phone=request.phone,
            bio=request.bio,
            avatar_url=request.avatar_url,
            position=request.position,
        )
        
        # Update manager if provided
        if request.manager_id is not None and request.manager_id != user.manager_id:
            if request.updated_by:
                user.assign_manager(request.manager_id, request.updated_by)
            else:
                user.manager_id = request.manager_id
                user.mark_as_updated()
        
        # Update department if provided
        if request.department_id is not None and request.department_id != user.department_id:
            user.department_id = request.department_id
            user.mark_as_updated()
        
        # Save the user
        updated_user = await self._user_repository.save(user)
        
        return UpdateUserResponse(updated_user)
