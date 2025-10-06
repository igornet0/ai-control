"""
Organization domain entity.
Represents an organization in the system.
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import ValidationError


class OrganizationCreatedEvent(DomainEvent):
    """Event raised when an organization is created."""
    
    def __init__(self, organization_id: UUID, name: str, domain: Optional[str]):
        super().__init__(
            event_type="organization_created",
            aggregate_id=str(organization_id),
            aggregate_type="Organization",
            data={
                "organization_id": str(organization_id),
                "name": name,
                "domain": domain,
            }
        )


class OrganizationUpdatedEvent(DomainEvent):
    """Event raised when an organization is updated."""
    
    def __init__(self, organization_id: UUID, changes: dict):
        super().__init__(
            event_type="organization_updated",
            aggregate_id=str(organization_id),
            aggregate_type="Organization",
            data={
                "organization_id": str(organization_id),
                "changes": changes,
            }
        )


class Organization(AggregateRoot):
    """Organization domain entity."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")
    description: Optional[str] = Field(default=None, description="Organization description")
    domain: Optional[str] = Field(default=None, max_length=255, description="Organization domain")
    logo_url: Optional[str] = Field(default=None, max_length=500, description="Logo URL")
    
    # Settings as JSON
    settings: Dict[str, any] = Field(default_factory=dict, description="Organization settings")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate organization name."""
        if not v.strip():
            raise ValidationError(
                field="name",
                value=v,
                reason="Organization name cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("domain")
    def validate_domain(cls, v):
        """Validate domain format."""
        if v is not None:
            v = v.strip().lower()
            if not v:
                return None
            
            # Basic domain validation
            if "." not in v or len(v.split(".")) < 2:
                raise ValidationError(
                    field="domain",
                    value=v,
                    reason="Domain must be a valid domain name"
                )
        return v
    
    @validator("logo_url")
    def validate_logo_url(cls, v):
        """Validate logo URL format."""
        if v is not None:
            v = v.strip()
            if not v:
                return None
            
            # Basic URL validation
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValidationError(
                    field="logo_url",
                    value=v,
                    reason="Logo URL must start with http:// or https://"
                )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the organization."""
        # Add any organization-specific business rules here
        pass
    
    def update_info(
        self,
        name: Optional[str] = None,
        description: Optional[str] = None,
        domain: Optional[str] = None,
        logo_url: Optional[str] = None,
    ) -> None:
        """Update organization information."""
        changes = {}
        
        if name is not None and name != self.name:
            self.name = name
            changes["name"] = name
        
        if description is not None and description != self.description:
            self.description = description
            changes["description"] = description
        
        if domain is not None and domain != self.domain:
            self.domain = domain
            changes["domain"] = domain
        
        if logo_url is not None and logo_url != self.logo_url:
            self.logo_url = logo_url
            changes["logo_url"] = logo_url
        
        if changes:
            self.mark_as_updated()
            self.add_domain_event(OrganizationUpdatedEvent(self.id, changes))
    
    def update_settings(self, settings: Dict[str, any]) -> None:
        """Update organization settings."""
        if settings != self.settings:
            old_settings = self.settings.copy()
            self.settings = settings
            
            self.mark_as_updated()
            self.add_domain_event(OrganizationUpdatedEvent(
                self.id,
                {
                    "settings": {
                        "old": old_settings,
                        "new": settings,
                    }
                }
            ))
    
    def get_setting(self, key: str, default: any = None) -> any:
        """Get a specific setting value."""
        return self.settings.get(key, default)
    
    def set_setting(self, key: str, value: any) -> None:
        """Set a specific setting value."""
        if self.settings.get(key) != value:
            old_value = self.settings.get(key)
            self.settings[key] = value
            
            self.mark_as_updated()
            self.add_domain_event(OrganizationUpdatedEvent(
                self.id,
                {
                    "settings": {
                        "key": key,
                        "old_value": old_value,
                        "new_value": value,
                    }
                }
            ))
    
    @classmethod
    def create(
        cls,
        name: str,
        description: Optional[str] = None,
        domain: Optional[str] = None,
        logo_url: Optional[str] = None,
        settings: Optional[Dict[str, any]] = None,
    ) -> "Organization":
        """Create a new organization."""
        organization = cls(
            name=name,
            description=description,
            domain=domain,
            logo_url=logo_url,
            settings=settings or {},
        )
        
        # Validate business rules
        organization.validate_business_rules()
        
        # Add domain event
        organization.add_domain_event(OrganizationCreatedEvent(
            organization.id,
            name,
            domain
        ))
        
        return organization
