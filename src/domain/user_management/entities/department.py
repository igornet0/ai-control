"""
Department domain entity.
Represents a department within an organization.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import ValidationError


class DepartmentCreatedEvent(DomainEvent):
    """Event raised when a department is created."""
    
    def __init__(self, department_id: UUID, name: str, organization_id: UUID):
        super().__init__(
            event_type="department_created",
            aggregate_id=str(department_id),
            aggregate_type="Department",
            data={
                "department_id": str(department_id),
                "name": name,
                "organization_id": str(organization_id),
            }
        )


class DepartmentUpdatedEvent(DomainEvent):
    """Event raised when a department is updated."""
    
    def __init__(self, department_id: UUID, changes: dict):
        super().__init__(
            event_type="department_updated",
            aggregate_id=str(department_id),
            aggregate_type="Department",
            data={
                "department_id": str(department_id),
                "changes": changes,
            }
        )


class Department(AggregateRoot):
    """Department domain entity."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Department name")
    description: Optional[str] = Field(default=None, description="Department description")
    organization_id: UUID = Field(..., description="Organization ID")
    manager_id: Optional[UUID] = Field(default=None, description="Department manager ID")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate department name."""
        if not v.strip():
            raise ValidationError(
                field="name",
                value=v,
                reason="Department name cannot be empty or only whitespace"
            )
        return v.strip()
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the department."""
        # Add any department-specific business rules here
        pass
    
    def update_info(
        self,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> None:
        """Update department information."""
        changes = {}
        
        if name is not None and name != self.name:
            self.name = name
            changes["name"] = name
        
        if description is not None and description != self.description:
            self.description = description
            changes["description"] = description
        
        if changes:
            self.mark_as_updated()
            self.add_domain_event(DepartmentUpdatedEvent(self.id, changes))
    
    def assign_manager(self, manager_id: UUID, assigned_by: UUID) -> None:
        """Assign a manager to the department."""
        if manager_id == self.manager_id:
            return
        
        old_manager_id = self.manager_id
        self.manager_id = manager_id
        
        self.mark_as_updated()
        self.add_domain_event(DepartmentUpdatedEvent(
            self.id,
            {
                "manager_id": {
                    "old": str(old_manager_id) if old_manager_id else None,
                    "new": str(manager_id)
                },
                "assigned_by": str(assigned_by),
            }
        ))
    
    def remove_manager(self, removed_by: UUID) -> None:
        """Remove the department manager."""
        if self.manager_id is None:
            return
        
        old_manager_id = self.manager_id
        self.manager_id = None
        
        self.mark_as_updated()
        self.add_domain_event(DepartmentUpdatedEvent(
            self.id,
            {
                "manager_id": {
                    "old": str(old_manager_id),
                    "new": None
                },
                "removed_by": str(removed_by),
            }
        ))
    
    @classmethod
    def create(
        cls,
        name: str,
        organization_id: UUID,
        description: Optional[str] = None,
        manager_id: Optional[UUID] = None,
    ) -> "Department":
        """Create a new department."""
        department = cls(
            name=name,
            organization_id=organization_id,
            description=description,
            manager_id=manager_id,
        )
        
        # Validate business rules
        department.validate_business_rules()
        
        # Add domain event
        department.add_domain_event(DepartmentCreatedEvent(
            department.id,
            name,
            organization_id
        ))
        
        return department
