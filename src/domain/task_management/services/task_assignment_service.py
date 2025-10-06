"""
Task assignment domain service.
Handles complex business logic related to task assignment and workload management.
"""

from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

from src.domain.base import DomainService
from src.domain.task_management.entities.task import Task
from src.domain.task_management.repositories.task_repository import TaskRepository
from src.domain.task_management.value_objects.task_id import TaskId
from src.domain.task_management.value_objects.task_priority import TaskPriority
from src.domain.user_management.entities.user import User
from src.domain.user_management.repositories.user_repository import UserRepository
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.exceptions import BusinessRuleViolation


class TaskAssignmentService(DomainService):
    """Domain service for task assignment operations."""
    
    def __init__(
        self,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ):
        self._task_repository = task_repository
        self._user_repository = user_repository
    
    async def execute(self, *args, **kwargs) -> any:
        """Execute the domain service."""
        pass
    
    async def get_user_workload(self, user_id: UserId) -> Dict[str, Any]:
        """Get user's current workload and capacity."""
        # Get active tasks assigned to user
        active_tasks = await self._task_repository.get_by_assignee(user_id)
        
        # Filter only active tasks (not done or cancelled)
        active_tasks = [task for task in active_tasks if task.status.value not in ["done", "cancelled"]]
        
        # Calculate workload metrics
        total_tasks = len(active_tasks)
        high_priority_tasks = len([task for task in active_tasks if task.priority.value in ["high", "urgent", "critical"]])
        overdue_tasks = len([task for task in active_tasks if task.due_date and task.due_date < datetime.utcnow()])
        
        # Calculate estimated hours
        estimated_hours = sum(
            self._estimate_task_hours(task) for task in active_tasks
        )
        
        return {
            "user_id": str(user_id.value),
            "total_tasks": total_tasks,
            "high_priority_tasks": high_priority_tasks,
            "overdue_tasks": overdue_tasks,
            "estimated_hours": estimated_hours,
            "workload_level": self._calculate_workload_level(total_tasks, estimated_hours),
        }
    
    async def find_best_assignee(
        self,
        task: Task,
        candidate_user_ids: List[UserId]
    ) -> UserId:
        """Find the best assignee for a task based on workload and skills."""
        if not candidate_user_ids:
            raise BusinessRuleViolation(
                "No candidate assignees provided",
                {"task_id": str(task.id.value)}
            )
        
        best_assignee = None
        best_score = float('inf')
        
        for user_id in candidate_user_ids:
            user = await self._user_repository.get_by_id(user_id)
            if not user:
                continue
            
            # Check if user can be assigned this task
            if not await self._can_assign_task_to_user(task, user):
                continue
            
            # Calculate assignment score (lower is better)
            score = await self._calculate_assignment_score(task, user)
            
            if score < best_score:
                best_score = score
                best_assignee = user_id
        
        if not best_assignee:
            raise BusinessRuleViolation(
                "No suitable assignee found",
                {"task_id": str(task.id.value), "candidates": [str(uid.value) for uid in candidate_user_ids]}
            )
        
        return best_assignee
    
    async def validate_task_assignment(
        self,
        task: Task,
        assignee_id: UserId
    ) -> bool:
        """Validate if a task can be assigned to a user."""
        assignee = await self._user_repository.get_by_id(assignee_id)
        if not assignee:
            raise BusinessRuleViolation(
                "Assignee does not exist",
                {"assignee_id": str(assignee_id.value)}
            )
        
        # Check if user is active
        if not assignee.is_active:
            raise BusinessRuleViolation(
                "Cannot assign task to inactive user",
                {"assignee_id": str(assignee_id.value)}
            )
        
        # Check workload capacity
        workload = await self.get_user_workload(assignee_id)
        if workload["workload_level"] == "overloaded":
            raise BusinessRuleViolation(
                "User is overloaded and cannot take more tasks",
                {"assignee_id": str(assignee_id.value), "workload": workload}
            )
        
        return True
    
    async def get_team_workload_distribution(self, manager_id: UserId) -> Dict[str, Any]:
        """Get workload distribution across a manager's team."""
        # Get all team members
        team_members = await self._get_team_members(manager_id)
        
        distribution = {
            "manager_id": str(manager_id.value),
            "team_size": len(team_members),
            "total_tasks": 0,
            "total_estimated_hours": 0,
            "members": []
        }
        
        for member in team_members:
            workload = await self.get_user_workload(member.id)
            distribution["total_tasks"] += workload["total_tasks"]
            distribution["total_estimated_hours"] += workload["estimated_hours"]
            distribution["members"].append({
                "user_id": str(member.id.value),
                "username": member.username,
                "workload": workload
            })
        
        return distribution
    
    def _estimate_task_hours(self, task: Task) -> float:
        """Estimate hours required for a task based on priority and complexity."""
        base_hours = 4.0  # Base estimation
        
        # Adjust based on priority
        priority_multipliers = {
            "low": 0.5,
            "medium": 1.0,
            "high": 1.5,
            "urgent": 2.0,
            "critical": 3.0,
        }
        
        multiplier = priority_multipliers.get(task.priority.value, 1.0)
        return base_hours * multiplier
    
    def _calculate_workload_level(self, total_tasks: int, estimated_hours: float) -> str:
        """Calculate workload level based on tasks and hours."""
        if total_tasks >= 10 or estimated_hours >= 40:
            return "overloaded"
        elif total_tasks >= 7 or estimated_hours >= 30:
            return "high"
        elif total_tasks >= 4 or estimated_hours >= 20:
            return "medium"
        else:
            return "low"
    
    async def _can_assign_task_to_user(self, task: Task, user: User) -> bool:
        """Check if a task can be assigned to a user."""
        # Basic checks
        if not user.is_active:
            return False
        
        # Check if user has the right role for the task
        # This could be extended with more complex logic
        return True
    
    async def _calculate_assignment_score(self, task: Task, user: User) -> float:
        """Calculate assignment score for a user (lower is better)."""
        workload = await self.get_user_workload(user.id)
        
        # Base score from workload
        score = workload["total_tasks"] * 10 + workload["estimated_hours"]
        
        # Penalty for overdue tasks
        score += workload["overdue_tasks"] * 50
        
        # Penalty for high priority tasks
        score += workload["high_priority_tasks"] * 20
        
        return score
    
    async def _get_team_members(self, manager_id: UserId) -> List[User]:
        """Get team members under a manager."""
        # This would need to be implemented with proper hierarchy service
        # For now, return empty list
        return []
