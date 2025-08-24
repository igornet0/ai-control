"""
ORM функции для работы с организациями
"""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.database.models.main_models import Organization

async def orm_add_organization(
    session: AsyncSession,
    name: str,
    description: Optional[str] = None,
    domain: Optional[str] = None,
    logo_url: Optional[str] = None
) -> Organization:
    """Добавить организацию"""
    organization = Organization(
        name=name,
        description=description,
        domain=domain,
        logo_url=logo_url
    )
    session.add(organization)
    await session.commit()
    await session.refresh(organization)
    return organization

async def orm_get_organization_by_id(
    session: AsyncSession,
    organization_id: int
) -> Optional[Organization]:
    """Получить организацию по ID"""
    query = select(Organization).where(Organization.id == organization_id)
    result = await session.execute(query)
    return result.scalars().first()

async def orm_get_organizations(
    session: AsyncSession
) -> List[Organization]:
    """Получить все организации"""
    query = select(Organization)
    result = await session.execute(query)
    return result.scalars().all()
