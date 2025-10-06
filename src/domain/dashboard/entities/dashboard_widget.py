"""
Dashboard widget domain entity.
Represents a widget instance on a dashboard with business logic and validation.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import ValidationError, BusinessRuleViolation


class DashboardWidgetAddedEvent(DomainEvent):
    """Event raised when a widget is added to a dashboard."""
    
    def __init__(self, dashboard_widget_id: UUID, dashboard_id: UUID, widget_id: UUID, title: str):
        super().__init__(
            event_type="dashboard_widget_added",
            aggregate_id=str(dashboard_widget_id),
            aggregate_type="DashboardWidget",
            data={
                "dashboard_widget_id": str(dashboard_widget_id),
                "dashboard_id": str(dashboard_id),
                "widget_id": str(widget_id),
                "title": title,
            }
        )


class DashboardWidgetUpdatedEvent(DomainEvent):
    """Event raised when a dashboard widget is updated."""
    
    def __init__(self, dashboard_widget_id: UUID, dashboard_id: UUID, updated_by: UUID):
        super().__init__(
            event_type="dashboard_widget_updated",
            aggregate_id=str(dashboard_widget_id),
            aggregate_type="DashboardWidget",
            data={
                "dashboard_widget_id": str(dashboard_widget_id),
                "dashboard_id": str(dashboard_id),
                "updated_by": str(updated_by),
            }
        )


class DashboardWidgetRemovedEvent(DomainEvent):
    """Event raised when a widget is removed from a dashboard."""
    
    def __init__(self, dashboard_widget_id: UUID, dashboard_id: UUID, widget_id: UUID):
        super().__init__(
            event_type="dashboard_widget_removed",
            aggregate_id=str(dashboard_widget_id),
            aggregate_type="DashboardWidget",
            data={
                "dashboard_widget_id": str(dashboard_widget_id),
                "dashboard_id": str(dashboard_id),
                "widget_id": str(widget_id),
            }
        )


class DashboardWidget(DashboardWidget):
    """Dashboard widget domain entity."""
    
    # Basic information
    dashboard_id: UUID = Field(..., description="Dashboard ID")
    widget_id: UUID = Field(..., description="Widget ID")
    title: str = Field(..., min_length=1, max_length=255, description="Widget title")
    
    # Position and size
    position_x: int = Field(default=0, ge=0, description="X position")
    position_y: int = Field(default=0, ge=0, description="Y position")
    width: int = Field(default=6, ge=1, le=12, description="Width in grid units")
    height: int = Field(default=4, ge=1, le=20, description="Height in grid units")
    
    # Configuration
    config: Dict[str, Any] = Field(default_factory=dict, description="Widget configuration")
    data_source_id: Optional[UUID] = Field(default=None, description="Data source ID")
    
    # State
    is_visible: bool = Field(default=True, description="Visibility status")
    refresh_interval: int = Field(default=0, ge=0, description="Refresh interval in seconds")
    last_refresh: Optional[datetime] = Field(default=None, description="Last refresh time")
    
    @validator("title")
    def validate_title(cls, v):
        """Validate widget title."""
        if not v.strip():
            raise ValidationError(
                field="title",
                value=v,
                reason="Widget title cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("width")
    def validate_width(cls, v):
        """Validate widget width."""
        if v < 1 or v > 12:
            raise ValidationError(
                field="width",
                value=v,
                reason="Width must be between 1 and 12 grid units"
            )
        return v
    
    @validator("height")
    def validate_height(cls, v):
        """Validate widget height."""
        if v < 1 or v > 20:
            raise ValidationError(
                field="height",
                value=v,
                reason="Height must be between 1 and 20 grid units"
            )
        return v
    
    @validator("refresh_interval")
    def validate_refresh_interval(cls, v):
        """Validate refresh interval."""
        if v < 0:
            raise ValidationError(
                field="refresh_interval",
                value=v,
                reason="Refresh interval cannot be negative"
            )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the dashboard widget."""
        # Check if widget is positioned within reasonable bounds
        if self.position_x < 0 or self.position_y < 0:
            raise BusinessRuleViolation(
                "Widget position cannot be negative",
                {"position_x": self.position_x, "position_y": self.position_y}
            )
        
        # Check if widget size is reasonable
        if self.width <= 0 or self.height <= 0:
            raise BusinessRuleViolation(
                "Widget size must be positive",
                {"width": self.width, "height": self.height}
            )
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if dashboard widget can be edited by user."""
        # This would need to check dashboard permissions
        # For now, assume any authenticated user can edit
        return True
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if dashboard widget can be deleted by user."""
        # This would need to check dashboard permissions
        # For now, assume any authenticated user can delete
        return True
    
    def update_title(self, new_title: str, updated_by: UUID) -> None:
        """Update widget title."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.title = new_title
        self.mark_as_updated()
        self.add_domain_event(DashboardWidgetUpdatedEvent(self.id, self.dashboard_id, updated_by))
    
    def update_position(self, x: int, y: int, updated_by: UUID) -> None:
        """Update widget position."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.position_x = x
        self.position_y = y
        self.mark_as_updated()
        self.add_domain_event(DashboardWidgetUpdatedEvent(self.id, self.dashboard_id, updated_by))
    
    def update_size(self, width: int, height: int, updated_by: UUID) -> None:
        """Update widget size."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.width = width
        self.height = height
        self.mark_as_updated()
        self.add_domain_event(DashboardWidgetUpdatedEvent(self.id, self.dashboard_id, updated_by))
    
    def update_config(self, new_config: Dict[str, Any], updated_by: UUID) -> None:
        """Update widget configuration."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.config = new_config
        self.mark_as_updated()
        self.add_domain_event(DashboardWidgetUpdatedEvent(self.id, self.dashboard_id, updated_by))
    
    def set_data_source(self, data_source_id: Optional[UUID], updated_by: UUID) -> None:
        """Set widget data source."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.data_source_id = data_source_id
        self.mark_as_updated()
        self.add_domain_event(DashboardWidgetUpdatedEvent(self.id, self.dashboard_id, updated_by))
    
    def set_visibility(self, is_visible: bool, updated_by: UUID) -> None:
        """Set widget visibility."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.is_visible = is_visible
        self.mark_as_updated()
        self.add_domain_event(DashboardWidgetUpdatedEvent(self.id, self.dashboard_id, updated_by))
    
    def set_refresh_interval(self, interval: int, updated_by: UUID) -> None:
        """Set widget refresh interval."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.refresh_interval = interval
        self.mark_as_updated()
        self.add_domain_event(DashboardWidgetUpdatedEvent(self.id, self.dashboard_id, updated_by))
    
    def refresh(self) -> None:
        """Mark widget as refreshed."""
        self.last_refresh = datetime.utcnow()
        self.mark_as_updated()
    
    def needs_refresh(self) -> bool:
        """Check if widget needs refresh."""
        if self.refresh_interval == 0:
            return False
        
        if self.last_refresh is None:
            return True
        
        time_since_refresh = (datetime.utcnow() - self.last_refresh).total_seconds()
        return time_since_refresh >= self.refresh_interval
    
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key."""
        return self.config.get(key, default)
    
    def set_config_value(self, key: str, value: Any) -> None:
        """Set configuration value by key."""
        self.config[key] = value
        self.mark_as_updated()
    
    def remove_config_value(self, key: str) -> None:
        """Remove configuration value by key."""
        if key in self.config:
            del self.config[key]
            self.mark_as_updated()
    
    def is_visible(self) -> bool:
        """Check if widget is visible."""
        return self.is_visible
    
    def has_data_source(self) -> bool:
        """Check if widget has a data source."""
        return self.data_source_id is not None
    
    def get_position(self) -> tuple[int, int]:
        """Get widget position."""
        return (self.position_x, self.position_y)
    
    def get_size(self) -> tuple[int, int]:
        """Get widget size."""
        return (self.width, self.height)
    
    @classmethod
    def create(
        cls,
        dashboard_id: UUID,
        widget_id: UUID,
        title: str,
        position_x: int = 0,
        position_y: int = 0,
        width: int = 6,
        height: int = 4,
        config: Optional[Dict[str, Any]] = None,
        data_source_id: Optional[UUID] = None,
        refresh_interval: int = 0,
    ) -> "DashboardWidget":
        """Create a new dashboard widget."""
        dashboard_widget = cls(
            dashboard_id=dashboard_id,
            widget_id=widget_id,
            title=title,
            position_x=position_x,
            position_y=position_y,
            width=width,
            height=height,
            config=config or {},
            data_source_id=data_source_id,
            refresh_interval=refresh_interval,
        )
        
        # Validate business rules
        dashboard_widget.validate_business_rules()
        
        # Add domain event
        dashboard_widget.add_domain_event(DashboardWidgetAddedEvent(
            dashboard_widget.id, dashboard_id, widget_id, title
        ))
        
        return dashboard_widget
