"""
Data Transfer Objects for User Management.
Defines the data structures used for API communication.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from src.domain.user_management.entities.user import UserRole, UserStatus


class UserBaseDTO(BaseModel):
    """Base DTO for user data."""
    
    login: str = Field(..., min_length=3, max_length=255, description="User login")
    username: str = Field(..., min_length=1, max_length=255, description="Display name")
    email: EmailStr = Field(..., description="User email")
    role: UserRole = Field(default=UserRole.EMPLOYEE, description="User role")
    position: Optional[str] = Field(default=None, max_length=255, description="Job position")
    phone: Optional[str] = Field(default=None, max_length=50, description="Phone number")
    bio: Optional[str] = Field(default=None, description="User biography")
    manager_id: Optional[UUID] = Field(default=None, description="Manager ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")


class CreateUserDTO(UserBaseDTO):
    """DTO for creating a user."""
    
    password: str = Field(..., min_length=8, description="User password")


class UpdateUserDTO(BaseModel):
    """DTO for updating a user."""
    
    username: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Display name")
    email: Optional[EmailStr] = Field(default=None, description="User email")
    position: Optional[str] = Field(default=None, max_length=255, description="Job position")
    phone: Optional[str] = Field(default=None, max_length=50, description="Phone number")
    bio: Optional[str] = Field(default=None, description="User biography")
    avatar_url: Optional[str] = Field(default=None, max_length=500, description="Avatar URL")
    manager_id: Optional[UUID] = Field(default=None, description="Manager ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")


class UserResponseDTO(BaseModel):
    """DTO for user response."""
    
    user_id: UUID = Field(..., description="User ID")
    login: str = Field(..., description="User login")
    username: str = Field(..., description="Display name")
    email: str = Field(..., description="User email")
    role: UserRole = Field(..., description="User role")
    status: UserStatus = Field(..., description="User status")
    is_active: bool = Field(..., description="Is user active")
    manager_id: Optional[UUID] = Field(default=None, description="Manager ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    position: Optional[str] = Field(default=None, description="Job position")
    phone: Optional[str] = Field(default=None, description="Phone number")
    avatar_url: Optional[str] = Field(default=None, description="Avatar URL")
    bio: Optional[str] = Field(default=None, description="User biography")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")
    last_login: Optional[datetime] = Field(default=None, description="Last login timestamp")
    
    class Config:
        """Pydantic configuration."""
        from_attributes = True


class UserListResponseDTO(BaseModel):
    """DTO for user list response."""
    
    users: List[UserResponseDTO] = Field(..., description="List of users")
    total_count: int = Field(..., description="Total number of users")
    limit: int = Field(..., description="Number of users returned")
    offset: int = Field(..., description="Offset for pagination")


class ChangeUserRoleDTO(BaseModel):
    """DTO for changing user role."""
    
    role: UserRole = Field(..., description="New user role")


class ChangeUserStatusDTO(BaseModel):
    """DTO for changing user status."""
    
    status: UserStatus = Field(..., description="New user status")
    reason: Optional[str] = Field(default=None, description="Reason for status change")


class UserSearchDTO(BaseModel):
    """DTO for user search."""
    
    query: Optional[str] = Field(default=None, description="Search query")
    organization_id: Optional[UUID] = Field(default=None, description="Filter by organization")
    department_id: Optional[UUID] = Field(default=None, description="Filter by department")
    role: Optional[UserRole] = Field(default=None, description="Filter by role")
    status: Optional[UserStatus] = Field(default=None, description="Filter by status")
    limit: int = Field(default=50, ge=1, le=100, description="Number of results to return")
    offset: int = Field(default=0, ge=0, description="Offset for pagination")


class UserHierarchyDTO(BaseModel):
    """DTO for user hierarchy."""
    
    user_id: UUID = Field(..., description="User ID")
    username: str = Field(..., description="Display name")
    role: UserRole = Field(..., description="User role")
    position: Optional[str] = Field(default=None, description="Job position")
    subordinates: List["UserHierarchyDTO"] = Field(default_factory=list, description="Subordinate users")
    
    class Config:
        """Pydantic configuration."""
        from_attributes = True


# Update forward references
UserHierarchyDTO.model_rebuild()
