"""
ORM функции для работы с департаментами
"""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.database.models.main_models import Department

async def orm_add_department(
    session: AsyncSession,
    name: str,
    organization_id: int,
    description: Optional[str] = None,
    manager_id: Optional[int] = None
) -> Department:
    """Добавить департамент"""
    department = Department(
        name=name,
        description=description,
        organization_id=organization_id,
        manager_id=manager_id
    )
    session.add(department)
    await session.commit()
    await session.refresh(department)
    return department

async def orm_get_department_by_id(
    session: AsyncSession,
    department_id: int
) -> Optional[Department]:
    """Получить департамент по ID"""
    query = select(Department).where(Department.id == department_id)
    result = await session.execute(query)
    return result.scalars().first()

async def orm_get_departments_by_organization(
    session: AsyncSession,
    organization_id: int
) -> List[Department]:
    """Получить департаменты по организации"""
    query = select(Department).where(Department.organization_id == organization_id)
    result = await session.execute(query)
    return result.scalars().all()
