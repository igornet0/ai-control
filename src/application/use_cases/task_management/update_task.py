"""
Update task use case.
Handles the business logic for updating an existing task.
"""

from typing import Optional
from uuid import UUID

from src.application.use_cases.base import UseCase
from src.domain.task_management.entities.task import Task, TaskStatus, TaskPriority, TaskType, TaskVisibility
from src.domain.task_management.repositories.task_repository import TaskRepository
from src.domain.exceptions import EntityNotFound, ValidationError, BusinessRuleViolation


class UpdateTaskRequest:
    """Request for updating a task."""
    
    def __init__(
        self,
        task_id: UUID,
        updated_by: UUID,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        task_type: Optional[TaskType] = None,
        visibility: Optional[TaskVisibility] = None,
        due_date: Optional[str] = None,
        start_date: Optional[str] = None,
        estimated_hours: Optional[float] = None,
        executor_id: Optional[UUID] = None,
        reviewer_id: Optional[UUID] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        epic_id: Optional[UUID] = None,
        tags: Optional[list] = None,
        custom_fields: Optional[dict] = None,
    ):
        self.task_id = task_id
        self.updated_by = updated_by
        self.title = title
        self.description = description
        self.status = status
        self.priority = priority
        self.task_type = task_type
        self.visibility = visibility
        self.due_date = due_date
        self.start_date = start_date
        self.estimated_hours = estimated_hours
        self.executor_id = executor_id
        self.reviewer_id = reviewer_id
        self.organization_id = organization_id
        self.department_id = department_id
        self.parent_id = parent_id
        self.epic_id = epic_id
        self.tags = tags
        self.custom_fields = custom_fields


class UpdateTaskResponse:
    """Response for updating a task."""
    
    def __init__(self, task: Task):
        self.task = task
        self.success = True
        self.message = "Task updated successfully"


class UpdateTaskUseCase(UseCase[UpdateTaskRequest, UpdateTaskResponse]):
    """Use case for updating a task."""
    
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository
    
    async def execute(self, request: UpdateTaskRequest) -> UpdateTaskResponse:
        """Execute the update task use case."""
        try:
            # Get the existing task
            task = await self.task_repository.get_by_id(request.task_id)
            if not task:
                raise EntityNotFound("Task", str(request.task_id))
            
            # Check if user can edit the task
            if not task.can_be_edited_by(request.updated_by):
                raise BusinessRuleViolation(
                    f"User {request.updated_by} cannot edit this task",
                    {"user_id": str(request.updated_by), "task_id": str(request.task_id)}
                )
            
            # Update basic fields
            if request.title is not None:
                task.title = request.title
            
            if request.description is not None:
                task.description = request.description
            
            if request.priority is not None:
                task.priority = request.priority
            
            if request.task_type is not None:
                task.task_type = request.task_type
            
            if request.visibility is not None:
                task.visibility = request.visibility
            
            if request.estimated_hours is not None:
                task.estimated_hours = request.estimated_hours
            
            if request.executor_id is not None:
                task.executor_id = request.executor_id
            
            if request.reviewer_id is not None:
                task.reviewer_id = request.reviewer_id
            
            if request.organization_id is not None:
                task.organization_id = request.organization_id
            
            if request.department_id is not None:
                task.department_id = request.department_id
            
            if request.parent_id is not None:
                task.parent_id = request.parent_id
            
            if request.epic_id is not None:
                task.epic_id = request.epic_id
            
            # Update dates
            if request.due_date is not None:
                if request.due_date:
                    from datetime import datetime
                    task.due_date = datetime.fromisoformat(request.due_date.replace('Z', '+00:00'))
                else:
                    task.due_date = None
            
            if request.start_date is not None:
                if request.start_date:
                    from datetime import datetime
                    task.start_date = datetime.fromisoformat(request.start_date.replace('Z', '+00:00'))
                else:
                    task.start_date = None
            
            # Update status (this has special business logic)
            if request.status is not None and request.status != task.status:
                task.change_status(request.status, request.updated_by)
            
            # Update tags
            if request.tags is not None:
                # Remove all existing tags and add new ones
                task.tags = []
                for tag in request.tags:
                    task.add_tag(tag)
            
            # Update custom fields
            if request.custom_fields is not None:
                # Remove all existing custom fields and add new ones
                task.custom_fields = {}
                for key, value in request.custom_fields.items():
                    task.set_custom_field(key, value)
            
            # Validate business rules
            task.validate_business_rules()
            
            # Save the updated task
            updated_task = await self.task_repository.update(task)
            
            return UpdateTaskResponse(updated_task)
            
        except EntityNotFound as e:
            raise EntityNotFound(e.entity_type, e.entity_id)
        except ValidationError as e:
            raise ValidationError(
                field=e.field,
                value=e.value,
                reason=e.reason
            )
        except BusinessRuleViolation as e:
            raise BusinessRuleViolation(e.message, e.details)
        except Exception as e:
            raise Exception(f"Failed to update task: {str(e)}")
