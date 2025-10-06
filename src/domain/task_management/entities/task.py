"""
Task domain entity.
Represents a task in the system with business logic and validation.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class TaskStatus(str, Enum):
    """Task status enumeration."""
    
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"
    BLOCKED = "blocked"


class TaskPriority(str, Enum):
    """Task priority enumeration."""
    
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    URGENT = "urgent"


class TaskType(str, Enum):
    """Task type enumeration."""
    
    TASK = "task"
    BUG = "bug"
    FEATURE = "feature"
    STORY = "story"
    EPIC = "epic"
    SUBTASK = "subtask"


class TaskVisibility(str, Enum):
    """Task visibility enumeration."""
    
    PUBLIC = "public"
    PRIVATE = "private"
    TEAM = "team"
    DEPARTMENT = "department"
    ORGANIZATION = "organization"


class TaskCreatedEvent(DomainEvent):
    """Event raised when a task is created."""
    
    def __init__(self, task_id: UUID, title: str, owner_id: UUID, task_type: TaskType):
        super().__init__(
            event_type="task_created",
            aggregate_id=str(task_id),
            aggregate_type="Task",
            data={
                "task_id": str(task_id),
                "title": title,
                "owner_id": str(owner_id),
                "task_type": task_type.value,
            }
        )


class TaskStatusChangedEvent(DomainEvent):
    """Event raised when task status changes."""
    
    def __init__(self, task_id: UUID, old_status: TaskStatus, new_status: TaskStatus, changed_by: UUID):
        super().__init__(
            event_type="task_status_changed",
            aggregate_id=str(task_id),
            aggregate_type="Task",
            data={
                "task_id": str(task_id),
                "old_status": old_status.value,
                "new_status": new_status.value,
                "changed_by": str(changed_by),
            }
        )


class TaskAssignedEvent(DomainEvent):
    """Event raised when task is assigned to executor."""
    
    def __init__(self, task_id: UUID, executor_id: UUID, assigned_by: UUID):
        super().__init__(
            event_type="task_assigned",
            aggregate_id=str(task_id),
            aggregate_type="Task",
            data={
                "task_id": str(task_id),
                "executor_id": str(executor_id),
                "assigned_by": str(assigned_by),
            }
        )


class Task(Task):
    """Task domain entity."""
    
    # Basic information
    title: str = Field(..., min_length=1, max_length=255, description="Task title")
    description: Optional[str] = Field(default=None, description="Task description")
    
    # Status and classification
    status: TaskStatus = Field(default=TaskStatus.CREATED, description="Task status")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task priority")
    task_type: TaskType = Field(default=TaskType.TASK, description="Task type")
    visibility: TaskVisibility = Field(default=TaskVisibility.TEAM, description="Task visibility")
    
    # Hierarchy
    parent_id: Optional[UUID] = Field(default=None, description="Parent task ID")
    epic_id: Optional[UUID] = Field(default=None, description="Epic task ID")
    
    # Time tracking
    due_date: Optional[datetime] = Field(default=None, description="Due date")
    start_date: Optional[datetime] = Field(default=None, description="Start date")
    completed_at: Optional[datetime] = Field(default=None, description="Completion date")
    
    # Estimates and progress
    estimated_hours: Optional[float] = Field(default=None, ge=0, description="Estimated hours")
    actual_hours: Optional[float] = Field(default=None, ge=0, description="Actual hours")
    progress_percentage: int = Field(default=0, ge=0, le=100, description="Progress percentage")
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Task tags")
    custom_fields: Dict[str, Any] = Field(default_factory=dict, description="Custom fields")
    attachments: List[str] = Field(default_factory=list, description="Attachment URLs")
    
    # User assignments
    owner_id: UUID = Field(..., description="Task owner ID")
    executor_id: Optional[UUID] = Field(default=None, description="Task executor ID")
    reviewer_id: Optional[UUID] = Field(default=None, description="Task reviewer ID")
    
    # Organizational context
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    @validator("title")
    def validate_title(cls, v):
        """Validate task title."""
        if not v.strip():
            raise ValidationError(
                field="title",
                value=v,
                reason="Task title cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("estimated_hours")
    def validate_estimated_hours(cls, v):
        """Validate estimated hours."""
        if v is not None and v < 0:
            raise ValidationError(
                field="estimated_hours",
                value=v,
                reason="Estimated hours cannot be negative"
            )
        return v
    
    @validator("actual_hours")
    def validate_actual_hours(cls, v):
        """Validate actual hours."""
        if v is not None and v < 0:
            raise ValidationError(
                field="actual_hours",
                value=v,
                reason="Actual hours cannot be negative"
            )
        return v
    
    @validator("due_date")
    def validate_due_date(cls, v, values):
        """Validate due date."""
        if v is not None and "start_date" in values and values["start_date"] is not None:
            if v < values["start_date"]:
                raise ValidationError(
                    field="due_date",
                    value=v,
                    reason="Due date cannot be before start date"
                )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the task."""
        # Check if task is trying to be its own parent
        if self.parent_id == self.id:
            raise BusinessRuleViolation(
                "Task cannot be its own parent",
                {"task_id": str(self.id), "parent_id": str(self.parent_id)}
            )
        
        # Check if task is trying to be its own epic
        if self.epic_id == self.id:
            raise BusinessRuleViolation(
                "Task cannot be its own epic",
                {"task_id": str(self.id), "epic_id": str(self.epic_id)}
            )
        
        # Check if completed task has completion date
        if self.status == TaskStatus.COMPLETED and self.completed_at is None:
            raise BusinessRuleViolation(
                "Completed task must have completion date",
                {"status": self.status.value, "completed_at": self.completed_at}
            )
        
        # Check if non-completed task has no completion date
        if self.status != TaskStatus.COMPLETED and self.completed_at is not None:
            raise BusinessRuleViolation(
                "Non-completed task cannot have completion date",
                {"status": self.status.value, "completed_at": self.completed_at}
            )
        
        # Check progress percentage for completed tasks
        if self.status == TaskStatus.COMPLETED and self.progress_percentage != 100:
            raise BusinessRuleViolation(
                "Completed task must have 100% progress",
                {"status": self.status.value, "progress_percentage": self.progress_percentage}
            )
    
    def can_be_assigned_to(self, user_id: UUID) -> bool:
        """Check if task can be assigned to user."""
        # Basic checks
        if user_id == self.owner_id:
            return False  # Owner cannot be executor
        
        # Add more business rules as needed
        return True
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if task can be edited by user."""
        # Owner can always edit
        if user_id == self.owner_id:
            return True
        
        # Executor can edit if task is in progress
        if user_id == self.executor_id and self.status == TaskStatus.IN_PROGRESS:
            return True
        
        # Reviewer can edit if task is in review
        if user_id == self.reviewer_id and self.status == TaskStatus.REVIEW:
            return True
        
        return False
    
    def can_change_status_to(self, new_status: TaskStatus, user_id: UUID) -> bool:
        """Check if task status can be changed to new status by user."""
        # Owner can change to any status
        if user_id == self.owner_id:
            return True
        
        # Executor can change to in_progress, completed
        if user_id == self.executor_id:
            return new_status in [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED]
        
        # Reviewer can change to review, completed
        if user_id == self.reviewer_id:
            return new_status in [TaskStatus.REVIEW, TaskStatus.COMPLETED]
        
        return False
    
    def change_status(self, new_status: TaskStatus, changed_by: UUID) -> None:
        """Change task status."""
        if new_status == self.status:
            return
        
        if not self.can_change_status_to(new_status, changed_by):
            raise BusinessRuleViolation(
                f"User {changed_by} cannot change task status to {new_status.value}",
                {"user_id": str(changed_by), "new_status": new_status.value}
            )
        
        old_status = self.status
        self.status = new_status
        
        # Set completion date if completed
        if new_status == TaskStatus.COMPLETED:
            self.completed_at = datetime.utcnow()
            self.progress_percentage = 100
        elif old_status == TaskStatus.COMPLETED:
            self.completed_at = None
        
        # Validate business rules after status change
        self.validate_business_rules()
        
        self.mark_as_updated()
        self.add_domain_event(TaskStatusChangedEvent(self.id, old_status, new_status, changed_by))
    
    def assign_to(self, executor_id: UUID, assigned_by: UUID) -> None:
        """Assign task to executor."""
        if executor_id == self.executor_id:
            return
        
        if not self.can_be_assigned_to(executor_id):
            raise BusinessRuleViolation(
                f"Task cannot be assigned to user {executor_id}",
                {"executor_id": str(executor_id)}
            )
        
        old_executor_id = self.executor_id
        self.executor_id = executor_id
        
        # If task is created and assigned, move to in_progress
        if self.status == TaskStatus.CREATED:
            self.status = TaskStatus.IN_PROGRESS
        
        self.mark_as_updated()
        self.add_domain_event(TaskAssignedEvent(self.id, executor_id, assigned_by))
    
    def update_progress(self, progress_percentage: int, updated_by: UUID) -> None:
        """Update task progress."""
        if not (0 <= progress_percentage <= 100):
            raise ValidationError(
                field="progress_percentage",
                value=progress_percentage,
                reason="Progress percentage must be between 0 and 100"
            )
        
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot update task progress",
                {"user_id": str(updated_by)}
            )
        
        self.progress_percentage = progress_percentage
        
        # Auto-complete if progress is 100%
        if progress_percentage == 100 and self.status != TaskStatus.COMPLETED:
            self.change_status(TaskStatus.COMPLETED, updated_by)
        else:
            self.mark_as_updated()
    
    def log_time(self, hours: float, user_id: UUID) -> None:
        """Log time spent on task."""
        if hours <= 0:
            raise ValidationError(
                field="hours",
                value=hours,
                reason="Logged hours must be positive"
            )
        
        if self.actual_hours is None:
            self.actual_hours = 0
        
        self.actual_hours += hours
        self.mark_as_updated()
    
    def add_tag(self, tag: str) -> None:
        """Add tag to task."""
        if tag not in self.tags:
            self.tags.append(tag)
            self.mark_as_updated()
    
    def remove_tag(self, tag: str) -> None:
        """Remove tag from task."""
        if tag in self.tags:
            self.tags.remove(tag)
            self.mark_as_updated()
    
    def set_custom_field(self, key: str, value: Any) -> None:
        """Set custom field value."""
        self.custom_fields[key] = value
        self.mark_as_updated()
    
    def remove_custom_field(self, key: str) -> None:
        """Remove custom field."""
        if key in self.custom_fields:
            del self.custom_fields[key]
            self.mark_as_updated()
    
    def add_attachment(self, url: str) -> None:
        """Add attachment URL."""
        if url not in self.attachments:
            self.attachments.append(url)
            self.mark_as_updated()
    
    def remove_attachment(self, url: str) -> None:
        """Remove attachment URL."""
        if url in self.attachments:
            self.attachments.remove(url)
            self.mark_as_updated()
    
    def is_overdue(self) -> bool:
        """Check if task is overdue."""
        if self.due_date is None or self.status == TaskStatus.COMPLETED:
            return False
        
        return datetime.utcnow() > self.due_date
    
    def is_blocked(self) -> bool:
        """Check if task is blocked."""
        return self.status == TaskStatus.BLOCKED
    
    def is_in_progress(self) -> bool:
        """Check if task is in progress."""
        return self.status == TaskStatus.IN_PROGRESS
    
    def is_completed(self) -> bool:
        """Check if task is completed."""
        return self.status == TaskStatus.COMPLETED
    
    @classmethod
    def create(
        cls,
        title: str,
        owner_id: UUID,
        description: Optional[str] = None,
        task_type: TaskType = TaskType.TASK,
        priority: TaskPriority = TaskPriority.MEDIUM,
        visibility: TaskVisibility = TaskVisibility.TEAM,
        due_date: Optional[datetime] = None,
        start_date: Optional[datetime] = None,
        estimated_hours: Optional[float] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        epic_id: Optional[UUID] = None,
    ) -> "Task":
        """Create a new task."""
        task = cls(
            title=title,
            description=description,
            task_type=task_type,
            priority=priority,
            visibility=visibility,
            due_date=due_date,
            start_date=start_date,
            estimated_hours=estimated_hours,
            owner_id=owner_id,
            organization_id=organization_id,
            department_id=department_id,
            parent_id=parent_id,
            epic_id=epic_id,
        )
        
        # Validate business rules
        task.validate_business_rules()
        
        # Add domain event
        task.add_domain_event(TaskCreatedEvent(task.id, title, owner_id, task_type))
        
        return task
