"""
Dashboard repository implementation using SQLAlchemy.
Implements the DashboardRepository interface for database operations.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.dashboard.entities.dashboard import Dashboard
from src.domain.dashboard.repositories.dashboard_repository import DashboardRepository
from src.domain.dashboard.value_objects.dashboard_id import DashboardId
from src.domain.user_management.value_objects.user_id import UserId
from src.infrastructure.database.models.dashboard_model import DashboardModel


class DashboardRepositoryImpl(DashboardRepository):
    """SQLAlchemy implementation of DashboardRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, dashboard_id: DashboardId) -> Optional[Dashboard]:
        """Get dashboard by ID."""
        query = select(DashboardModel).where(DashboardModel.id == dashboard_id.value)
        result = await self._session.execute(query)
        dashboard_model = result.scalar_one_or_none()
        
        if not dashboard_model:
            return None
        
        return self._to_domain_entity(dashboard_model)

    async def get_by_user(self, user_id: UserId) -> List[Dashboard]:
        """Get dashboards by user."""
        query = select(DashboardModel).where(DashboardModel.user_id == user_id.value)
        result = await self._session.execute(query)
        dashboard_models = result.scalars().all()
        
        return [self._to_domain_entity(dashboard_model) for dashboard_model in dashboard_models]

    async def get_public_dashboards(self) -> List[Dashboard]:
        """Get public dashboards."""
        query = select(DashboardModel).where(DashboardModel.is_public == True)
        result = await self._session.execute(query)
        dashboard_models = result.scalars().all()
        
        return [self._to_domain_entity(dashboard_model) for dashboard_model in dashboard_models]

    async def search_dashboards(
        self,
        query_text: Optional[str] = None,
        user_id: Optional[UserId] = None,
        is_public: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dashboard]:
        """Search dashboards with filters."""
        query = select(DashboardModel)
        
        conditions = []
        
        if query_text:
            conditions.append(
                DashboardModel.name.ilike(f"%{query_text}%")
            )
        
        if user_id:
            conditions.append(DashboardModel.user_id == user_id.value)
        
        if is_public is not None:
            conditions.append(DashboardModel.is_public == is_public)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.limit(limit).offset(offset)
        
        result = await self._session.execute(query)
        dashboard_models = result.scalars().all()
        
        return [self._to_domain_entity(dashboard_model) for dashboard_model in dashboard_models]

    async def save(self, dashboard: Dashboard) -> Dashboard:
        """Save dashboard."""
        dashboard_model = self._to_model(dashboard)
        
        # Check if dashboard exists
        existing_dashboard = await self.get_by_id(dashboard.id)
        
        if existing_dashboard:
            # Update existing dashboard
            dashboard_model.id = dashboard.id.value
            self._session.merge(dashboard_model)
        else:
            # Create new dashboard
            self._session.add(dashboard_model)
        
        await self._session.commit()
        await self._session.refresh(dashboard_model)
        
        return self._to_domain_entity(dashboard_model)

    async def delete(self, dashboard_id: DashboardId) -> bool:
        """Delete dashboard by ID."""
        query = select(DashboardModel).where(DashboardModel.id == dashboard_id.value)
        result = await self._session.execute(query)
        dashboard_model = result.scalar_one_or_none()
        
        if not dashboard_model:
            return False
        
        await self._session.delete(dashboard_model)
        await self._session.commit()
        
        return True

    async def exists(self, dashboard_id: DashboardId) -> bool:
        """Check if dashboard exists."""
        query = select(DashboardModel.id).where(DashboardModel.id == dashboard_id.value)
        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def count_by_user(self, user_id: UserId) -> int:
        """Count dashboards by user."""
        query = select(DashboardModel.id).where(DashboardModel.user_id == user_id.value)
        result = await self._session.execute(query)
        return len(result.scalars().all())

    def _to_domain_entity(self, dashboard_model: DashboardModel) -> Dashboard:
        """Convert DashboardModel to Dashboard domain entity."""
        return Dashboard(
            id=DashboardId(dashboard_model.id),
            name=dashboard_model.name,
            description=dashboard_model.description,
            user_id=UserId(dashboard_model.user_id),
            is_public=dashboard_model.is_public,
            layout=dashboard_model.layout,
            created_at=dashboard_model.created_at,
            updated_at=dashboard_model.updated_at,
        )

    def _to_model(self, dashboard: Dashboard) -> DashboardModel:
        """Convert Dashboard domain entity to DashboardModel."""
        return DashboardModel(
            id=dashboard.id.value,
            name=dashboard.name,
            description=dashboard.description,
            user_id=dashboard.user_id.value,
            is_public=dashboard.is_public,
            layout=dashboard.layout,
            created_at=dashboard.created_at,
            updated_at=dashboard.updated_at,
        )
