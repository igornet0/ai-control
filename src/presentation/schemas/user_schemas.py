"""
User-related API schemas.
"""

from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from .common_schemas import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema, BaseListResponseSchema, PaginationSchema


class UserCreateSchema(BaseCreateSchema):
    """User creation schema."""
    
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=8, description="User password")
    first_name: str = Field(..., min_length=1, max_length=50, description="First name")
    last_name: str = Field(..., min_length=1, max_length=50, description="Last name")
    role: str = Field(..., description="User role")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    manager_id: Optional[str] = Field(None, description="Manager ID")
    phone: Optional[str] = Field(None, description="Phone number")
    position: Optional[str] = Field(None, description="Job position")
    is_active: bool = Field(True, description="Whether user is active")


class UserUpdateSchema(BaseUpdateSchema):
    """User update schema."""
    
    email: Optional[EmailStr] = Field(None, description="User email")
    first_name: Optional[str] = Field(None, min_length=1, max_length=50, description="First name")
    last_name: Optional[str] = Field(None, min_length=1, max_length=50, description="Last name")
    role: Optional[str] = Field(None, description="User role")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    manager_id: Optional[str] = Field(None, description="Manager ID")
    phone: Optional[str] = Field(None, description="Phone number")
    position: Optional[str] = Field(None, description="Job position")
    is_active: Optional[bool] = Field(None, description="Whether user is active")


class UserResponseSchema(BaseResponseSchema):
    """User response schema."""
    
    email: str = Field(..., description="User email")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    role: str = Field(..., description="User role")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    manager_id: Optional[str] = Field(None, description="Manager ID")
    phone: Optional[str] = Field(None, description="Phone number")
    position: Optional[str] = Field(None, description="Job position")
    is_active: bool = Field(..., description="Whether user is active")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")


class UserListResponseSchema(BaseListResponseSchema):
    """User list response schema."""
    
    items: List[UserResponseSchema] = Field(..., description="List of users")
    pagination: PaginationSchema = Field(..., description="Pagination information")


class UserLoginSchema(BaseModel):
    """User login schema."""
    
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., description="User password")


class UserRegisterSchema(BaseModel):
    """User registration schema."""
    
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=8, description="User password")
    first_name: str = Field(..., min_length=1, max_length=50, description="First name")
    last_name: str = Field(..., min_length=1, max_length=50, description="Last name")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    phone: Optional[str] = Field(None, description="Phone number")
    position: Optional[str] = Field(None, description="Job position")


class UserPasswordResetSchema(BaseModel):
    """User password reset schema."""
    
    email: EmailStr = Field(..., description="User email")


class UserPasswordChangeSchema(BaseModel):
    """User password change schema."""
    
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class UserProfileSchema(BaseModel):
    """User profile schema."""
    
    id: str = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    role: str = Field(..., description="User role")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    manager_id: Optional[str] = Field(None, description="Manager ID")
    phone: Optional[str] = Field(None, description="Phone number")
    position: Optional[str] = Field(None, description="Job position")
    is_active: bool = Field(..., description="Whether user is active")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class UserHierarchySchema(BaseModel):
    """User hierarchy schema."""
    
    user: UserResponseSchema = Field(..., description="User information")
    manager: Optional[UserResponseSchema] = Field(None, description="Manager information")
    subordinates: List[UserResponseSchema] = Field(default_factory=list, description="Subordinates")
    organization: Optional[str] = Field(None, description="Organization name")
    department: Optional[str] = Field(None, description="Department name")
