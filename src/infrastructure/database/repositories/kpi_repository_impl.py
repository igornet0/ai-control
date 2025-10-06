"""
KPI repository implementation using SQLAlchemy.
Implements the KPIRepository interface for database operations.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.kpi.entities.kpi import KPI
from src.domain.kpi.repositories.kpi_repository import KPIRepository
from src.domain.kpi.value_objects.kpi_id import KPIId
from src.domain.kpi.value_objects.kpi_type import KPIType
from src.domain.user_management.value_objects.user_id import UserId
from src.infrastructure.database.models.kpi_model import KPIModel


class KPIRepositoryImpl(KPIRepository):
    """SQLAlchemy implementation of KPIRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, kpi_id: KPIId) -> Optional[KPI]:
        """Get KPI by ID."""
        query = select(KPIModel).where(KPIModel.id == kpi_id.value)
        result = await self._session.execute(query)
        kpi_model = result.scalar_one_or_none()
        
        if not kpi_model:
            return None
        
        return self._to_domain_entity(kpi_model)

    async def get_by_user(self, user_id: UserId) -> List[KPI]:
        """Get KPIs by user."""
        query = select(KPIModel).where(KPIModel.user_id == user_id.value)
        result = await self._session.execute(query)
        kpi_models = result.scalars().all()
        
        return [self._to_domain_entity(kpi_model) for kpi_model in kpi_models]

    async def get_by_type(self, kpi_type: KPIType) -> List[KPI]:
        """Get KPIs by type."""
        query = select(KPIModel).where(KPIModel.kpi_type == kpi_type.value)
        result = await self._session.execute(query)
        kpi_models = result.scalars().all()
        
        return [self._to_domain_entity(kpi_model) for kpi_model in kpi_models]

    async def get_public_kpis(self) -> List[KPI]:
        """Get public KPIs."""
        query = select(KPIModel).where(KPIModel.is_public == True)
        result = await self._session.execute(query)
        kpi_models = result.scalars().all()
        
        return [self._to_domain_entity(kpi_model) for kpi_model in kpi_models]

    async def search_kpis(
        self,
        query_text: Optional[str] = None,
        user_id: Optional[UserId] = None,
        kpi_type: Optional[KPIType] = None,
        is_public: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[KPI]:
        """Search KPIs with filters."""
        query = select(KPIModel)
        
        conditions = []
        
        if query_text:
            conditions.append(
                KPIModel.name.ilike(f"%{query_text}%")
            )
        
        if user_id:
            conditions.append(KPIModel.user_id == user_id.value)
        
        if kpi_type:
            conditions.append(KPIModel.kpi_type == kpi_type.value)
        
        if is_public is not None:
            conditions.append(KPIModel.is_public == is_public)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.limit(limit).offset(offset)
        
        result = await self._session.execute(query)
        kpi_models = result.scalars().all()
        
        return [self._to_domain_entity(kpi_model) for kpi_model in kpi_models]

    async def save(self, kpi: KPI) -> KPI:
        """Save KPI."""
        kpi_model = self._to_model(kpi)
        
        # Check if KPI exists
        existing_kpi = await self.get_by_id(kpi.id)
        
        if existing_kpi:
            # Update existing KPI
            kpi_model.id = kpi.id.value
            self._session.merge(kpi_model)
        else:
            # Create new KPI
            self._session.add(kpi_model)
        
        await self._session.commit()
        await self._session.refresh(kpi_model)
        
        return self._to_domain_entity(kpi_model)

    async def delete(self, kpi_id: KPIId) -> bool:
        """Delete KPI by ID."""
        query = select(KPIModel).where(KPIModel.id == kpi_id.value)
        result = await self._session.execute(query)
        kpi_model = result.scalar_one_or_none()
        
        if not kpi_model:
            return False
        
        await self._session.delete(kpi_model)
        await self._session.commit()
        
        return True

    async def exists(self, kpi_id: KPIId) -> bool:
        """Check if KPI exists."""
        query = select(KPIModel.id).where(KPIModel.id == kpi_id.value)
        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def count_by_user(self, user_id: UserId) -> int:
        """Count KPIs by user."""
        query = select(KPIModel.id).where(KPIModel.user_id == user_id.value)
        result = await self._session.execute(query)
        return len(result.scalars().all())

    async def count_by_type(self, kpi_type: KPIType) -> int:
        """Count KPIs by type."""
        query = select(KPIModel.id).where(KPIModel.kpi_type == kpi_type.value)
        result = await self._session.execute(query)
        return len(result.scalars().all())

    def _to_domain_entity(self, kpi_model: KPIModel) -> KPI:
        """Convert KPIModel to KPI domain entity."""
        return KPI(
            id=KPIId(kpi_model.id),
            name=kpi_model.name,
            description=kpi_model.description,
            kpi_type=KPIType.from_string(kpi_model.kpi_type),
            target_value=kpi_model.target_value,
            current_value=kpi_model.current_value,
            unit=kpi_model.unit,
            user_id=UserId(kpi_model.user_id),
            is_public=kpi_model.is_public,
            calculation_formula=kpi_model.calculation_formula,
            data_source=kpi_model.data_source,
            created_at=kpi_model.created_at,
            updated_at=kpi_model.updated_at,
        )

    def _to_model(self, kpi: KPI) -> KPIModel:
        """Convert KPI domain entity to KPIModel."""
        return KPIModel(
            id=kpi.id.value,
            name=kpi.name,
            description=kpi.description,
            kpi_type=kpi.kpi_type.value,
            target_value=kpi.target_value,
            current_value=kpi.current_value,
            unit=kpi.unit,
            user_id=kpi.user_id.value,
            is_public=kpi.is_public,
            calculation_formula=kpi.calculation_formula,
            data_source=kpi.data_source,
            created_at=kpi.created_at,
            updated_at=kpi.updated_at,
        )
