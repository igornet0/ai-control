"""
ORM функции для работы с разрешениями
"""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.database.models.main_models import Permission, RolePermission

async def orm_add_permission(
    session: AsyncSession,
    name: str,
    description: Optional[str] = None,
    resource: str = "",
    action: str = ""
) -> Permission:
    """Добавить разрешение"""
    permission = Permission(
        name=name,
        description=description,
        resource=resource,
        action=action
    )
    session.add(permission)
    await session.commit()
    await session.refresh(permission)
    return permission

async def orm_get_permissions_by_role(
    session: AsyncSession,
    role: str
) -> List[Permission]:
    """Получить разрешения по роли"""
    query = select(Permission).join(RolePermission).where(RolePermission.role == role)
    result = await session.execute(query)
    return result.scalars().all()

async def orm_get_permission_by_id(
    session: AsyncSession,
    permission_id: int
) -> Optional[Permission]:
    """Получить разрешение по ID"""
    query = select(Permission).where(Permission.id == permission_id)
    result = await session.execute(query)
    return result.scalars().first()

async def orm_add_role_permission(
    session: AsyncSession,
    role: str,
    permission_id: int
) -> RolePermission:
    """Добавить связь роли и разрешения"""
    role_permission = RolePermission(
        role=role,
        permission_id=permission_id
    )
    session.add(role_permission)
    await session.commit()
    await session.refresh(role_permission)
    return role_permission
