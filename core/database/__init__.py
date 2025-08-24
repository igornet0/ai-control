from core.database.engine import Database, get_db_helper
from core.database.base import Base

def get_session():
    """Get database session from db_helper"""
    return get_db_helper().get_session()

# Экспортируем основные классы
__all__ = [
    "Database", 
    "get_db_helper", 
    "get_session",
    "Base"
]

# Импортируем только основные модели без дублирования
from core.database.models.main_models import User, Organization, Department, Permission, RolePermission
from core.database.models.team_model import Team, TeamMember, TeamRole, TeamStatus
from core.database.models.project_model import Project, ProjectTeam, ProjectStatus, ProjectPriority
from core.database.models.task_model import Task, TaskComment, TaskTimeLog

# Импортируем ORM функции
from core.database.orm.orm_query_user import (orm_get_user_by_login, orm_get_user, orm_add_user,
                                             orm_get_user_by_id, orm_update_user, orm_get_users_by_role,
                                             orm_get_subordinates, orm_get_user_hierarchy)
from core.database.orm.orm_query_organization import (orm_add_organization, orm_get_organization_by_id,
                                                     orm_get_organizations)
from core.database.orm.orm_query_department import (orm_add_department, orm_get_department_by_id,
                                                   orm_get_departments_by_organization)
from core.database.orm.orm_query_permission import (orm_add_permission, orm_get_permissions_by_role,
                                                   orm_get_permission_by_id, orm_add_role_permission)