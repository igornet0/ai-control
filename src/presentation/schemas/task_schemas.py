"""
Task-related API schemas.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from .common_schemas import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema, BaseListResponseSchema, PaginationSchema


class TaskCreateSchema(BaseCreateSchema):
    """Task creation schema."""
    
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    status: str = Field("pending", description="Task status")
    priority: str = Field("medium", description="Task priority")
    assignee_id: Optional[str] = Field(None, description="Assignee ID")
    creator_id: str = Field(..., description="Creator ID")
    due_date: Optional[datetime] = Field(None, description="Due date")
    estimated_hours: Optional[float] = Field(None, ge=0, description="Estimated hours")
    tags: Optional[List[str]] = Field(default_factory=list, description="Task tags")
    project_id: Optional[str] = Field(None, description="Project ID")
    parent_task_id: Optional[str] = Field(None, description="Parent task ID")


class TaskUpdateSchema(BaseUpdateSchema):
    """Task update schema."""
    
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    status: Optional[str] = Field(None, description="Task status")
    priority: Optional[str] = Field(None, description="Task priority")
    assignee_id: Optional[str] = Field(None, description="Assignee ID")
    due_date: Optional[datetime] = Field(None, description="Due date")
    estimated_hours: Optional[float] = Field(None, ge=0, description="Estimated hours")
    tags: Optional[List[str]] = Field(None, description="Task tags")
    project_id: Optional[str] = Field(None, description="Project ID")
    parent_task_id: Optional[str] = Field(None, description="Parent task ID")


class TaskResponseSchema(BaseResponseSchema):
    """Task response schema."""
    
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    status: str = Field(..., description="Task status")
    priority: str = Field(..., description="Task priority")
    assignee_id: Optional[str] = Field(None, description="Assignee ID")
    creator_id: str = Field(..., description="Creator ID")
    due_date: Optional[datetime] = Field(None, description="Due date")
    estimated_hours: Optional[float] = Field(None, description="Estimated hours")
    actual_hours: Optional[float] = Field(None, description="Actual hours")
    tags: List[str] = Field(default_factory=list, description="Task tags")
    project_id: Optional[str] = Field(None, description="Project ID")
    parent_task_id: Optional[str] = Field(None, description="Parent task ID")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")


class TaskListResponseSchema(BaseListResponseSchema):
    """Task list response schema."""
    
    items: List[TaskResponseSchema] = Field(..., description="List of tasks")
    pagination: PaginationSchema = Field(..., description="Pagination information")


class TaskCommentCreateSchema(BaseCreateSchema):
    """Task comment creation schema."""
    
    task_id: str = Field(..., description="Task ID")
    user_id: str = Field(..., description="User ID")
    content: str = Field(..., min_length=1, description="Comment content")
    parent_comment_id: Optional[str] = Field(None, description="Parent comment ID")


class TaskCommentResponseSchema(BaseResponseSchema):
    """Task comment response schema."""
    
    task_id: str = Field(..., description="Task ID")
    user_id: str = Field(..., description="User ID")
    content: str = Field(..., description="Comment content")
    parent_comment_id: Optional[str] = Field(None, description="Parent comment ID")
    user_name: Optional[str] = Field(None, description="User name")


class TaskTimeLogCreateSchema(BaseCreateSchema):
    """Task time log creation schema."""
    
    task_id: str = Field(..., description="Task ID")
    user_id: str = Field(..., description="User ID")
    start_time: datetime = Field(..., description="Start time")
    end_time: Optional[datetime] = Field(None, description="End time")
    description: Optional[str] = Field(None, description="Time log description")


class TaskTimeLogResponseSchema(BaseResponseSchema):
    """Task time log response schema."""
    
    task_id: str = Field(..., description="Task ID")
    user_id: str = Field(..., description="User ID")
    start_time: datetime = Field(..., description="Start time")
    end_time: Optional[datetime] = Field(None, description="End time")
    duration: Optional[float] = Field(None, description="Duration in hours")
    description: Optional[str] = Field(None, description="Time log description")
    user_name: Optional[str] = Field(None, description="User name")


class TaskDependencySchema(BaseModel):
    """Task dependency schema."""
    
    task_id: str = Field(..., description="Task ID")
    depends_on_task_id: str = Field(..., description="Dependency task ID")
    dependency_type: str = Field(..., description="Dependency type")


class TaskWatcherSchema(BaseModel):
    """Task watcher schema."""
    
    task_id: str = Field(..., description="Task ID")
    user_id: str = Field(..., description="User ID")
    user_name: Optional[str] = Field(None, description="User name")


class TaskLabelSchema(BaseModel):
    """Task label schema."""
    
    id: str = Field(..., description="Label ID")
    name: str = Field(..., description="Label name")
    color: str = Field(..., description="Label color")
    description: Optional[str] = Field(None, description="Label description")


class TaskFilterSchema(BaseModel):
    """Task filter schema."""
    
    status: Optional[str] = Field(None, description="Filter by status")
    priority: Optional[str] = Field(None, description="Filter by priority")
    assignee_id: Optional[str] = Field(None, description="Filter by assignee")
    creator_id: Optional[str] = Field(None, description="Filter by creator")
    project_id: Optional[str] = Field(None, description="Filter by project")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    due_date_from: Optional[datetime] = Field(None, description="Filter by due date from")
    due_date_to: Optional[datetime] = Field(None, description="Filter by due date to")
    search: Optional[str] = Field(None, description="Search query")
    sort_by: Optional[str] = Field(None, description="Sort field")
    sort_order: Optional[str] = Field("asc", description="Sort order")
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")


class TaskStatisticsSchema(BaseModel):
    """Task statistics schema."""
    
    total_tasks: int = Field(..., description="Total number of tasks")
    pending_tasks: int = Field(..., description="Number of pending tasks")
    in_progress_tasks: int = Field(..., description="Number of in-progress tasks")
    completed_tasks: int = Field(..., description="Number of completed tasks")
    overdue_tasks: int = Field(..., description="Number of overdue tasks")
    total_hours: float = Field(..., description="Total estimated hours")
    actual_hours: float = Field(..., description="Total actual hours")
    completion_rate: float = Field(..., description="Task completion rate")
