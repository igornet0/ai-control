"""
Task time log domain entity.
Represents time logged on a task with business logic and validation.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import ValidationError, BusinessRuleViolation


class TaskTimeLogCreatedEvent(DomainEvent):
    """Event raised when a task time log is created."""
    
    def __init__(self, time_log_id: UUID, task_id: UUID, user_id: UUID, hours: float):
        super().__init__(
            event_type="task_time_log_created",
            aggregate_id=str(time_log_id),
            aggregate_type="TaskTimeLog",
            data={
                "time_log_id": str(time_log_id),
                "task_id": str(task_id),
                "user_id": str(user_id),
                "hours": hours,
            }
        )


class TaskTimeLogUpdatedEvent(DomainEvent):
    """Event raised when a task time log is updated."""
    
    def __init__(self, time_log_id: UUID, task_id: UUID, user_id: UUID):
        super().__init__(
            event_type="task_time_log_updated",
            aggregate_id=str(time_log_id),
            aggregate_type="TaskTimeLog",
            data={
                "time_log_id": str(time_log_id),
                "task_id": str(task_id),
                "user_id": str(user_id),
            }
        )


class TaskTimeLog(Entity):
    """Task time log domain entity."""
    
    # Basic information
    task_id: UUID = Field(..., description="Task ID")
    user_id: UUID = Field(..., description="User who logged time")
    hours: float = Field(..., gt=0, description="Hours logged")
    description: Optional[str] = Field(default=None, description="Time log description")
    
    # Time tracking
    start_time: datetime = Field(..., description="Start time")
    end_time: Optional[datetime] = Field(default=None, description="End time")
    
    @validator("hours")
    def validate_hours(cls, v):
        """Validate logged hours."""
        if v <= 0:
            raise ValidationError(
                field="hours",
                value=v,
                reason="Logged hours must be positive"
            )
        if v > 24:
            raise ValidationError(
                field="hours",
                value=v,
                reason="Cannot log more than 24 hours in a single entry"
            )
        return v
    
    @validator("end_time")
    def validate_end_time(cls, v, values):
        """Validate end time."""
        if v is not None and "start_time" in values:
            if v <= values["start_time"]:
                raise ValidationError(
                    field="end_time",
                    value=v,
                    reason="End time must be after start time"
                )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the time log."""
        # Check if end time is set and calculate hours
        if self.end_time is not None:
            calculated_hours = (self.end_time - self.start_time).total_seconds() / 3600
            if abs(calculated_hours - self.hours) > 0.1:  # Allow 6 minutes tolerance
                raise BusinessRuleViolation(
                    "Logged hours must match the time difference between start and end time",
                    {
                        "logged_hours": self.hours,
                        "calculated_hours": calculated_hours,
                        "start_time": self.start_time.isoformat(),
                        "end_time": self.end_time.isoformat(),
                    }
                )
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if time log can be edited by user."""
        return user_id == self.user_id
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if time log can be deleted by user."""
        return user_id == self.user_id
    
    def update_hours(self, new_hours: float, updated_by: UUID) -> None:
        """Update logged hours."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this time log"
            )
        
        self.hours = new_hours
        self.mark_as_updated()
        self.add_domain_event(TaskTimeLogUpdatedEvent(self.id, self.task_id, self.user_id))
    
    def update_description(self, new_description: Optional[str], updated_by: UUID) -> None:
        """Update time log description."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this time log"
            )
        
        self.description = new_description
        self.mark_as_updated()
        self.add_domain_event(TaskTimeLogUpdatedEvent(self.id, self.task_id, self.user_id))
    
    def set_end_time(self, end_time: datetime, updated_by: UUID) -> None:
        """Set end time for the time log."""
        if not self.can_be_edited_by(updated_by):
            raise ValidationError(
                field="updated_by",
                value=str(updated_by),
                reason="User cannot edit this time log"
            )
        
        self.end_time = end_time
        self.mark_as_updated()
        self.add_domain_event(TaskTimeLogUpdatedEvent(self.id, self.task_id, self.user_id))
    
    def is_active(self) -> bool:
        """Check if time log is active (no end time)."""
        return self.end_time is None
    
    def get_duration(self) -> Optional[float]:
        """Get duration in hours if end time is set."""
        if self.end_time is None:
            return None
        
        return (self.end_time - self.start_time).total_seconds() / 3600
    
    @classmethod
    def create(
        cls,
        task_id: UUID,
        user_id: UUID,
        hours: float,
        start_time: datetime,
        description: Optional[str] = None,
        end_time: Optional[datetime] = None,
    ) -> "TaskTimeLog":
        """Create a new task time log."""
        time_log = cls(
            task_id=task_id,
            user_id=user_id,
            hours=hours,
            start_time=start_time,
            description=description,
            end_time=end_time,
        )
        
        # Validate business rules
        time_log.validate_business_rules()
        
        # Add domain event
        time_log.add_domain_event(TaskTimeLogCreatedEvent(time_log.id, task_id, user_id, hours))
        
        return time_log
