"""
API schemas module.
"""

from .user_schemas import (
    UserCreateSchema,
    UserUpdateSchema,
    UserResponseSchema,
    UserListResponseSchema,
    UserLoginSchema,
    UserRegisterSchema,
    UserPasswordResetSchema,
    UserPasswordChangeSchema
)
from .task_schemas import (
    TaskCreateSchema,
    TaskUpdateSchema,
    TaskResponseSchema,
    TaskListResponseSchema,
    TaskCommentCreateSchema,
    TaskCommentResponseSchema,
    TaskTimeLogCreateSchema,
    TaskTimeLogResponseSchema
)
from .dashboard_schemas import (
    DashboardCreateSchema,
    DashboardUpdateSchema,
    DashboardResponseSchema,
    DashboardListResponseSchema,
    WidgetCreateSchema,
    WidgetUpdateSchema,
    WidgetResponseSchema
)
from .kpi_schemas import (
    KPICreateSchema,
    KPIUpdateSchema,
    KPIResponseSchema,
    KPIListResponseSchema,
    KPICalculationResponseSchema
)
from .organization_schemas import (
    OrganizationCreateSchema,
    OrganizationUpdateSchema,
    OrganizationResponseSchema,
    OrganizationListResponseSchema
)
from .department_schemas import (
    DepartmentCreateSchema,
    DepartmentUpdateSchema,
    DepartmentResponseSchema,
    DepartmentListResponseSchema
)
from .auth_schemas import (
    TokenSchema,
    TokenRefreshSchema,
    AuthResponseSchema
)
from .common_schemas import (
    ErrorResponseSchema,
    SuccessResponseSchema,
    PaginationSchema,
    HealthCheckSchema
)

__all__ = [
    "UserCreateSchema",
    "UserUpdateSchema",
    "UserResponseSchema",
    "UserListResponseSchema",
    "UserLoginSchema",
    "UserRegisterSchema",
    "UserPasswordResetSchema",
    "UserPasswordChangeSchema",
    "TaskCreateSchema",
    "TaskUpdateSchema",
    "TaskResponseSchema",
    "TaskListResponseSchema",
    "TaskCommentCreateSchema",
    "TaskCommentResponseSchema",
    "TaskTimeLogCreateSchema",
    "TaskTimeLogResponseSchema",
    "DashboardCreateSchema",
    "DashboardUpdateSchema",
    "DashboardResponseSchema",
    "DashboardListResponseSchema",
    "WidgetCreateSchema",
    "WidgetUpdateSchema",
    "WidgetResponseSchema",
    "KPICreateSchema",
    "KPIUpdateSchema",
    "KPIResponseSchema",
    "KPIListResponseSchema",
    "KPICalculationResponseSchema",
    "OrganizationCreateSchema",
    "OrganizationUpdateSchema",
    "OrganizationResponseSchema",
    "OrganizationListResponseSchema",
    "DepartmentCreateSchema",
    "DepartmentUpdateSchema",
    "DepartmentResponseSchema",
    "DepartmentListResponseSchema",
    "TokenSchema",
    "TokenRefreshSchema",
    "AuthResponseSchema",
    "ErrorResponseSchema",
    "SuccessResponseSchema",
    "PaginationSchema",
    "HealthCheckSchema"
]
