"""
Get task use case.
Handles the business logic for retrieving task information.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID

from src.application.use_cases.base import UseCase
from src.domain.task_management.entities.task import Task, TaskStatus, TaskPriority, TaskType, TaskVisibility
from src.domain.task_management.repositories.task_repository import TaskRepository
from src.domain.exceptions import EntityNotFound, BusinessRuleViolation


class GetTaskRequest:
    """Request for getting a task."""
    
    def __init__(self, task_id: UUID, user_id: UUID):
        self.task_id = task_id
        self.user_id = user_id


class GetTaskResponse:
    """Response for getting a task."""
    
    def __init__(self, task: Task):
        self.task = task
        self.success = True


class GetTasksRequest:
    """Request for getting multiple tasks."""
    
    def __init__(
        self,
        user_id: UUID,
        owner_id: Optional[UUID] = None,
        executor_id: Optional[UUID] = None,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        task_type: Optional[TaskType] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        epic_id: Optional[UUID] = None,
        visibility: Optional[TaskVisibility] = None,
        search_query: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ):
        self.user_id = user_id
        self.owner_id = owner_id
        self.executor_id = executor_id
        self.status = status
        self.priority = priority
        self.task_type = task_type
        self.organization_id = organization_id
        self.department_id = department_id
        self.parent_id = parent_id
        self.epic_id = epic_id
        self.visibility = visibility
        self.search_query = search_query
        self.filters = filters or {}
        self.limit = limit
        self.offset = offset


class GetTasksResponse:
    """Response for getting multiple tasks."""
    
    def __init__(self, tasks: List[Task], total_count: int):
        self.tasks = tasks
        self.total_count = total_count
        self.success = True


class GetTaskUseCase(UseCase[GetTaskRequest, GetTaskResponse]):
    """Use case for getting a single task."""
    
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository
    
    async def execute(self, request: GetTaskRequest) -> GetTaskResponse:
        """Execute the get task use case."""
        try:
            # Get the task
            task = await self.task_repository.get_by_id(request.task_id)
            if not task:
                raise EntityNotFound("Task", str(request.task_id))
            
            # Check if user can access the task
            if not self._can_access_task(task, request.user_id):
                raise BusinessRuleViolation(
                    f"User {request.user_id} cannot access this task",
                    {"user_id": str(request.user_id), "task_id": str(request.task_id)}
                )
            
            return GetTaskResponse(task)
            
        except EntityNotFound as e:
            raise EntityNotFound(e.entity_type, e.entity_id)
        except BusinessRuleViolation as e:
            raise BusinessRuleViolation(e.message, e.details)
        except Exception as e:
            raise Exception(f"Failed to get task: {str(e)}")
    
    def _can_access_task(self, task: Task, user_id: UUID) -> bool:
        """Check if user can access the task based on visibility rules."""
        # Owner can always access
        if task.owner_id == user_id:
            return True
        
        # Executor can access
        if task.executor_id == user_id:
            return True
        
        # Reviewer can access
        if task.reviewer_id == user_id:
            return True
        
        # Check visibility rules
        if task.visibility == TaskVisibility.PUBLIC:
            return True
        elif task.visibility == TaskVisibility.PRIVATE:
            return False
        elif task.visibility == TaskVisibility.TEAM:
            # Add team membership check here
            return True
        elif task.visibility == TaskVisibility.DEPARTMENT:
            # Add department membership check here
            return True
        elif task.visibility == TaskVisibility.ORGANIZATION:
            # Add organization membership check here
            return True
        
        return False


class GetTasksUseCase(UseCase[GetTasksRequest, GetTasksResponse]):
    """Use case for getting multiple tasks."""
    
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository
    
    async def execute(self, request: GetTasksRequest) -> GetTasksResponse:
        """Execute the get tasks use case."""
        try:
            tasks = []
            total_count = 0
            
            # Build filters
            filters = request.filters.copy()
            if request.owner_id:
                filters["owner_id"] = request.owner_id
            if request.executor_id:
                filters["executor_id"] = request.executor_id
            if request.status:
                filters["status"] = request.status
            if request.priority:
                filters["priority"] = request.priority
            if request.task_type:
                filters["task_type"] = request.task_type
            if request.organization_id:
                filters["organization_id"] = request.organization_id
            if request.department_id:
                filters["department_id"] = request.department_id
            if request.parent_id:
                filters["parent_id"] = request.parent_id
            if request.epic_id:
                filters["epic_id"] = request.epic_id
            if request.visibility:
                filters["visibility"] = request.visibility
            
            # Search or filter tasks
            if request.search_query:
                tasks = await self.task_repository.search_tasks(
                    query=request.search_query,
                    filters=filters,
                    limit=request.limit,
                    offset=request.offset
                )
                total_count = await self.task_repository.count_tasks(filters)
            else:
                # Get tasks based on filters
                if request.owner_id:
                    tasks = await self.task_repository.get_by_owner(
                        request.owner_id, request.limit, request.offset
                    )
                elif request.executor_id:
                    tasks = await self.task_repository.get_by_executor(
                        request.executor_id, request.limit, request.offset
                    )
                elif request.status:
                    tasks = await self.task_repository.get_by_status(
                        request.status, request.limit, request.offset
                    )
                elif request.priority:
                    tasks = await self.task_repository.get_by_priority(
                        request.priority, request.limit, request.offset
                    )
                elif request.task_type:
                    tasks = await self.task_repository.get_by_type(
                        request.task_type, request.limit, request.offset
                    )
                elif request.organization_id:
                    tasks = await self.task_repository.get_by_organization(
                        request.organization_id, request.limit, request.offset
                    )
                elif request.department_id:
                    tasks = await self.task_repository.get_by_department(
                        request.department_id, request.limit, request.offset
                    )
                elif request.parent_id:
                    tasks = await self.task_repository.get_by_parent(
                        request.parent_id, request.limit, request.offset
                    )
                elif request.epic_id:
                    tasks = await self.task_repository.get_by_epic(
                        request.epic_id, request.limit, request.offset
                    )
                else:
                    # Get tasks by visibility for user
                    if request.visibility:
                        tasks = await self.task_repository.get_tasks_by_visibility(
                            request.visibility, request.user_id, request.limit, request.offset
                        )
                    else:
                        # Get all accessible tasks for user
                        tasks = await self.task_repository.get_tasks_by_visibility(
                            TaskVisibility.PUBLIC, request.user_id, request.limit, request.offset
                        )
                
                total_count = await self.task_repository.count_tasks(filters)
            
            # Filter tasks based on user access
            accessible_tasks = []
            for task in tasks:
                if self._can_access_task(task, request.user_id):
                    accessible_tasks.append(task)
            
            return GetTasksResponse(accessible_tasks, total_count)
            
        except Exception as e:
            raise Exception(f"Failed to get tasks: {str(e)}")
    
    def _can_access_task(self, task: Task, user_id: UUID) -> bool:
        """Check if user can access the task based on visibility rules."""
        # Owner can always access
        if task.owner_id == user_id:
            return True
        
        # Executor can access
        if task.executor_id == user_id:
            return True
        
        # Reviewer can access
        if task.reviewer_id == user_id:
            return True
        
        # Check visibility rules
        if task.visibility == TaskVisibility.PUBLIC:
            return True
        elif task.visibility == TaskVisibility.PRIVATE:
            return False
        elif task.visibility == TaskVisibility.TEAM:
            # Add team membership check here
            return True
        elif task.visibility == TaskVisibility.DEPARTMENT:
            # Add department membership check here
            return True
        elif task.visibility == TaskVisibility.ORGANIZATION:
            # Add organization membership check here
            return True
        
        return False
