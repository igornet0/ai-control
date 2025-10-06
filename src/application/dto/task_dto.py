"""
Task Data Transfer Objects.
DTOs for task-related operations.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, validator

from src.domain.task_management.entities.task import TaskStatus, TaskPriority, TaskType, TaskVisibility


class TaskCreateDTO(BaseModel):
    """DTO for creating a task."""
    
    title: str = Field(..., min_length=1, max_length=255, description="Task title")
    description: Optional[str] = Field(default=None, description="Task description")
    task_type: TaskType = Field(default=TaskType.TASK, description="Task type")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task priority")
    visibility: TaskVisibility = Field(default=TaskVisibility.TEAM, description="Task visibility")
    due_date: Optional[datetime] = Field(default=None, description="Due date")
    start_date: Optional[datetime] = Field(default=None, description="Start date")
    estimated_hours: Optional[float] = Field(default=None, ge=0, description="Estimated hours")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    parent_id: Optional[UUID] = Field(default=None, description="Parent task ID")
    epic_id: Optional[UUID] = Field(default=None, description="Epic task ID")
    tags: List[str] = Field(default_factory=list, description="Task tags")
    custom_fields: Dict[str, Any] = Field(default_factory=dict, description="Custom fields")
    
    @validator("title")
    def validate_title(cls, v):
        """Validate task title."""
        if not v.strip():
            raise ValueError("Task title cannot be empty or only whitespace")
        return v.strip()
    
    @validator("estimated_hours")
    def validate_estimated_hours(cls, v):
        """Validate estimated hours."""
        if v is not None and v < 0:
            raise ValueError("Estimated hours cannot be negative")
        return v
    
    @validator("due_date")
    def validate_due_date(cls, v, values):
        """Validate due date."""
        if v is not None and "start_date" in values and values["start_date"] is not None:
            if v < values["start_date"]:
                raise ValueError("Due date cannot be before start date")
        return v


class TaskUpdateDTO(BaseModel):
    """DTO for updating a task."""
    
    title: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Task title")
    description: Optional[str] = Field(default=None, description="Task description")
    status: Optional[TaskStatus] = Field(default=None, description="Task status")
    priority: Optional[TaskPriority] = Field(default=None, description="Task priority")
    task_type: Optional[TaskType] = Field(default=None, description="Task type")
    visibility: Optional[TaskVisibility] = Field(default=None, description="Task visibility")
    due_date: Optional[datetime] = Field(default=None, description="Due date")
    start_date: Optional[datetime] = Field(default=None, description="Start date")
    estimated_hours: Optional[float] = Field(default=None, ge=0, description="Estimated hours")
    executor_id: Optional[UUID] = Field(default=None, description="Executor ID")
    reviewer_id: Optional[UUID] = Field(default=None, description="Reviewer ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    parent_id: Optional[UUID] = Field(default=None, description="Parent task ID")
    epic_id: Optional[UUID] = Field(default=None, description="Epic task ID")
    tags: Optional[List[str]] = Field(default=None, description="Task tags")
    custom_fields: Optional[Dict[str, Any]] = Field(default=None, description="Custom fields")
    
    @validator("title")
    def validate_title(cls, v):
        """Validate task title."""
        if v is not None and not v.strip():
            raise ValueError("Task title cannot be empty or only whitespace")
        return v.strip() if v else v
    
    @validator("estimated_hours")
    def validate_estimated_hours(cls, v):
        """Validate estimated hours."""
        if v is not None and v < 0:
            raise ValueError("Estimated hours cannot be negative")
        return v
    
    @validator("due_date")
    def validate_due_date(cls, v, values):
        """Validate due date."""
        if v is not None and "start_date" in values and values["start_date"] is not None:
            if v < values["start_date"]:
                raise ValueError("Due date cannot be before start date")
        return v


class TaskResponseDTO(BaseModel):
    """DTO for task response."""
    
    id: UUID = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(default=None, description="Task description")
    status: TaskStatus = Field(..., description="Task status")
    priority: TaskPriority = Field(..., description="Task priority")
    task_type: TaskType = Field(..., description="Task type")
    visibility: TaskVisibility = Field(..., description="Task visibility")
    
    # Hierarchy
    parent_id: Optional[UUID] = Field(default=None, description="Parent task ID")
    epic_id: Optional[UUID] = Field(default=None, description="Epic task ID")
    
    # Time tracking
    due_date: Optional[datetime] = Field(default=None, description="Due date")
    start_date: Optional[datetime] = Field(default=None, description="Start date")
    completed_at: Optional[datetime] = Field(default=None, description="Completion date")
    
    # Estimates and progress
    estimated_hours: Optional[float] = Field(default=None, description="Estimated hours")
    actual_hours: Optional[float] = Field(default=None, description="Actual hours")
    progress_percentage: int = Field(..., description="Progress percentage")
    
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
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True


class TaskListResponseDTO(BaseModel):
    """DTO for task list response."""
    
    tasks: List[TaskResponseDTO] = Field(..., description="List of tasks")
    total_count: int = Field(..., description="Total number of tasks")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")
    
    class Config:
        from_attributes = True


class TaskCommentCreateDTO(BaseModel):
    """DTO for creating a task comment."""
    
    content: str = Field(..., min_length=1, description="Comment content")
    is_internal: bool = Field(default=False, description="Internal comment flag")
    
    @validator("content")
    def validate_content(cls, v):
        """Validate comment content."""
        if not v.strip():
            raise ValueError("Comment content cannot be empty or only whitespace")
        return v.strip()


class TaskCommentResponseDTO(BaseModel):
    """DTO for task comment response."""
    
    id: UUID = Field(..., description="Comment ID")
    task_id: UUID = Field(..., description="Task ID")
    author_id: UUID = Field(..., description="Author ID")
    content: str = Field(..., description="Comment content")
    is_internal: bool = Field(..., description="Internal comment flag")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True


class TaskTimeLogCreateDTO(BaseModel):
    """DTO for creating a task time log."""
    
    hours: float = Field(..., gt=0, description="Hours logged")
    description: Optional[str] = Field(default=None, description="Time log description")
    start_time: datetime = Field(..., description="Start time")
    end_time: Optional[datetime] = Field(default=None, description="End time")
    
    @validator("hours")
    def validate_hours(cls, v):
        """Validate logged hours."""
        if v <= 0:
            raise ValueError("Logged hours must be positive")
        if v > 24:
            raise ValueError("Cannot log more than 24 hours in a single entry")
        return v
    
    @validator("end_time")
    def validate_end_time(cls, v, values):
        """Validate end time."""
        if v is not None and "start_time" in values:
            if v <= values["start_time"]:
                raise ValueError("End time must be after start time")
        return v


class TaskTimeLogResponseDTO(BaseModel):
    """DTO for task time log response."""
    
    id: UUID = Field(..., description="Time log ID")
    task_id: UUID = Field(..., description="Task ID")
    user_id: UUID = Field(..., description="User ID")
    hours: float = Field(..., description="Hours logged")
    description: Optional[str] = Field(default=None, description="Time log description")
    start_time: datetime = Field(..., description="Start time")
    end_time: Optional[datetime] = Field(default=None, description="End time")
    created_at: datetime = Field(..., description="Creation timestamp")
    
    class Config:
        from_attributes = True


class TaskDependencyCreateDTO(BaseModel):
    """DTO for creating a task dependency."""
    
    depends_on_task_id: UUID = Field(..., description="Task ID that this task depends on")
    dependency_type: str = Field(default="blocks", description="Dependency type")


class TaskDependencyResponseDTO(BaseModel):
    """DTO for task dependency response."""
    
    id: UUID = Field(..., description="Dependency ID")
    task_id: UUID = Field(..., description="Task ID")
    depends_on_task_id: UUID = Field(..., description="Task ID that this task depends on")
    dependency_type: str = Field(..., description="Dependency type")
    created_at: datetime = Field(..., description="Creation timestamp")
    
    class Config:
        from_attributes = True


class TaskWatcherCreateDTO(BaseModel):
    """DTO for creating a task watcher."""
    
    notification_preferences: Dict[str, Any] = Field(default_factory=dict, description="Notification preferences")


class TaskWatcherResponseDTO(BaseModel):
    """DTO for task watcher response."""
    
    id: UUID = Field(..., description="Watcher ID")
    task_id: UUID = Field(..., description="Task ID")
    user_id: UUID = Field(..., description="User ID")
    notification_preferences: Dict[str, Any] = Field(..., description="Notification preferences")
    created_at: datetime = Field(..., description="Creation timestamp")
    
    class Config:
        from_attributes = True


class TaskLabelCreateDTO(BaseModel):
    """DTO for creating a task label."""
    
    name: str = Field(..., min_length=1, max_length=100, description="Label name")
    color: str = Field(default="#007bff", description="Label color (HEX)")
    description: Optional[str] = Field(default=None, max_length=255, description="Label description")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate label name."""
        if not v.strip():
            raise ValueError("Label name cannot be empty or only whitespace")
        return v.strip()
    
    @validator("color")
    def validate_color(cls, v):
        """Validate label color."""
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("Label color must be a valid HEX color (e.g., #007bff)")
        
        # Check if it's a valid hex color
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Label color must be a valid HEX color")
        
        return v


class TaskLabelResponseDTO(BaseModel):
    """DTO for task label response."""
    
    id: UUID = Field(..., description="Label ID")
    task_id: UUID = Field(..., description="Task ID")
    name: str = Field(..., description="Label name")
    color: str = Field(..., description="Label color")
    description: Optional[str] = Field(default=None, description="Label description")
    created_at: datetime = Field(..., description="Creation timestamp")
    
    class Config:
        from_attributes = True


class TaskStatisticsDTO(BaseModel):
    """DTO for task statistics."""
    
    total_tasks: int = Field(..., description="Total number of tasks")
    completed_tasks: int = Field(..., description="Number of completed tasks")
    in_progress_tasks: int = Field(..., description="Number of in-progress tasks")
    overdue_tasks: int = Field(..., description="Number of overdue tasks")
    tasks_by_status: Dict[str, int] = Field(..., description="Tasks grouped by status")
    tasks_by_priority: Dict[str, int] = Field(..., description="Tasks grouped by priority")
    tasks_by_type: Dict[str, int] = Field(..., description="Tasks grouped by type")
    average_completion_time: Optional[float] = Field(default=None, description="Average completion time in hours")
    total_logged_hours: float = Field(..., description="Total logged hours")
    
    class Config:
        from_attributes = True
