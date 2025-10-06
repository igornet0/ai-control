"""
Organization repository implementation using SQLAlchemy.
Implements the OrganizationRepository interface for database operations.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.user_management.entities.organization import Organization
from src.domain.user_management.repositories.organization_repository import OrganizationRepository
from src.domain.user_management.value_objects.organization_id import OrganizationId
from src.infrastructure.database.models.organization_model import OrganizationModel


class OrganizationRepositoryImpl(OrganizationRepository):
    """SQLAlchemy implementation of OrganizationRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, organization_id: OrganizationId) -> Optional[Organization]:
        """Get organization by ID."""
        query = select(OrganizationModel).where(OrganizationModel.id == organization_id.value)
        result = await self._session.execute(query)
        organization_model = result.scalar_one_or_none()
        
        if not organization_model:
            return None
        
        return self._to_domain_entity(organization_model)

    async def get_by_name(self, name: str) -> Optional[Organization]:
        """Get organization by name."""
        query = select(OrganizationModel).where(OrganizationModel.name == name)
        result = await self._session.execute(query)
        organization_model = result.scalar_one_or_none()
        
        if not organization_model:
            return None
        
        return self._to_domain_entity(organization_model)

    async def get_all(self) -> List[Organization]:
        """Get all organizations."""
        query = select(OrganizationModel)
        result = await self._session.execute(query)
        organization_models = result.scalars().all()
        
        return [self._to_domain_entity(org_model) for org_model in organization_models]

    async def search_organizations(
        self,
        query_text: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Organization]:
        """Search organizations with filters."""
        query = select(OrganizationModel)
        
        if query_text:
            query = query.where(
                OrganizationModel.name.ilike(f"%{query_text}%")
            )
        
        query = query.limit(limit).offset(offset)
        
        result = await self._session.execute(query)
        organization_models = result.scalars().all()
        
        return [self._to_domain_entity(org_model) for org_model in organization_models]

    async def save(self, organization: Organization) -> Organization:
        """Save organization."""
        organization_model = self._to_model(organization)
        
        # Check if organization exists
        existing_organization = await self.get_by_id(organization.id)
        
        if existing_organization:
            # Update existing organization
            organization_model.id = organization.id.value
            self._session.merge(organization_model)
        else:
            # Create new organization
            self._session.add(organization_model)
        
        await self._session.commit()
        await self._session.refresh(organization_model)
        
        return self._to_domain_entity(organization_model)

    async def delete(self, organization_id: OrganizationId) -> bool:
        """Delete organization by ID."""
        query = select(OrganizationModel).where(OrganizationModel.id == organization_id.value)
        result = await self._session.execute(query)
        organization_model = result.scalar_one_or_none()
        
        if not organization_model:
            return False
        
        await self._session.delete(organization_model)
        await self._session.commit()
        
        return True

    async def exists(self, organization_id: OrganizationId) -> bool:
        """Check if organization exists."""
        query = select(OrganizationModel.id).where(OrganizationModel.id == organization_id.value)
        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def exists_by_name(self, name: str) -> bool:
        """Check if organization exists by name."""
        query = select(OrganizationModel.id).where(OrganizationModel.name == name)
        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    def _to_domain_entity(self, organization_model: OrganizationModel) -> Organization:
        """Convert OrganizationModel to Organization domain entity."""
        return Organization(
            id=OrganizationId(organization_model.id),
            name=organization_model.name,
            description=organization_model.description,
            website=organization_model.website,
            address=organization_model.address,
            phone=organization_model.phone,
            email=organization_model.email,
            created_at=organization_model.created_at,
            updated_at=organization_model.updated_at,
        )

    def _to_model(self, organization: Organization) -> OrganizationModel:
        """Convert Organization domain entity to OrganizationModel."""
        return OrganizationModel(
            id=organization.id.value,
            name=organization.name,
            description=organization.description,
            website=organization.website,
            address=organization.address,
            phone=organization.phone,
            email=organization.email,
            created_at=organization.created_at,
            updated_at=organization.updated_at,
        )
