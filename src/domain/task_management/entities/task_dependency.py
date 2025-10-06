"""
Task dependency domain entity.
Represents a dependency between tasks with business logic and validation.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import ValidationError, BusinessRuleViolation


class DependencyType(str, Enum):
    """Dependency type enumeration."""
    
    BLOCKS = "blocks"  # This task blocks the dependent task
    REQUIRES = "requires"  # This task requires the dependent task
    RELATES = "relates"  # This task relates to the dependent task


class TaskDependencyCreatedEvent(DomainEvent):
    """Event raised when a task dependency is created."""
    
    def __init__(self, dependency_id: UUID, task_id: UUID, depends_on_task_id: UUID, dependency_type: DependencyType):
        super().__init__(
            event_type="task_dependency_created",
            aggregate_id=str(dependency_id),
            aggregate_type="TaskDependency",
            data={
                "dependency_id": str(dependency_id),
                "task_id": str(task_id),
                "depends_on_task_id": str(depends_on_task_id),
                "dependency_type": dependency_type.value,
            }
        )


class TaskDependencyRemovedEvent(DomainEvent):
    """Event raised when a task dependency is removed."""
    
    def __init__(self, dependency_id: UUID, task_id: UUID, depends_on_task_id: UUID):
        super().__init__(
            event_type="task_dependency_removed",
            aggregate_id=str(dependency_id),
            aggregate_type="TaskDependency",
            data={
                "dependency_id": str(dependency_id),
                "task_id": str(task_id),
                "depends_on_task_id": str(depends_on_task_id),
            }
        )


class TaskDependency(Entity):
    """Task dependency domain entity."""
    
    # Basic information
    task_id: UUID = Field(..., description="Task ID")
    depends_on_task_id: UUID = Field(..., description="Task ID that this task depends on")
    dependency_type: DependencyType = Field(default=DependencyType.BLOCKS, description="Dependency type")
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the dependency."""
        # Check if task is trying to depend on itself
        if self.task_id == self.depends_on_task_id:
            raise BusinessRuleViolation(
                "Task cannot depend on itself",
                {"task_id": str(self.task_id), "depends_on_task_id": str(self.depends_on_task_id)}
            )
    
    def is_blocking_dependency(self) -> bool:
        """Check if this is a blocking dependency."""
        return self.dependency_type == DependencyType.BLOCKS
    
    def is_requirement_dependency(self) -> bool:
        """Check if this is a requirement dependency."""
        return self.dependency_type == DependencyType.REQUIRES
    
    def is_related_dependency(self) -> bool:
        """Check if this is a related dependency."""
        return self.dependency_type == DependencyType.RELATES
    
    def can_be_created_by(self, user_id: UUID) -> bool:
        """Check if dependency can be created by user."""
        # Add business logic for who can create dependencies
        # For now, allow any authenticated user
        return True
    
    def can_be_removed_by(self, user_id: UUID) -> bool:
        """Check if dependency can be removed by user."""
        # Add business logic for who can remove dependencies
        # For now, allow any authenticated user
        return True
    
    @classmethod
    def create(
        cls,
        task_id: UUID,
        depends_on_task_id: UUID,
        dependency_type: DependencyType = DependencyType.BLOCKS,
    ) -> "TaskDependency":
        """Create a new task dependency."""
        dependency = cls(
            task_id=task_id,
            depends_on_task_id=depends_on_task_id,
            dependency_type=dependency_type,
        )
        
        # Validate business rules
        dependency.validate_business_rules()
        
        # Add domain event
        dependency.add_domain_event(TaskDependencyCreatedEvent(
            dependency.id, task_id, depends_on_task_id, dependency_type
        ))
        
        return dependency
