"""
Organization-related API schemas.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from .common_schemas import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema, BaseListResponseSchema, PaginationSchema


class OrganizationCreateSchema(BaseCreateSchema):
    """Organization creation schema."""
    
    name: str = Field(..., min_length=1, max_length=100, description="Organization name")
    description: Optional[str] = Field(None, description="Organization description")
    website: Optional[str] = Field(None, description="Organization website")
    email: Optional[str] = Field(None, description="Organization email")
    phone: Optional[str] = Field(None, description="Organization phone")
    address: Optional[str] = Field(None, description="Organization address")
    industry: Optional[str] = Field(None, description="Industry")
    size: Optional[str] = Field(None, description="Organization size")
    is_active: bool = Field(True, description="Whether organization is active")


class OrganizationUpdateSchema(BaseUpdateSchema):
    """Organization update schema."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Organization name")
    description: Optional[str] = Field(None, description="Organization description")
    website: Optional[str] = Field(None, description="Organization website")
    email: Optional[str] = Field(None, description="Organization email")
    phone: Optional[str] = Field(None, description="Organization phone")
    address: Optional[str] = Field(None, description="Organization address")
    industry: Optional[str] = Field(None, description="Industry")
    size: Optional[str] = Field(None, description="Organization size")
    is_active: Optional[bool] = Field(None, description="Whether organization is active")


class OrganizationResponseSchema(BaseResponseSchema):
    """Organization response schema."""
    
    name: str = Field(..., description="Organization name")
    description: Optional[str] = Field(None, description="Organization description")
    website: Optional[str] = Field(None, description="Organization website")
    email: Optional[str] = Field(None, description="Organization email")
    phone: Optional[str] = Field(None, description="Organization phone")
    address: Optional[str] = Field(None, description="Organization address")
    industry: Optional[str] = Field(None, description="Industry")
    size: Optional[str] = Field(None, description="Organization size")
    is_active: bool = Field(..., description="Whether organization is active")
    user_count: Optional[int] = Field(None, description="Number of users")
    department_count: Optional[int] = Field(None, description="Number of departments")


class OrganizationListResponseSchema(BaseListResponseSchema):
    """Organization list response schema."""
    
    items: List[OrganizationResponseSchema] = Field(..., description="List of organizations")
    pagination: PaginationSchema = Field(..., description="Pagination information")


class OrganizationFilterSchema(BaseModel):
    """Organization filter schema."""
    
    industry: Optional[str] = Field(None, description="Filter by industry")
    size: Optional[str] = Field(None, description="Filter by size")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    search: Optional[str] = Field(None, description="Search query")
    sort_by: Optional[str] = Field(None, description="Sort field")
    sort_order: Optional[str] = Field("asc", description="Sort order")
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")


class OrganizationStatisticsSchema(BaseModel):
    """Organization statistics schema."""
    
    total_organizations: int = Field(..., description="Total number of organizations")
    active_organizations: int = Field(..., description="Number of active organizations")
    inactive_organizations: int = Field(..., description="Number of inactive organizations")
    organizations_by_industry: Dict[str, int] = Field(..., description="Organizations by industry")
    organizations_by_size: Dict[str, int] = Field(..., description="Organizations by size")
    total_users: int = Field(..., description="Total number of users")
    total_departments: int = Field(..., description="Total number of departments")


class OrganizationHierarchySchema(BaseModel):
    """Organization hierarchy schema."""
    
    organization: OrganizationResponseSchema = Field(..., description="Organization information")
    departments: List[dict] = Field(default_factory=list, description="Departments")
    users: List[dict] = Field(default_factory=list, description="Users")
    total_users: int = Field(..., description="Total number of users")
    total_departments: int = Field(..., description="Total number of departments")
