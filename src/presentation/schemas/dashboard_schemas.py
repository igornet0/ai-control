"""
Dashboard-related API schemas.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from .common_schemas import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema, BaseListResponseSchema, PaginationSchema


class WidgetCreateSchema(BaseCreateSchema):
    """Widget creation schema."""
    
    name: str = Field(..., min_length=1, max_length=100, description="Widget name")
    widget_type: str = Field(..., description="Widget type")
    config: Dict[str, Any] = Field(default_factory=dict, description="Widget configuration")
    data_source: Optional[str] = Field(None, description="Data source")
    refresh_interval: Optional[int] = Field(None, ge=0, description="Refresh interval in seconds")


class WidgetUpdateSchema(BaseUpdateSchema):
    """Widget update schema."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Widget name")
    widget_type: Optional[str] = Field(None, description="Widget type")
    config: Optional[Dict[str, Any]] = Field(None, description="Widget configuration")
    data_source: Optional[str] = Field(None, description="Data source")
    refresh_interval: Optional[int] = Field(None, ge=0, description="Refresh interval in seconds")


class WidgetResponseSchema(BaseResponseSchema):
    """Widget response schema."""
    
    name: str = Field(..., description="Widget name")
    widget_type: str = Field(..., description="Widget type")
    config: Dict[str, Any] = Field(..., description="Widget configuration")
    data_source: Optional[str] = Field(None, description="Data source")
    refresh_interval: Optional[int] = Field(None, description="Refresh interval in seconds")
    is_active: bool = Field(..., description="Whether widget is active")


class DashboardCreateSchema(BaseCreateSchema):
    """Dashboard creation schema."""
    
    name: str = Field(..., min_length=1, max_length=100, description="Dashboard name")
    description: Optional[str] = Field(None, description="Dashboard description")
    user_id: str = Field(..., description="User ID")
    is_public: bool = Field(False, description="Whether dashboard is public")
    layout: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Dashboard layout")
    widgets: Optional[List[str]] = Field(default_factory=list, description="Widget IDs")


class DashboardUpdateSchema(BaseUpdateSchema):
    """Dashboard update schema."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Dashboard name")
    description: Optional[str] = Field(None, description="Dashboard description")
    is_public: Optional[bool] = Field(None, description="Whether dashboard is public")
    layout: Optional[Dict[str, Any]] = Field(None, description="Dashboard layout")
    widgets: Optional[List[str]] = Field(None, description="Widget IDs")


class DashboardResponseSchema(BaseResponseSchema):
    """Dashboard response schema."""
    
    name: str = Field(..., description="Dashboard name")
    description: Optional[str] = Field(None, description="Dashboard description")
    user_id: str = Field(..., description="User ID")
    is_public: bool = Field(..., description="Whether dashboard is public")
    layout: Dict[str, Any] = Field(..., description="Dashboard layout")
    widgets: List[WidgetResponseSchema] = Field(default_factory=list, description="Dashboard widgets")
    user_name: Optional[str] = Field(None, description="User name")


class DashboardListResponseSchema(BaseListResponseSchema):
    """Dashboard list response schema."""
    
    items: List[DashboardResponseSchema] = Field(..., description="List of dashboards")
    pagination: PaginationSchema = Field(..., description="Pagination information")


class DashboardWidgetCreateSchema(BaseCreateSchema):
    """Dashboard widget creation schema."""
    
    dashboard_id: str = Field(..., description="Dashboard ID")
    widget_id: str = Field(..., description="Widget ID")
    position_x: int = Field(0, ge=0, description="X position")
    position_y: int = Field(0, ge=0, description="Y position")
    width: int = Field(4, ge=1, description="Widget width")
    height: int = Field(4, ge=1, description="Widget height")
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Widget configuration")


class DashboardWidgetUpdateSchema(BaseUpdateSchema):
    """Dashboard widget update schema."""
    
    position_x: Optional[int] = Field(None, ge=0, description="X position")
    position_y: Optional[int] = Field(None, ge=0, description="Y position")
    width: Optional[int] = Field(None, ge=1, description="Widget width")
    height: Optional[int] = Field(None, ge=1, description="Widget height")
    config: Optional[Dict[str, Any]] = Field(None, description="Widget configuration")


class DashboardWidgetResponseSchema(BaseResponseSchema):
    """Dashboard widget response schema."""
    
    dashboard_id: str = Field(..., description="Dashboard ID")
    widget_id: str = Field(..., description="Widget ID")
    position_x: int = Field(..., description="X position")
    position_y: int = Field(..., description="Y position")
    width: int = Field(..., description="Widget width")
    height: int = Field(..., description="Widget height")
    config: Dict[str, Any] = Field(..., description="Widget configuration")
    widget: Optional[WidgetResponseSchema] = Field(None, description="Widget details")


class DashboardFilterSchema(BaseModel):
    """Dashboard filter schema."""
    
    user_id: Optional[str] = Field(None, description="Filter by user")
    is_public: Optional[bool] = Field(None, description="Filter by public status")
    search: Optional[str] = Field(None, description="Search query")
    sort_by: Optional[str] = Field(None, description="Sort field")
    sort_order: Optional[str] = Field("asc", description="Sort order")
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")


class DashboardStatisticsSchema(BaseModel):
    """Dashboard statistics schema."""
    
    total_dashboards: int = Field(..., description="Total number of dashboards")
    public_dashboards: int = Field(..., description="Number of public dashboards")
    private_dashboards: int = Field(..., description="Number of private dashboards")
    total_widgets: int = Field(..., description="Total number of widgets")
    active_widgets: int = Field(..., description="Number of active widgets")


class WidgetDataSchema(BaseModel):
    """Widget data schema."""
    
    widget_id: str = Field(..., description="Widget ID")
    data: Dict[str, Any] = Field(..., description="Widget data")
    last_updated: datetime = Field(..., description="Last update timestamp")
    next_refresh: Optional[datetime] = Field(None, description="Next refresh timestamp")


class DashboardExportSchema(BaseModel):
    """Dashboard export schema."""
    
    dashboard: DashboardResponseSchema = Field(..., description="Dashboard data")
    widgets: List[WidgetResponseSchema] = Field(..., description="Widget data")
    exported_at: datetime = Field(default_factory=datetime.utcnow, description="Export timestamp")
    version: str = Field("1.0", description="Export version")
