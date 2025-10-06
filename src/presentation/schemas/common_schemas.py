"""
Common API schemas.
"""

from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field
from datetime import datetime


class ErrorResponseSchema(BaseModel):
    """Error response schema."""
    
    error: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")


class SuccessResponseSchema(BaseModel):
    """Success response schema."""
    
    message: str = Field(..., description="Success message")
    data: Optional[Any] = Field(None, description="Response data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")


class PaginationSchema(BaseModel):
    """Pagination schema."""
    
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")
    total: int = Field(..., description="Total number of items")
    pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_prev: bool = Field(..., description="Whether there is a previous page")


class HealthCheckSchema(BaseModel):
    """Health check response schema."""
    
    status: str = Field(..., description="Health status")
    version: str = Field(..., description="API version")
    environment: str = Field(..., description="Environment")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Check timestamp")
    services: Optional[Dict[str, str]] = Field(None, description="Service statuses")


class BaseEntitySchema(BaseModel):
    """Base entity schema."""
    
    id: str = Field(..., description="Entity ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class BaseCreateSchema(BaseModel):
    """Base create schema."""
    
    pass


class BaseUpdateSchema(BaseModel):
    """Base update schema."""
    
    pass


class BaseResponseSchema(BaseEntitySchema):
    """Base response schema."""
    
    pass


class BaseListResponseSchema(BaseModel):
    """Base list response schema."""
    
    items: List[Any] = Field(..., description="List of items")
    pagination: PaginationSchema = Field(..., description="Pagination information")


class FilterSchema(BaseModel):
    """Base filter schema."""
    
    search: Optional[str] = Field(None, description="Search query")
    sort_by: Optional[str] = Field(None, description="Sort field")
    sort_order: Optional[str] = Field("asc", description="Sort order (asc/desc)")
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")


class DateRangeSchema(BaseModel):
    """Date range schema."""
    
    start_date: Optional[datetime] = Field(None, description="Start date")
    end_date: Optional[datetime] = Field(None, description="End date")


class FileUploadSchema(BaseModel):
    """File upload schema."""
    
    filename: str = Field(..., description="File name")
    content_type: str = Field(..., description="File content type")
    size: int = Field(..., description="File size in bytes")
    url: Optional[str] = Field(None, description="File URL")


class WebhookSchema(BaseModel):
    """Webhook schema."""
    
    event_type: str = Field(..., description="Event type")
    data: Dict[str, Any] = Field(..., description="Event data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    source: Optional[str] = Field(None, description="Event source")
