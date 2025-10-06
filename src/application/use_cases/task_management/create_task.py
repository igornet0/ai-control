"""
Create task use case.
Handles the business logic for creating a new task.
"""

from typing import Optional
from uuid import UUID

from src.application.use_cases.base import UseCase
from src.domain.task_management.entities.task import Task, TaskType, TaskPriority, TaskVisibility
from src.domain.task_management.repositories.task_repository import TaskRepository
from src.domain.exceptions import ValidationError, BusinessRuleViolation


class CreateTaskRequest:
    """Request for creating a task."""
    
    def __init__(
        self,
        title: str,
        owner_id: UUID,
        description: Optional[str] = None,
        task_type: TaskType = TaskType.TASK,
        priority: TaskPriority = TaskPriority.MEDIUM,
        visibility: TaskVisibility = TaskVisibility.TEAM,
        due_date: Optional[str] = None,
        start_date: Optional[str] = None,
        estimated_hours: Optional[float] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        epic_id: Optional[UUID] = None,
        tags: Optional[list] = None,
        custom_fields: Optional[dict] = None,
    ):
        self.title = title
        self.owner_id = owner_id
        self.description = description
        self.task_type = task_type
        self.priority = priority
        self.visibility = visibility
        self.due_date = due_date
        self.start_date = start_date
        self.estimated_hours = estimated_hours
        self.organization_id = organization_id
        self.department_id = department_id
        self.parent_id = parent_id
        self.epic_id = epic_id
        self.tags = tags or []
        self.custom_fields = custom_fields or {}


class CreateTaskResponse:
    """Response for creating a task."""
    
    def __init__(self, task: Task):
        self.task = task
        self.success = True
        self.message = "Task created successfully"


class CreateTaskUseCase(UseCase[CreateTaskRequest, CreateTaskResponse]):
    """Use case for creating a task."""
    
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository
    
    async def execute(self, request: CreateTaskRequest) -> CreateTaskResponse:
        """Execute the create task use case."""
        try:
            # Parse dates if provided
            due_date = None
            if request.due_date:
                from datetime import datetime
                due_date = datetime.fromisoformat(request.due_date.replace('Z', '+00:00'))
            
            start_date = None
            if request.start_date:
                from datetime import datetime
                start_date = datetime.fromisoformat(request.start_date.replace('Z', '+00:00'))
            
            # Create the task entity
            task = Task.create(
                title=request.title,
                owner_id=request.owner_id,
                description=request.description,
                task_type=request.task_type,
                priority=request.priority,
                visibility=request.visibility,
                due_date=due_date,
                start_date=start_date,
                estimated_hours=request.estimated_hours,
                organization_id=request.organization_id,
                department_id=request.department_id,
                parent_id=request.parent_id,
                epic_id=request.epic_id,
            )
            
            # Add tags and custom fields
            for tag in request.tags:
                task.add_tag(tag)
            
            for key, value in request.custom_fields.items():
                task.set_custom_field(key, value)
            
            # Save the task
            created_task = await self.task_repository.create(task)
            
            return CreateTaskResponse(created_task)
            
        except ValidationError as e:
            raise ValidationError(
                field=e.field,
                value=e.value,
                reason=e.reason
            )
        except BusinessRuleViolation as e:
            raise BusinessRuleViolation(e.message, e.details)
        except Exception as e:
            raise Exception(f"Failed to create task: {str(e)}")
