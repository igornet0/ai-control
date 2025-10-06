"""
Dashboard domain entity.
Represents a dashboard in the system with business logic and validation.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class DashboardCreatedEvent(DomainEvent):
    """Event raised when a dashboard is created."""
    
    def __init__(self, dashboard_id: UUID, name: str, user_id: UUID, is_public: bool):
        super().__init__(
            event_type="dashboard_created",
            aggregate_id=str(dashboard_id),
            aggregate_type="Dashboard",
            data={
                "dashboard_id": str(dashboard_id),
                "name": name,
                "user_id": str(user_id),
                "is_public": is_public,
            }
        )


class DashboardUpdatedEvent(DomainEvent):
    """Event raised when a dashboard is updated."""
    
    def __init__(self, dashboard_id: UUID, updated_by: UUID):
        super().__init__(
            event_type="dashboard_updated",
            aggregate_id=str(dashboard_id),
            aggregate_type="Dashboard",
            data={
                "dashboard_id": str(dashboard_id),
                "updated_by": str(updated_by),
            }
        )


class DashboardSharedEvent(DomainEvent):
    """Event raised when a dashboard is shared."""
    
    def __init__(self, dashboard_id: UUID, shared_by: UUID, shared_with: UUID, permissions: Dict[str, bool]):
        super().__init__(
            event_type="dashboard_shared",
            aggregate_id=str(dashboard_id),
            aggregate_type="Dashboard",
            data={
                "dashboard_id": str(dashboard_id),
                "shared_by": str(shared_by),
                "shared_with": str(shared_with),
                "permissions": permissions,
            }
        )


class Dashboard(Dashboard):
    """Dashboard domain entity."""
    
    # Basic information
    name: str = Field(..., min_length=1, max_length=255, description="Dashboard name")
    description: Optional[str] = Field(default=None, description="Dashboard description")
    theme: str = Field(default="default", description="Dashboard theme")
    
    # Visibility and sharing
    is_public: bool = Field(default=False, description="Public dashboard flag")
    is_template: bool = Field(default=False, description="Template dashboard flag")
    
    # Layout configuration
    layout_config: Dict[str, Any] = Field(default_factory=dict, description="Layout configuration")
    
    # User and organizational context
    user_id: UUID = Field(..., description="Dashboard owner ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate dashboard name."""
        if not v.strip():
            raise ValidationError(
                field="name",
                value=v,
                reason="Dashboard name cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("theme")
    def validate_theme(cls, v):
        """Validate dashboard theme."""
        valid_themes = ["default", "dark", "light", "blue", "green", "red"]
        if v not in valid_themes:
            raise ValidationError(
                field="theme",
                value=v,
                reason=f"Theme must be one of: {', '.join(valid_themes)}"
            )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the dashboard."""
        # Check if template dashboard can be public
        if self.is_template and self.is_public:
            raise BusinessRuleViolation(
                "Template dashboards cannot be public",
                {"is_template": self.is_template, "is_public": self.is_public}
            )
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if dashboard can be edited by user."""
        # Owner can always edit
        if user_id == self.user_id:
            return True
        
        # Add more business logic for shared dashboards
        return False
    
    def can_be_viewed_by(self, user_id: UUID) -> bool:
        """Check if dashboard can be viewed by user."""
        # Owner can always view
        if user_id == self.user_id:
            return True
        
        # Public dashboards can be viewed by anyone
        if self.is_public:
            return True
        
        # Add more business logic for shared dashboards
        return False
    
    def can_be_shared_by(self, user_id: UUID) -> bool:
        """Check if dashboard can be shared by user."""
        # Owner can always share
        if user_id == self.user_id:
            return True
        
        # Add more business logic for shared dashboards
        return False
    
    def update_name(self, new_name: str, updated_by: UUID) -> None:
        """Update dashboard name."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this dashboard",
                {"user_id": str(updated_by), "dashboard_id": str(self.id)}
            )
        
        self.name = new_name
        self.mark_as_updated()
        self.add_domain_event(DashboardUpdatedEvent(self.id, updated_by))
    
    def update_description(self, new_description: Optional[str], updated_by: UUID) -> None:
        """Update dashboard description."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this dashboard",
                {"user_id": str(updated_by), "dashboard_id": str(self.id)}
            )
        
        self.description = new_description
        self.mark_as_updated()
        self.add_domain_event(DashboardUpdatedEvent(self.id, updated_by))
    
    def update_theme(self, new_theme: str, updated_by: UUID) -> None:
        """Update dashboard theme."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this dashboard",
                {"user_id": str(updated_by), "dashboard_id": str(self.id)}
            )
        
        self.theme = new_theme
        self.mark_as_updated()
        self.add_domain_event(DashboardUpdatedEvent(self.id, updated_by))
    
    def update_layout_config(self, new_layout_config: Dict[str, Any], updated_by: UUID) -> None:
        """Update dashboard layout configuration."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this dashboard",
                {"user_id": str(updated_by), "dashboard_id": str(self.id)}
            )
        
        self.layout_config = new_layout_config
        self.mark_as_updated()
        self.add_domain_event(DashboardUpdatedEvent(self.id, updated_by))
    
    def set_public(self, is_public: bool, updated_by: UUID) -> None:
        """Set dashboard public status."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this dashboard",
                {"user_id": str(updated_by), "dashboard_id": str(self.id)}
            )
        
        # Check business rules
        if is_public and self.is_template:
            raise BusinessRuleViolation(
                "Template dashboards cannot be public",
                {"is_template": self.is_template, "is_public": is_public}
            )
        
        self.is_public = is_public
        self.mark_as_updated()
        self.add_domain_event(DashboardUpdatedEvent(self.id, updated_by))
    
    def set_template(self, is_template: bool, updated_by: UUID) -> None:
        """Set dashboard template status."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this dashboard",
                {"user_id": str(updated_by), "dashboard_id": str(self.id)}
            )
        
        # Check business rules
        if is_template and self.is_public:
            raise BusinessRuleViolation(
                "Template dashboards cannot be public",
                {"is_template": is_template, "is_public": self.is_public}
            )
        
        self.is_template = is_template
        self.mark_as_updated()
        self.add_domain_event(DashboardUpdatedEvent(self.id, updated_by))
    
    def share_with_user(self, user_id: UUID, permissions: Dict[str, bool], shared_by: UUID) -> None:
        """Share dashboard with user."""
        if not self.can_be_shared_by(shared_by):
            raise BusinessRuleViolation(
                f"User {shared_by} cannot share this dashboard",
                {"user_id": str(shared_by), "dashboard_id": str(self.id)}
            )
        
        # Validate permissions
        valid_permissions = ["can_view", "can_edit", "can_share"]
        for permission in permissions:
            if permission not in valid_permissions:
                raise ValidationError(
                    field="permissions",
                    value=permission,
                    reason=f"Invalid permission: {permission}. Valid permissions: {', '.join(valid_permissions)}"
                )
        
        # Add domain event
        self.add_domain_event(DashboardSharedEvent(self.id, shared_by, user_id, permissions))
    
    def is_owner(self, user_id: UUID) -> bool:
        """Check if user is the owner of the dashboard."""
        return user_id == self.user_id
    
    def is_shared(self) -> bool:
        """Check if dashboard is shared with other users."""
        # This would need to be implemented with actual sharing logic
        return False
    
    def get_widget_count(self) -> int:
        """Get the number of widgets in the dashboard."""
        # This would need to be implemented with actual widget counting
        return 0
    
    def get_data_source_count(self) -> int:
        """Get the number of data sources in the dashboard."""
        # This would need to be implemented with actual data source counting
        return 0
    
    @classmethod
    def create(
        cls,
        name: str,
        user_id: UUID,
        description: Optional[str] = None,
        theme: str = "default",
        is_public: bool = False,
        is_template: bool = False,
        layout_config: Optional[Dict[str, Any]] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
    ) -> "Dashboard":
        """Create a new dashboard."""
        dashboard = cls(
            name=name,
            description=description,
            theme=theme,
            is_public=is_public,
            is_template=is_template,
            layout_config=layout_config or {},
            user_id=user_id,
            organization_id=organization_id,
            department_id=department_id,
        )
        
        # Validate business rules
        dashboard.validate_business_rules()
        
        # Add domain event
        dashboard.add_domain_event(DashboardCreatedEvent(dashboard.id, name, user_id, is_public))
        
        return dashboard
