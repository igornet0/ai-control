"""
API dependencies for dependency injection.
Provides database sessions and repository instances.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.database.engine import get_db_session
from src.infrastructure.database.repositories.user_repository_impl import UserRepositoryImpl
from src.infrastructure.database.repositories.task_repository_impl import TaskRepositoryImpl
from src.infrastructure.database.repositories.dashboard_repository_impl import DashboardRepositoryImpl
from src.infrastructure.database.repositories.kpi_repository_impl import KPIRepositoryImpl
from src.infrastructure.database.repositories.organization_repository_impl import OrganizationRepositoryImpl
from src.infrastructure.database.repositories.department_repository_impl import DepartmentRepositoryImpl
from src.domain.user_management.repositories.user_repository import UserRepository
from src.domain.user_management.repositories.organization_repository import OrganizationRepository
from src.domain.user_management.repositories.department_repository import DepartmentRepository
from src.application.use_cases.user_management.create_user import CreateUserUseCase
from src.application.use_cases.user_management.update_user import UpdateUserUseCase
from src.application.use_cases.user_management.get_user import GetUserUseCase, GetUsersUseCase
from src.application.use_cases.user_management.delete_user import DeleteUserUseCase
from src.application.use_cases.task_management.create_task import CreateTaskUseCase
from src.application.use_cases.task_management.update_task import UpdateTaskUseCase
from src.application.use_cases.task_management.get_task import GetTaskUseCase, GetTasksUseCase
from src.application.use_cases.task_management.delete_task import DeleteTaskUseCase
from src.application.use_cases.dashboard.create_dashboard import CreateDashboardUseCase
from src.application.use_cases.dashboard.update_dashboard import UpdateDashboardUseCase
from src.application.use_cases.dashboard.get_dashboard import GetDashboardUseCase, GetDashboardsUseCase
from src.application.use_cases.dashboard.delete_dashboard import DeleteDashboardUseCase
from src.application.use_cases.kpi.create_kpi import CreateKPIUseCase
from src.application.use_cases.kpi.update_kpi import UpdateKPIUseCase
from src.application.use_cases.kpi.get_kpi import GetKPIUseCase, GetKPIsUseCase
from src.application.use_cases.kpi.delete_kpi import DeleteKPIUseCase


# Repository dependencies
async def get_user_repository(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    """Get user repository instance."""
    return UserRepositoryImpl(session)


async def get_organization_repository(session: AsyncSession = Depends(get_db_session)) -> OrganizationRepository:
    """Get organization repository instance."""
    return OrganizationRepositoryImpl(session)


async def get_department_repository(session: AsyncSession = Depends(get_db_session)) -> DepartmentRepository:
    """Get department repository instance."""
    return DepartmentRepositoryImpl(session)


# Use case dependencies
async def get_create_user_use_case(
    user_repository: UserRepository = Depends(get_user_repository),
    organization_repository: OrganizationRepository = Depends(get_organization_repository),
    department_repository: DepartmentRepository = Depends(get_department_repository),
) -> CreateUserUseCase:
    """Get create user use case instance."""
    return CreateUserUseCase(
        user_repository=user_repository,
        organization_repository=organization_repository,
        department_repository=department_repository,
    )


async def get_update_user_use_case(
    user_repository: UserRepository = Depends(get_user_repository),
    organization_repository: OrganizationRepository = Depends(get_organization_repository),
    department_repository: DepartmentRepository = Depends(get_department_repository),
) -> UpdateUserUseCase:
    """Get update user use case instance."""
    return UpdateUserUseCase(
        user_repository=user_repository,
        organization_repository=organization_repository,
        department_repository=department_repository,
    )


async def get_user_use_case(
    user_repository: UserRepository = Depends(get_user_repository),
) -> GetUserUseCase:
    """Get user use case instance."""
    return GetUserUseCase(user_repository=user_repository)


async def get_users_use_case(
    user_repository: UserRepository = Depends(get_user_repository),
) -> GetUsersUseCase:
    """Get users use case instance."""
    return GetUsersUseCase(user_repository=user_repository)


async def get_delete_user_use_case(
    user_repository: UserRepository = Depends(get_user_repository),
) -> DeleteUserUseCase:
    """Get delete user use case instance."""
    return DeleteUserUseCase(user_repository=user_repository)


# Task use case dependencies
async def get_task_repository(session: AsyncSession = Depends(get_db_session)):
    """Get task repository instance."""
    from src.domain.task_management.repositories.task_repository import TaskRepository
    return TaskRepositoryImpl(session)


async def get_create_task_use_case(
    task_repository = Depends(get_task_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> CreateTaskUseCase:
    """Get create task use case instance."""
    return CreateTaskUseCase(
        task_repository=task_repository,
        user_repository=user_repository,
    )


async def get_update_task_use_case(
    task_repository = Depends(get_task_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> UpdateTaskUseCase:
    """Get update task use case instance."""
    return UpdateTaskUseCase(
        task_repository=task_repository,
        user_repository=user_repository,
    )


async def get_task_use_case(
    task_repository = Depends(get_task_repository),
) -> GetTaskUseCase:
    """Get task use case instance."""
    return GetTaskUseCase(task_repository=task_repository)


async def get_tasks_use_case(
    task_repository = Depends(get_task_repository),
) -> GetTasksUseCase:
    """Get tasks use case instance."""
    return GetTasksUseCase(task_repository=task_repository)


async def get_delete_task_use_case(
    task_repository = Depends(get_task_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> DeleteTaskUseCase:
    """Get delete task use case instance."""
    return DeleteTaskUseCase(
        task_repository=task_repository,
        user_repository=user_repository,
    )


# Combined use case dependencies for controllers
async def get_user_use_cases(
    create_user: CreateUserUseCase = Depends(get_create_user_use_case),
    update_user: UpdateUserUseCase = Depends(get_update_user_use_case),
    get_user: GetUserUseCase = Depends(get_user_use_case),
    get_users: GetUsersUseCase = Depends(get_users_use_case),
) -> dict:
    """Get all user use cases."""
    return {
        "create_user": create_user,
        "update_user": update_user,
        "get_user": get_user,
        "get_users": get_users,
    }


async def get_task_use_cases(
    create_task: CreateTaskUseCase = Depends(get_create_task_use_case),
    update_task: UpdateTaskUseCase = Depends(get_update_task_use_case),
    get_task: GetTaskUseCase = Depends(get_task_use_case),
    get_tasks: GetTasksUseCase = Depends(get_tasks_use_case),
) -> dict:
    """Get all task use cases."""
    return {
        "create_task": create_task,
        "update_task": update_task,
        "get_task": get_task,
        "get_tasks": get_tasks,
    }


# Dashboard use case dependencies
async def get_dashboard_repository(session: AsyncSession = Depends(get_db_session)):
    """Get dashboard repository instance."""
    from src.domain.dashboard.repositories.dashboard_repository import DashboardRepository
    return DashboardRepositoryImpl(session)


async def get_create_dashboard_use_case(
    dashboard_repository = Depends(get_dashboard_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> CreateDashboardUseCase:
    """Get create dashboard use case instance."""
    return CreateDashboardUseCase(
        dashboard_repository=dashboard_repository,
        user_repository=user_repository,
    )


async def get_dashboard_use_case(
    dashboard_repository = Depends(get_dashboard_repository),
) -> GetDashboardUseCase:
    """Get dashboard use case instance."""
    return GetDashboardUseCase(dashboard_repository=dashboard_repository)


async def get_dashboards_use_case(
    dashboard_repository = Depends(get_dashboard_repository),
) -> GetDashboardsUseCase:
    """Get dashboards use case instance."""
    return GetDashboardsUseCase(dashboard_repository=dashboard_repository)


async def get_update_dashboard_use_case(
    dashboard_repository = Depends(get_dashboard_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> UpdateDashboardUseCase:
    """Get update dashboard use case instance."""
    return UpdateDashboardUseCase(
        dashboard_repository=dashboard_repository,
        user_repository=user_repository,
    )


async def get_delete_dashboard_use_case(
    dashboard_repository = Depends(get_dashboard_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> DeleteDashboardUseCase:
    """Get delete dashboard use case instance."""
    return DeleteDashboardUseCase(
        dashboard_repository=dashboard_repository,
        user_repository=user_repository,
    )


async def get_dashboard_use_cases(
    create_dashboard: CreateDashboardUseCase = Depends(get_create_dashboard_use_case),
    get_dashboard: GetDashboardUseCase = Depends(get_dashboard_use_case),
    get_dashboards: GetDashboardsUseCase = Depends(get_dashboards_use_case),
) -> dict:
    """Get all dashboard use cases."""
    return {
        "create_dashboard": create_dashboard,
        "get_dashboard": get_dashboard,
        "get_dashboards": get_dashboards,
    }


# KPI use case dependencies
async def get_kpi_repository(session: AsyncSession = Depends(get_db_session)):
    """Get KPI repository instance."""
    from src.domain.kpi.repositories.kpi_repository import KPIRepository
    return KPIRepositoryImpl(session)


async def get_create_kpi_use_case(
    kpi_repository = Depends(get_kpi_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> CreateKPIUseCase:
    """Get create KPI use case instance."""
    return CreateKPIUseCase(
        kpi_repository=kpi_repository,
        user_repository=user_repository,
    )


async def get_kpi_use_case(
    kpi_repository = Depends(get_kpi_repository),
) -> GetKPIUseCase:
    """Get KPI use case instance."""
    return GetKPIUseCase(kpi_repository=kpi_repository)


async def get_kpis_use_case(
    kpi_repository = Depends(get_kpi_repository),
) -> GetKPIsUseCase:
    """Get KPIs use case instance."""
    return GetKPIsUseCase(kpi_repository=kpi_repository)


async def get_update_kpi_use_case(
    kpi_repository = Depends(get_kpi_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> UpdateKPIUseCase:
    """Get update KPI use case instance."""
    return UpdateKPIUseCase(
        kpi_repository=kpi_repository,
        user_repository=user_repository,
    )


async def get_delete_kpi_use_case(
    kpi_repository = Depends(get_kpi_repository),
    user_repository: UserRepository = Depends(get_user_repository),
) -> DeleteKPIUseCase:
    """Get delete KPI use case instance."""
    return DeleteKPIUseCase(
        kpi_repository=kpi_repository,
        user_repository=user_repository,
    )


async def get_kpi_use_cases(
    create_kpi: CreateKPIUseCase = Depends(get_create_kpi_use_case),
    get_kpi: GetKPIUseCase = Depends(get_kpi_use_case),
    get_kpis: GetKPIsUseCase = Depends(get_kpis_use_case),
) -> dict:
    """Get all KPI use cases."""
    return {
        "create_kpi": create_kpi,
        "get_kpi": get_kpi,
        "get_kpis": get_kpis,
    }


# Authentication dependencies
from src.infrastructure.auth.jwt_service import JWTService
from src.infrastructure.auth.auth_service import AuthService
from src.domain.user_management.value_objects.user_id import UserId

security = HTTPBearer()

async def get_jwt_service() -> JWTService:
    """Get JWT service instance."""
    return JWTService()

async def get_auth_service() -> AuthService:
    """Get auth service instance."""
    return AuthService()

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    jwt_service: JWTService = Depends(get_jwt_service)
) -> str:
    """Get current authenticated user ID from JWT token."""
    try:
        # Extract token from credentials
        token = credentials.credentials
        
        # Verify and decode token
        payload = jwt_service.verify_token(token)
        
        # Extract user ID from payload
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        return user_id
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )

async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    user_repository: UserRepository = Depends(get_user_repository)
):
    """Get current authenticated user."""
    from src.domain.user_management.value_objects.user_id import UserId
    
    user = await user_repository.get_by_id(UserId.from_string(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive"
        )
    
    return user

async def require_admin(
    current_user = Depends(get_current_user)
):
    """Require admin role."""
    if not current_user.can_access_admin_panel():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

async def require_manager(
    current_user = Depends(get_current_user)
):
    """Require manager role or higher."""
    if not current_user.can_manage_users():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )
    return current_user
