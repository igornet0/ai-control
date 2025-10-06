"""
Зависимости для эндпоинтов задач
"""

from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.configuration.auth import verify_authorization
from backend.api.configuration.server import Server
from backend.api.services.tasks import TaskService
from backend.api.services.tasks.exceptions import (
    TaskNotFoundError,
    TaskAccessDeniedError,
    TaskEditDeniedError,
    TaskDeleteDeniedError,
    TaskValidationError,
    TaskDependencyError,
)


async def get_task_service(session: Annotated[AsyncSession, Depends(Server.get_db)]) -> TaskService:
    """Получить сервис задач"""
    return TaskService(session)


# Типы для аннотаций
TaskServiceDep = Annotated[TaskService, Depends(get_task_service)]
UserDep = Annotated[dict, Depends(verify_authorization)]
SessionDep = Annotated[AsyncSession, Depends(Server.get_db)]
