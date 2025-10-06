"""
Task API controller.
Handles HTTP requests for task management operations.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from fastapi.responses import JSONResponse

from src.application.use_cases.task_management.create_task import CreateTaskUseCase, CreateTaskRequest
from src.application.use_cases.task_management.update_task import UpdateTaskUseCase, UpdateTaskRequest
from src.application.use_cases.task_management.get_task import GetTaskUseCase, GetTaskRequest, GetTasksUseCase, GetTasksRequest
from src.application.dto.task_dto import (
    TaskCreateDTO,
    TaskUpdateDTO,
    TaskResponseDTO,
    TaskListResponseDTO,
    TaskCommentCreateDTO,
    TaskCommentResponseDTO,
    TaskTimeLogCreateDTO,
    TaskTimeLogResponseDTO,
    TaskDependencyCreateDTO,
    TaskDependencyResponseDTO,
    TaskWatcherCreateDTO,
    TaskWatcherResponseDTO,
    TaskLabelCreateDTO,
    TaskLabelResponseDTO,
    TaskStatisticsDTO,
)
from src.domain.task_management.entities.task import TaskStatus, TaskPriority, TaskType, TaskVisibility
from src.domain.exceptions import EntityNotFound, ValidationError, BusinessRuleViolation
from src.presentation.api.dependencies import get_current_user_id, get_task_use_cases

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=TaskResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreateDTO,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Create a new task."""
    try:
        create_task_use_case = use_cases["create_task"]
        
        request = CreateTaskRequest(
            title=task_data.title,
            owner_id=current_user_id,
            description=task_data.description,
            task_type=task_data.task_type,
            priority=task_data.priority,
            visibility=task_data.visibility,
            due_date=task_data.due_date.isoformat() if task_data.due_date else None,
            start_date=task_data.start_date.isoformat() if task_data.start_date else None,
            estimated_hours=task_data.estimated_hours,
            organization_id=task_data.organization_id,
            department_id=task_data.department_id,
            parent_id=task_data.parent_id,
            epic_id=task_data.epic_id,
            tags=task_data.tags,
            custom_fields=task_data.custom_fields,
        )
        
        response = await create_task_use_case.execute(request)
        return TaskResponseDTO.from_orm(response.task)
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {e.reason}"
        )
    except BusinessRuleViolation as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Business rule violation: {e.message}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task: {str(e)}"
        )


@router.get("/{task_id}", response_model=TaskResponseDTO)
async def get_task(
    task_id: UUID = Path(..., description="Task ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get a task by ID."""
    try:
        get_task_use_case = use_cases["get_task"]
        
        request = GetTaskRequest(task_id=task_id, user_id=current_user_id)
        response = await get_task_use_case.execute(request)
        
        return TaskResponseDTO.from_orm(response.task)
        
    except EntityNotFound as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{e.entity_type} not found: {e.entity_id}"
        )
    except BusinessRuleViolation as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {e.message}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task: {str(e)}"
        )


@router.get("/", response_model=TaskListResponseDTO)
async def get_tasks(
    owner_id: Optional[UUID] = Query(default=None, description="Filter by owner ID"),
    executor_id: Optional[UUID] = Query(default=None, description="Filter by executor ID"),
    status: Optional[TaskStatus] = Query(default=None, description="Filter by status"),
    priority: Optional[TaskPriority] = Query(default=None, description="Filter by priority"),
    task_type: Optional[TaskType] = Query(default=None, description="Filter by task type"),
    organization_id: Optional[UUID] = Query(default=None, description="Filter by organization ID"),
    department_id: Optional[UUID] = Query(default=None, description="Filter by department ID"),
    parent_id: Optional[UUID] = Query(default=None, description="Filter by parent task ID"),
    epic_id: Optional[UUID] = Query(default=None, description="Filter by epic task ID"),
    visibility: Optional[TaskVisibility] = Query(default=None, description="Filter by visibility"),
    search_query: Optional[str] = Query(default=None, description="Search query"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get tasks with optional filters."""
    try:
        get_tasks_use_case = use_cases["get_tasks"]
        
        request = GetTasksRequest(
            user_id=current_user_id,
            owner_id=owner_id,
            executor_id=executor_id,
            status=status,
            priority=priority,
            task_type=task_type,
            organization_id=organization_id,
            department_id=department_id,
            parent_id=parent_id,
            epic_id=epic_id,
            visibility=visibility,
            search_query=search_query,
            limit=limit,
            offset=offset,
        )
        
        response = await get_tasks_use_case.execute(request)
        
        return TaskListResponseDTO(
            tasks=[TaskResponseDTO.from_orm(task) for task in response.tasks],
            total_count=response.total_count,
            limit=limit,
            offset=offset,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get tasks: {str(e)}"
        )


@router.put("/{task_id}", response_model=TaskResponseDTO)
async def update_task(
    task_id: UUID = Path(..., description="Task ID"),
    task_data: TaskUpdateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Update a task."""
    try:
        update_task_use_case = use_cases["update_task"]
        
        request = UpdateTaskRequest(
            task_id=task_id,
            updated_by=current_user_id,
            title=task_data.title,
            description=task_data.description,
            status=task_data.status,
            priority=task_data.priority,
            task_type=task_data.task_type,
            visibility=task_data.visibility,
            due_date=task_data.due_date.isoformat() if task_data.due_date else None,
            start_date=task_data.start_date.isoformat() if task_data.start_date else None,
            estimated_hours=task_data.estimated_hours,
            executor_id=task_data.executor_id,
            reviewer_id=task_data.reviewer_id,
            organization_id=task_data.organization_id,
            department_id=task_data.department_id,
            parent_id=task_data.parent_id,
            epic_id=task_data.epic_id,
            tags=task_data.tags,
            custom_fields=task_data.custom_fields,
        )
        
        response = await update_task_use_case.execute(request)
        return TaskResponseDTO.from_orm(response.task)
        
    except EntityNotFound as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{e.entity_type} not found: {e.entity_id}"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {e.reason}"
        )
    except BusinessRuleViolation as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Business rule violation: {e.message}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update task: {str(e)}"
        )


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID = Path(..., description="Task ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Delete a task."""
    try:
        # TODO: Implement delete task use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Delete task functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete task: {str(e)}"
        )


@router.get("/{task_id}/statistics", response_model=TaskStatisticsDTO)
async def get_task_statistics(
    task_id: UUID = Path(..., description="Task ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get task statistics."""
    try:
        # TODO: Implement task statistics use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Task statistics functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task statistics: {str(e)}"
        )


# Task Comments endpoints
@router.post("/{task_id}/comments", response_model=TaskCommentResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_task_comment(
    task_id: UUID = Path(..., description="Task ID"),
    comment_data: TaskCommentCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Create a comment on a task."""
    try:
        # TODO: Implement create task comment use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create task comment functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task comment: {str(e)}"
        )


@router.get("/{task_id}/comments", response_model=List[TaskCommentResponseDTO])
async def get_task_comments(
    task_id: UUID = Path(..., description="Task ID"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get comments for a task."""
    try:
        # TODO: Implement get task comments use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get task comments functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task comments: {str(e)}"
        )


# Task Time Logs endpoints
@router.post("/{task_id}/time-logs", response_model=TaskTimeLogResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_task_time_log(
    task_id: UUID = Path(..., description="Task ID"),
    time_log_data: TaskTimeLogCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Create a time log for a task."""
    try:
        # TODO: Implement create task time log use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create task time log functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task time log: {str(e)}"
        )


@router.get("/{task_id}/time-logs", response_model=List[TaskTimeLogResponseDTO])
async def get_task_time_logs(
    task_id: UUID = Path(..., description="Task ID"),
    limit: int = Query(default=100, ge=1, le=1000, description="Limit"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get time logs for a task."""
    try:
        # TODO: Implement get task time logs use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get task time logs functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task time logs: {str(e)}"
        )


# Task Dependencies endpoints
@router.post("/{task_id}/dependencies", response_model=TaskDependencyResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_task_dependency(
    task_id: UUID = Path(..., description="Task ID"),
    dependency_data: TaskDependencyCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Create a dependency for a task."""
    try:
        # TODO: Implement create task dependency use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create task dependency functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task dependency: {str(e)}"
        )


@router.get("/{task_id}/dependencies", response_model=List[TaskDependencyResponseDTO])
async def get_task_dependencies(
    task_id: UUID = Path(..., description="Task ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get dependencies for a task."""
    try:
        # TODO: Implement get task dependencies use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get task dependencies functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task dependencies: {str(e)}"
        )


# Task Watchers endpoints
@router.post("/{task_id}/watchers", response_model=TaskWatcherResponseDTO, status_code=status.HTTP_201_CREATED)
async def add_task_watcher(
    task_id: UUID = Path(..., description="Task ID"),
    watcher_data: TaskWatcherCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Add a watcher to a task."""
    try:
        # TODO: Implement add task watcher use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Add task watcher functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add task watcher: {str(e)}"
        )


@router.get("/{task_id}/watchers", response_model=List[TaskWatcherResponseDTO])
async def get_task_watchers(
    task_id: UUID = Path(..., description="Task ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get watchers for a task."""
    try:
        # TODO: Implement get task watchers use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get task watchers functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task watchers: {str(e)}"
        )


# Task Labels endpoints
@router.post("/{task_id}/labels", response_model=TaskLabelResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_task_label(
    task_id: UUID = Path(..., description="Task ID"),
    label_data: TaskLabelCreateDTO = ...,
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Create a label for a task."""
    try:
        # TODO: Implement create task label use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Create task label functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task label: {str(e)}"
        )


@router.get("/{task_id}/labels", response_model=List[TaskLabelResponseDTO])
async def get_task_labels(
    task_id: UUID = Path(..., description="Task ID"),
    current_user_id: UUID = Depends(get_current_user_id),
    use_cases: dict = Depends(get_task_use_cases),
):
    """Get labels for a task."""
    try:
        # TODO: Implement get task labels use case
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get task labels functionality not yet implemented"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task labels: {str(e)}"
        )
