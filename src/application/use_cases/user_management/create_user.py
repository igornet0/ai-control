"""
Create User use case.
Handles the business logic for creating a new user.
"""

from typing import Optional
from uuid import UUID

from pydantic import EmailStr

from src.domain.exceptions import EntityAlreadyExists, ValidationError
from src.domain.user_management.entities.user import User, UserRole
from src.domain.user_management.repositories.user_repository import UserRepository
from src.domain.user_management.repositories.organization_repository import OrganizationRepository
from src.domain.user_management.repositories.department_repository import DepartmentRepository


class CreateUserRequest:
    """Request model for creating a user."""
    
    def __init__(
        self,
        login: str,
        username: str,
        email: EmailStr,
        password_hash: str,
        role: UserRole = UserRole.EMPLOYEE,
        manager_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        organization_id: Optional[UUID] = None,
        position: Optional[str] = None,
        phone: Optional[str] = None,
        bio: Optional[str] = None,
    ):
        self.login = login
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.role = role
        self.manager_id = manager_id
        self.department_id = department_id
        self.organization_id = organization_id
        self.position = position
        self.phone = phone
        self.bio = bio


class CreateUserResponse:
    """Response model for creating a user."""
    
    def __init__(self, user: User):
        self.user_id = user.id
        self.login = user.login
        self.username = user.username
        self.email = str(user.email)
        self.role = user.role
        self.is_active = user.is_active
        self.created_at = user.created_at


class CreateUserUseCase:
    """Use case for creating a new user."""
    
    def __init__(
        self,
        user_repository: UserRepository,
        organization_repository: OrganizationRepository,
        department_repository: DepartmentRepository,
    ):
        self._user_repository = user_repository
        self._organization_repository = organization_repository
        self._department_repository = department_repository
    
    async def execute(self, request: CreateUserRequest) -> CreateUserResponse:
        """
        Execute the create user use case.
        
        Args:
            request: Create user request
            
        Returns:
            CreateUserResponse: Created user information
            
        Raises:
            EntityAlreadyExists: If user with login or email already exists
            ValidationError: If validation fails
        """
        # Check if user with login already exists
        if await self._user_repository.exists_by_login(request.login):
            raise EntityAlreadyExists(
                entity_type="User",
                entity_id=request.login,
                details={"field": "login", "value": request.login}
            )
        
        # Check if user with email already exists
        if await self._user_repository.exists_by_email(str(request.email)):
            raise EntityAlreadyExists(
                entity_type="User",
                entity_id=str(request.email),
                details={"field": "email", "value": str(request.email)}
            )
        
        # Validate organization exists if provided
        if request.organization_id:
            organization = await self._organization_repository.get_by_id(request.organization_id)
            if not organization:
                raise ValidationError(
                    field="organization_id",
                    value=str(request.organization_id),
                    reason="Organization not found"
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
            if request.organization_id and department.organization_id != request.organization_id:
                raise ValidationError(
                    field="department_id",
                    value=str(request.department_id),
                    reason="Department does not belong to the specified organization"
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
        
        # Create the user
        user = User.create(
            login=request.login,
            username=request.username,
            email=request.email,
            password_hash=request.password_hash,
            role=request.role,
            manager_id=request.manager_id,
            department_id=request.department_id,
            organization_id=request.organization_id,
            position=request.position,
            phone=request.phone,
            bio=request.bio,
        )
        
        # Save the user
        saved_user = await self._user_repository.save(user)
        
        return CreateUserResponse(saved_user)
