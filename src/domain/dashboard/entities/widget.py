"""
Widget domain entity.
Represents a widget template in the system with business logic and validation.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import ValidationError


class WidgetCreatedEvent(DomainEvent):
    """Event raised when a widget is created."""
    
    def __init__(self, widget_id: UUID, name: str, widget_type: str, category: str):
        super().__init__(
            event_type="widget_created",
            aggregate_id=str(widget_id),
            aggregate_type="Widget",
            data={
                "widget_id": str(widget_id),
                "name": name,
                "widget_type": widget_type,
                "category": category,
            }
        )


class WidgetUpdatedEvent(DomainEvent):
    """Event raised when a widget is updated."""
    
    def __init__(self, widget_id: UUID, updated_by: UUID):
        super().__init__(
            event_type="widget_updated",
            aggregate_id=str(widget_id),
            aggregate_type="Widget",
            data={
                "widget_id": str(widget_id),
                "updated_by": str(updated_by),
            }
        )


class Widget(Entity):
    """Widget domain entity."""
    
    # Basic information
    name: str = Field(..., min_length=1, max_length=255, description="Widget name")
    description: Optional[str] = Field(default=None, description="Widget description")
    widget_type: str = Field(..., min_length=1, max_length=100, description="Widget type")
    category: str = Field(..., min_length=1, max_length=100, description="Widget category")
    icon: Optional[str] = Field(default=None, description="Widget icon")
    
    # Configuration
    default_config: Dict[str, Any] = Field(default_factory=dict, description="Default configuration")
    schema: Dict[str, Any] = Field(default_factory=dict, description="JSON schema for configuration")
    
    # Status
    is_active: bool = Field(default=True, description="Active status")
    is_system: bool = Field(default=False, description="System widget flag")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate widget name."""
        if not v.strip():
            raise ValidationError(
                field="name",
                value=v,
                reason="Widget name cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("widget_type")
    def validate_widget_type(cls, v):
        """Validate widget type."""
        valid_types = [
            "chart", "table", "kpi", "text", "image", "map", "gauge", 
            "progress", "list", "card", "metric", "alert", "custom"
        ]
        if v not in valid_types:
            raise ValidationError(
                field="widget_type",
                value=v,
                reason=f"Widget type must be one of: {', '.join(valid_types)}"
            )
        return v
    
    @validator("category")
    def validate_category(cls, v):
        """Validate widget category."""
        valid_categories = [
            "charts", "tables", "kpi", "text", "images", "maps", 
            "gauges", "progress", "lists", "cards", "metrics", "alerts", "custom"
        ]
        if v not in valid_categories:
            raise ValidationError(
                field="category",
                value=v,
                reason=f"Widget category must be one of: {', '.join(valid_categories)}"
            )
        return v
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if widget can be edited by user."""
        # System widgets cannot be edited
        if self.is_system:
            return False
        
        # Add more business logic for user permissions
        return True
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if widget can be deleted by user."""
        # System widgets cannot be deleted
        if self.is_system:
            return False
        
        # Add more business logic for user permissions
        return True
    
    def update_name(self, new_name: str, updated_by: UUID) -> None:
        """Update widget name."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.name = new_name
        self.mark_as_updated()
        self.add_domain_event(WidgetUpdatedEvent(self.id, updated_by))
    
    def update_description(self, new_description: Optional[str], updated_by: UUID) -> None:
        """Update widget description."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.description = new_description
        self.mark_as_updated()
        self.add_domain_event(WidgetUpdatedEvent(self.id, updated_by))
    
    def update_default_config(self, new_config: Dict[str, Any], updated_by: UUID) -> None:
        """Update widget default configuration."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.default_config = new_config
        self.mark_as_updated()
        self.add_domain_event(WidgetUpdatedEvent(self.id, updated_by))
    
    def update_schema(self, new_schema: Dict[str, Any], updated_by: UUID) -> None:
        """Update widget schema."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.schema = new_schema
        self.mark_as_updated()
        self.add_domain_event(WidgetUpdatedEvent(self.id, updated_by))
    
    def set_active(self, is_active: bool, updated_by: UUID) -> None:
        """Set widget active status."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this widget"
            )
        
        self.is_active = is_active
        self.mark_as_updated()
        self.add_domain_event(WidgetUpdatedEvent(self.id, updated_by))
    
    def is_chart_widget(self) -> bool:
        """Check if widget is a chart type."""
        return self.widget_type == "chart"
    
    def is_table_widget(self) -> bool:
        """Check if widget is a table type."""
        return self.widget_type == "table"
    
    def is_kpi_widget(self) -> bool:
        """Check if widget is a KPI type."""
        return self.widget_type == "kpi"
    
    def is_text_widget(self) -> bool:
        """Check if widget is a text type."""
        return self.widget_type == "text"
    
    def is_custom_widget(self) -> bool:
        """Check if widget is a custom type."""
        return self.widget_type == "custom"
    
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key."""
        return self.default_config.get(key, default)
    
    def set_config_value(self, key: str, value: Any) -> None:
        """Set configuration value by key."""
        self.default_config[key] = value
        self.mark_as_updated()
    
    def remove_config_value(self, key: str) -> None:
        """Remove configuration value by key."""
        if key in self.default_config:
            del self.default_config[key]
            self.mark_as_updated()
    
    @classmethod
    def create(
        cls,
        name: str,
        widget_type: str,
        category: str,
        description: Optional[str] = None,
        icon: Optional[str] = None,
        default_config: Optional[Dict[str, Any]] = None,
        schema: Optional[Dict[str, Any]] = None,
        is_system: bool = False,
    ) -> "Widget":
        """Create a new widget."""
        widget = cls(
            name=name,
            description=description,
            widget_type=widget_type,
            category=category,
            icon=icon,
            default_config=default_config or {},
            schema=schema or {},
            is_system=is_system,
        )
        
        # Add domain event
        widget.add_domain_event(WidgetCreatedEvent(widget.id, name, widget_type, category))
        
        return widget
