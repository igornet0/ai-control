"""
Dashboard Data Transfer Objects.
DTOs for dashboard-related operations.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, validator

from src.domain.dashboard.entities.dashboard import Dashboard
from src.domain.dashboard.entities.widget import Widget
from src.domain.dashboard.entities.dashboard_widget import DashboardWidget


class DashboardCreateDTO(BaseModel):
    """DTO for creating a dashboard."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Dashboard name")
    description: Optional[str] = Field(default=None, description="Dashboard description")
    theme: str = Field(default="default", description="Dashboard theme")
    is_public: bool = Field(default=False, description="Public dashboard flag")
    is_template: bool = Field(default=False, description="Template dashboard flag")
    layout_config: Dict[str, Any] = Field(default_factory=dict, description="Layout configuration")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate dashboard name."""
        if not v.strip():
            raise ValueError("Dashboard name cannot be empty or only whitespace")
        return v.strip()
    
    @validator("theme")
    def validate_theme(cls, v):
        """Validate dashboard theme."""
        valid_themes = ["default", "dark", "light", "blue", "green", "red"]
        if v not in valid_themes:
            raise ValueError(f"Theme must be one of: {', '.join(valid_themes)}")
        return v


class DashboardUpdateDTO(BaseModel):
    """DTO for updating a dashboard."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Dashboard name")
    description: Optional[str] = Field(default=None, description="Dashboard description")
    theme: Optional[str] = Field(default=None, description="Dashboard theme")
    is_public: Optional[bool] = Field(default=None, description="Public dashboard flag")
    is_template: Optional[bool] = Field(default=None, description="Template dashboard flag")
    layout_config: Optional[Dict[str, Any]] = Field(default=None, description="Layout configuration")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate dashboard name."""
        if v is not None and not v.strip():
            raise ValueError("Dashboard name cannot be empty or only whitespace")
        return v.strip() if v else v
    
    @validator("theme")
    def validate_theme(cls, v):
        """Validate dashboard theme."""
        if v is not None:
            valid_themes = ["default", "dark", "light", "blue", "green", "red"]
            if v not in valid_themes:
                raise ValueError(f"Theme must be one of: {', '.join(valid_themes)}")
        return v


class DashboardResponseDTO(BaseModel):
    """DTO for dashboard response."""
    
    id: UUID = Field(..., description="Dashboard ID")
    name: str = Field(..., description="Dashboard name")
    description: Optional[str] = Field(default=None, description="Dashboard description")
    theme: str = Field(..., description="Dashboard theme")
    is_public: bool = Field(..., description="Public dashboard flag")
    is_template: bool = Field(..., description="Template dashboard flag")
    layout_config: Dict[str, Any] = Field(..., description="Layout configuration")
    user_id: UUID = Field(..., description="Dashboard owner ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True


class DashboardListResponseDTO(BaseModel):
    """DTO for dashboard list response."""
    
    dashboards: List[DashboardResponseDTO] = Field(..., description="List of dashboards")
    total_count: int = Field(..., description="Total number of dashboards")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")
    
    class Config:
        from_attributes = True


class WidgetCreateDTO(BaseModel):
    """DTO for creating a widget."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Widget name")
    description: Optional[str] = Field(default=None, description="Widget description")
    widget_type: str = Field(..., min_length=1, max_length=100, description="Widget type")
    category: str = Field(..., min_length=1, max_length=100, description="Widget category")
    icon: Optional[str] = Field(default=None, description="Widget icon")
    default_config: Dict[str, Any] = Field(default_factory=dict, description="Default configuration")
    schema: Dict[str, Any] = Field(default_factory=dict, description="JSON schema for configuration")
    is_system: bool = Field(default=False, description="System widget flag")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate widget name."""
        if not v.strip():
            raise ValueError("Widget name cannot be empty or only whitespace")
        return v.strip()
    
    @validator("widget_type")
    def validate_widget_type(cls, v):
        """Validate widget type."""
        valid_types = [
            "chart", "table", "kpi", "text", "image", "map", "gauge", 
            "progress", "list", "card", "metric", "alert", "custom"
        ]
        if v not in valid_types:
            raise ValueError(f"Widget type must be one of: {', '.join(valid_types)}")
        return v
    
    @validator("category")
    def validate_category(cls, v):
        """Validate widget category."""
        valid_categories = [
            "charts", "tables", "kpi", "text", "images", "maps", 
            "gauges", "progress", "lists", "cards", "metrics", "alerts", "custom"
        ]
        if v not in valid_categories:
            raise ValueError(f"Widget category must be one of: {', '.join(valid_categories)}")
        return v


class WidgetResponseDTO(BaseModel):
    """DTO for widget response."""
    
    id: UUID = Field(..., description="Widget ID")
    name: str = Field(..., description="Widget name")
    description: Optional[str] = Field(default=None, description="Widget description")
    widget_type: str = Field(..., description="Widget type")
    category: str = Field(..., description="Widget category")
    icon: Optional[str] = Field(default=None, description="Widget icon")
    default_config: Dict[str, Any] = Field(..., description="Default configuration")
    schema: Dict[str, Any] = Field(..., description="JSON schema for configuration")
    is_active: bool = Field(..., description="Active status")
    is_system: bool = Field(..., description="System widget flag")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True


class DashboardWidgetCreateDTO(BaseModel):
    """DTO for creating a dashboard widget."""
    
    widget_id: UUID = Field(..., description="Widget ID")
    title: str = Field(..., min_length=1, max_length=255, description="Widget title")
    position_x: int = Field(default=0, ge=0, description="X position")
    position_y: int = Field(default=0, ge=0, description="Y position")
    width: int = Field(default=6, ge=1, le=12, description="Width in grid units")
    height: int = Field(default=4, ge=1, le=20, description="Height in grid units")
    config: Dict[str, Any] = Field(default_factory=dict, description="Widget configuration")
    data_source_id: Optional[UUID] = Field(default=None, description="Data source ID")
    refresh_interval: int = Field(default=0, ge=0, description="Refresh interval in seconds")
    
    @validator("title")
    def validate_title(cls, v):
        """Validate widget title."""
        if not v.strip():
            raise ValueError("Widget title cannot be empty or only whitespace")
        return v.strip()
    
    @validator("width")
    def validate_width(cls, v):
        """Validate widget width."""
        if v < 1 or v > 12:
            raise ValueError("Width must be between 1 and 12 grid units")
        return v
    
    @validator("height")
    def validate_height(cls, v):
        """Validate widget height."""
        if v < 1 or v > 20:
            raise ValueError("Height must be between 1 and 20 grid units")
        return v
    
    @validator("refresh_interval")
    def validate_refresh_interval(cls, v):
        """Validate refresh interval."""
        if v < 0:
            raise ValueError("Refresh interval cannot be negative")
        return v


class DashboardWidgetResponseDTO(BaseModel):
    """DTO for dashboard widget response."""
    
    id: UUID = Field(..., description="Dashboard widget ID")
    dashboard_id: UUID = Field(..., description="Dashboard ID")
    widget_id: UUID = Field(..., description="Widget ID")
    title: str = Field(..., description="Widget title")
    position_x: int = Field(..., description="X position")
    position_y: int = Field(..., description="Y position")
    width: int = Field(..., description="Width in grid units")
    height: int = Field(..., description="Height in grid units")
    config: Dict[str, Any] = Field(..., description="Widget configuration")
    data_source_id: Optional[UUID] = Field(default=None, description="Data source ID")
    is_visible: bool = Field(..., description="Visibility status")
    refresh_interval: int = Field(..., description="Refresh interval in seconds")
    last_refresh: Optional[datetime] = Field(default=None, description="Last refresh time")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True


class DashboardShareDTO(BaseModel):
    """DTO for dashboard sharing."""
    
    shared_with: UUID = Field(..., description="User ID to share with")
    can_view: bool = Field(default=True, description="Can view permission")
    can_edit: bool = Field(default=False, description="Can edit permission")
    can_share: bool = Field(default=False, description="Can share permission")
    expires_at: Optional[datetime] = Field(default=None, description="Expiration date")


class DashboardShareResponseDTO(BaseModel):
    """DTO for dashboard share response."""
    
    id: UUID = Field(..., description="Share ID")
    dashboard_id: UUID = Field(..., description="Dashboard ID")
    shared_by: UUID = Field(..., description="User who shared")
    shared_with: UUID = Field(..., description="User shared with")
    can_view: bool = Field(..., description="Can view permission")
    can_edit: bool = Field(..., description="Can edit permission")
    can_share: bool = Field(..., description="Can share permission")
    shared_at: datetime = Field(..., description="Share timestamp")
    expires_at: Optional[datetime] = Field(default=None, description="Expiration date")
    
    class Config:
        from_attributes = True


class DashboardVersionResponseDTO(BaseModel):
    """DTO for dashboard version response."""
    
    id: UUID = Field(..., description="Version ID")
    dashboard_id: UUID = Field(..., description="Dashboard ID")
    version_number: int = Field(..., description="Version number")
    name: str = Field(..., description="Version name")
    description: Optional[str] = Field(default=None, description="Version description")
    layout_config: Dict[str, Any] = Field(..., description="Layout configuration")
    widgets_config: Dict[str, Any] = Field(..., description="Widgets configuration")
    created_by: UUID = Field(..., description="Created by user ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    is_current: bool = Field(..., description="Is current version")
    
    class Config:
        from_attributes = True


class DashboardStatisticsDTO(BaseModel):
    """DTO for dashboard statistics."""
    
    total_dashboards: int = Field(..., description="Total number of dashboards")
    public_dashboards: int = Field(..., description="Number of public dashboards")
    template_dashboards: int = Field(..., description="Number of template dashboards")
    dashboards_by_theme: Dict[str, int] = Field(..., description="Dashboards grouped by theme")
    dashboards_by_organization: Dict[str, int] = Field(..., description="Dashboards grouped by organization")
    dashboards_by_department: Dict[str, int] = Field(..., description="Dashboards grouped by department")
    average_widgets_per_dashboard: float = Field(..., description="Average widgets per dashboard")
    most_used_widgets: List[Dict[str, Any]] = Field(..., description="Most used widgets")
    
    class Config:
        from_attributes = True
