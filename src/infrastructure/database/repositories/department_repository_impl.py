"""
Department repository implementation using SQLAlchemy.
Implements the DepartmentRepository interface for database operations.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.user_management.entities.department import Department
from src.domain.user_management.repositories.department_repository import DepartmentRepository
from src.domain.user_management.value_objects.department_id import DepartmentId
from src.domain.user_management.value_objects.organization_id import OrganizationId
from src.infrastructure.database.models.department_model import DepartmentModel


class DepartmentRepositoryImpl(DepartmentRepository):
    """SQLAlchemy implementation of DepartmentRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, department_id: DepartmentId) -> Optional[Department]:
        """Get department by ID."""
        query = select(DepartmentModel).where(DepartmentModel.id == department_id.value)
        result = await self._session.execute(query)
        department_model = result.scalar_one_or_none()
        
        if not department_model:
            return None
        
        return self._to_domain_entity(department_model)

    async def get_by_organization(self, organization_id: OrganizationId) -> List[Department]:
        """Get departments by organization."""
        query = select(DepartmentModel).where(DepartmentModel.organization_id == organization_id.value)
        result = await self._session.execute(query)
        department_models = result.scalars().all()
        
        return [self._to_domain_entity(dept_model) for dept_model in department_models]

    async def get_by_name(self, name: str, organization_id: OrganizationId) -> Optional[Department]:
        """Get department by name within organization."""
        query = select(DepartmentModel).where(
            and_(
                DepartmentModel.name == name,
                DepartmentModel.organization_id == organization_id.value
            )
        )
        result = await self._session.execute(query)
        department_model = result.scalar_one_or_none()
        
        if not department_model:
            return None
        
        return self._to_domain_entity(department_model)

    async def get_all(self) -> List[Department]:
        """Get all departments."""
        query = select(DepartmentModel)
        result = await self._session.execute(query)
        department_models = result.scalars().all()
        
        return [self._to_domain_entity(dept_model) for dept_model in department_models]

    async def search_departments(
        self,
        query_text: Optional[str] = None,
        organization_id: Optional[OrganizationId] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Department]:
        """Search departments with filters."""
        query = select(DepartmentModel)
        
        conditions = []
        
        if query_text:
            conditions.append(
                DepartmentModel.name.ilike(f"%{query_text}%")
            )
        
        if organization_id:
            conditions.append(DepartmentModel.organization_id == organization_id.value)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.limit(limit).offset(offset)
        
        result = await self._session.execute(query)
        department_models = result.scalars().all()
        
        return [self._to_domain_entity(dept_model) for dept_model in department_models]

    async def save(self, department: Department) -> Department:
        """Save department."""
        department_model = self._to_model(department)
        
        # Check if department exists
        existing_department = await self.get_by_id(department.id)
        
        if existing_department:
            # Update existing department
            department_model.id = department.id.value
            self._session.merge(department_model)
        else:
            # Create new department
            self._session.add(department_model)
        
        await self._session.commit()
        await self._session.refresh(department_model)
        
        return self._to_domain_entity(department_model)

    async def delete(self, department_id: DepartmentId) -> bool:
        """Delete department by ID."""
        query = select(DepartmentModel).where(DepartmentModel.id == department_id.value)
        result = await self._session.execute(query)
        department_model = result.scalar_one_or_none()
        
        if not department_model:
            return False
        
        await self._session.delete(department_model)
        await self._session.commit()
        
        return True

    async def exists(self, department_id: DepartmentId) -> bool:
        """Check if department exists."""
        query = select(DepartmentModel.id).where(DepartmentModel.id == department_id.value)
        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def exists_by_name(self, name: str, organization_id: OrganizationId) -> bool:
        """Check if department exists by name within organization."""
        query = select(DepartmentModel.id).where(
            and_(
                DepartmentModel.name == name,
                DepartmentModel.organization_id == organization_id.value
            )
        )
        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def count_by_organization(self, organization_id: OrganizationId) -> int:
        """Count departments by organization."""
        query = select(DepartmentModel.id).where(DepartmentModel.organization_id == organization_id.value)
        result = await self._session.execute(query)
        return len(result.scalars().all())

    def _to_domain_entity(self, department_model: DepartmentModel) -> Department:
        """Convert DepartmentModel to Department domain entity."""
        return Department(
            id=DepartmentId(department_model.id),
            name=department_model.name,
            description=department_model.description,
            organization_id=OrganizationId(department_model.organization_id),
            manager_id=department_model.manager_id,
            created_at=department_model.created_at,
            updated_at=department_model.updated_at,
        )

    def _to_model(self, department: Department) -> DepartmentModel:
        """Convert Department domain entity to DepartmentModel."""
        return DepartmentModel(
            id=department.id.value,
            name=department.name,
            description=department.description,
            organization_id=department.organization_id.value,
            manager_id=department.manager_id,
            created_at=department.created_at,
            updated_at=department.updated_at,
        )
