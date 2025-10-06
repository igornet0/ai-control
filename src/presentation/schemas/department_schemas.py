"""
Department-related API schemas.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from .common_schemas import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema, BaseListResponseSchema, PaginationSchema


class DepartmentCreateSchema(BaseCreateSchema):
    """Department creation schema."""
    
    name: str = Field(..., min_length=1, max_length=100, description="Department name")
    description: Optional[str] = Field(None, description="Department description")
    organization_id: str = Field(..., description="Organization ID")
    manager_id: Optional[str] = Field(None, description="Manager ID")
    parent_department_id: Optional[str] = Field(None, description="Parent department ID")
    budget: Optional[float] = Field(None, ge=0, description="Department budget")
    location: Optional[str] = Field(None, description="Department location")
    is_active: bool = Field(True, description="Whether department is active")


class DepartmentUpdateSchema(BaseUpdateSchema):
    """Department update schema."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Department name")
    description: Optional[str] = Field(None, description="Department description")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    manager_id: Optional[str] = Field(None, description="Manager ID")
    parent_department_id: Optional[str] = Field(None, description="Parent department ID")
    budget: Optional[float] = Field(None, ge=0, description="Department budget")
    location: Optional[str] = Field(None, description="Department location")
    is_active: Optional[bool] = Field(None, description="Whether department is active")


class DepartmentResponseSchema(BaseResponseSchema):
    """Department response schema."""
    
    name: str = Field(..., description="Department name")
    description: Optional[str] = Field(None, description="Department description")
    organization_id: str = Field(..., description="Organization ID")
    manager_id: Optional[str] = Field(None, description="Manager ID")
    parent_department_id: Optional[str] = Field(None, description="Parent department ID")
    budget: Optional[float] = Field(None, description="Department budget")
    location: Optional[str] = Field(None, description="Department location")
    is_active: bool = Field(..., description="Whether department is active")
    organization_name: Optional[str] = Field(None, description="Organization name")
    manager_name: Optional[str] = Field(None, description="Manager name")
    parent_department_name: Optional[str] = Field(None, description="Parent department name")
    user_count: Optional[int] = Field(None, description="Number of users")
    sub_department_count: Optional[int] = Field(None, description="Number of sub-departments")


class DepartmentListResponseSchema(BaseListResponseSchema):
    """Department list response schema."""
    
    items: List[DepartmentResponseSchema] = Field(..., description="List of departments")
    pagination: PaginationSchema = Field(..., description="Pagination information")


class DepartmentFilterSchema(BaseModel):
    """Department filter schema."""
    
    organization_id: Optional[str] = Field(None, description="Filter by organization")
    manager_id: Optional[str] = Field(None, description="Filter by manager")
    parent_department_id: Optional[str] = Field(None, description="Filter by parent department")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    search: Optional[str] = Field(None, description="Search query")
    sort_by: Optional[str] = Field(None, description="Sort field")
    sort_order: Optional[str] = Field("asc", description="Sort order")
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")


class DepartmentStatisticsSchema(BaseModel):
    """Department statistics schema."""
    
    total_departments: int = Field(..., description="Total number of departments")
    active_departments: int = Field(..., description="Number of active departments")
    inactive_departments: int = Field(..., description="Number of inactive departments")
    departments_by_organization: Dict[str, int] = Field(..., description="Departments by organization")
    total_users: int = Field(..., description="Total number of users")
    total_budget: float = Field(..., description="Total budget")


class DepartmentHierarchySchema(BaseModel):
    """Department hierarchy schema."""
    
    department: DepartmentResponseSchema = Field(..., description="Department information")
    parent_department: Optional[DepartmentResponseSchema] = Field(None, description="Parent department")
    sub_departments: List[DepartmentResponseSchema] = Field(default_factory=list, description="Sub-departments")
    manager: Optional[dict] = Field(None, description="Manager information")
    users: List[dict] = Field(default_factory=list, description="Users")
    total_users: int = Field(..., description="Total number of users")
    total_sub_departments: int = Field(..., description="Total number of sub-departments")


class DepartmentBudgetSchema(BaseModel):
    """Department budget schema."""
    
    department_id: str = Field(..., description="Department ID")
    department_name: str = Field(..., description="Department name")
    budget: float = Field(..., description="Department budget")
    used_budget: float = Field(..., description="Used budget")
    remaining_budget: float = Field(..., description="Remaining budget")
    budget_utilization: float = Field(..., description="Budget utilization percentage")
    period_start: datetime = Field(..., description="Budget period start")
    period_end: datetime = Field(..., description="Budget period end")
