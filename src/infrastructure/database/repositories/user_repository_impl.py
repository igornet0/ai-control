"""
User repository implementation.
Implements the UserRepository interface using SQLAlchemy.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.user_management.entities.user import User, UserRole, UserStatus
from src.domain.user_management.repositories.user_repository import UserRepository
from src.infrastructure.database.models.user_model import UserModel
from src.infrastructure.config.logging import get_logger

logger = get_logger(__name__)


class UserRepositoryImpl(UserRepository):
    """SQLAlchemy implementation of UserRepository."""
    
    def __init__(self, session: AsyncSession):
        self._session = session
    
    async def get_by_id(self, entity_id: UUID) -> Optional[User]:
        """Get user by ID."""
        try:
            stmt = select(UserModel).where(UserModel.id == entity_id)
            result = await self._session.execute(stmt)
            user_model = result.scalar_one_or_none()
            
            if user_model:
                return self._model_to_entity(user_model)
            return None
            
        except Exception as e:
            logger.error("Error getting user by ID", extra={
                "user_id": str(entity_id),
                "error": str(e),
            })
            raise
    
    async def get_by_login(self, login: str) -> Optional[User]:
        """Get user by login."""
        try:
            stmt = select(UserModel).where(UserModel.login == login.lower())
            result = await self._session.execute(stmt)
            user_model = result.scalar_one_or_none()
            
            if user_model:
                return self._model_to_entity(user_model)
            return None
            
        except Exception as e:
            logger.error("Error getting user by login", extra={
                "login": login,
                "error": str(e),
            })
            raise
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        try:
            stmt = select(UserModel).where(UserModel.email == email.lower())
            result = await self._session.execute(stmt)
            user_model = result.scalar_one_or_none()
            
            if user_model:
                return self._model_to_entity(user_model)
            return None
            
        except Exception as e:
            logger.error("Error getting user by email", extra={
                "email": email,
                "error": str(e),
            })
            raise
    
    async def get_by_organization(self, organization_id: UUID) -> List[User]:
        """Get all users in an organization."""
        try:
            stmt = select(UserModel).where(UserModel.organization_id == organization_id)
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error getting users by organization", extra={
                "organization_id": str(organization_id),
                "error": str(e),
            })
            raise
    
    async def get_by_department(self, department_id: UUID) -> List[User]:
        """Get all users in a department."""
        try:
            stmt = select(UserModel).where(UserModel.department_id == department_id)
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error getting users by department", extra={
                "department_id": str(department_id),
                "error": str(e),
            })
            raise
    
    async def get_by_manager(self, manager_id: UUID) -> List[User]:
        """Get all users managed by a specific manager."""
        try:
            stmt = select(UserModel).where(UserModel.manager_id == manager_id)
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error getting users by manager", extra={
                "manager_id": str(manager_id),
                "error": str(e),
            })
            raise
    
    async def get_by_role(self, role: UserRole) -> List[User]:
        """Get all users with a specific role."""
        try:
            stmt = select(UserModel).where(UserModel.role == role.value)
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error getting users by role", extra={
                "role": role.value,
                "error": str(e),
            })
            raise
    
    async def get_by_status(self, status: UserStatus) -> List[User]:
        """Get all users with a specific status."""
        try:
            stmt = select(UserModel).where(UserModel.status == status.value)
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error getting users by status", extra={
                "status": status.value,
                "error": str(e),
            })
            raise
    
    async def search_users(
        self,
        query: str,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[User]:
        """Search users with filters."""
        try:
            stmt = select(UserModel)
            
            # Add search conditions
            conditions = []
            
            # Text search
            if query:
                search_condition = or_(
                    UserModel.username.ilike(f"%{query}%"),
                    UserModel.email.ilike(f"%{query}%"),
                    UserModel.login.ilike(f"%{query}%"),
                )
                conditions.append(search_condition)
            
            # Filter conditions
            if organization_id:
                conditions.append(UserModel.organization_id == organization_id)
            
            if department_id:
                conditions.append(UserModel.department_id == department_id)
            
            if role:
                conditions.append(UserModel.role == role.value)
            
            if status:
                conditions.append(UserModel.status == status.value)
            
            # Apply conditions
            if conditions:
                stmt = stmt.where(and_(*conditions))
            
            # Apply pagination
            stmt = stmt.offset(offset).limit(limit)
            
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error searching users", extra={
                "query": query,
                "organization_id": str(organization_id) if organization_id else None,
                "department_id": str(department_id) if department_id else None,
                "role": role.value if role else None,
                "status": status.value if status else None,
                "error": str(e),
            })
            raise
    
    async def count_users(
        self,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
    ) -> int:
        """Count users with filters."""
        try:
            from sqlalchemy import func
            
            stmt = select(func.count(UserModel.id))
            
            # Add filter conditions
            conditions = []
            
            if organization_id:
                conditions.append(UserModel.organization_id == organization_id)
            
            if department_id:
                conditions.append(UserModel.department_id == department_id)
            
            if role:
                conditions.append(UserModel.role == role.value)
            
            if status:
                conditions.append(UserModel.status == status.value)
            
            # Apply conditions
            if conditions:
                stmt = stmt.where(and_(*conditions))
            
            result = await self._session.execute(stmt)
            count = result.scalar()
            
            return count or 0
            
        except Exception as e:
            logger.error("Error counting users", extra={
                "organization_id": str(organization_id) if organization_id else None,
                "department_id": str(department_id) if department_id else None,
                "role": role.value if role else None,
                "status": status.value if status else None,
                "error": str(e),
            })
            raise
    
    async def exists_by_login(self, login: str) -> bool:
        """Check if user exists by login."""
        try:
            stmt = select(UserModel.id).where(UserModel.login == login.lower())
            result = await self._session.execute(stmt)
            return result.scalar_one_or_none() is not None
            
        except Exception as e:
            logger.error("Error checking user existence by login", extra={
                "login": login,
                "error": str(e),
            })
            raise
    
    async def exists_by_email(self, email: str) -> bool:
        """Check if user exists by email."""
        try:
            stmt = select(UserModel.id).where(UserModel.email == email.lower())
            result = await self._session.execute(stmt)
            return result.scalar_one_or_none() is not None
            
        except Exception as e:
            logger.error("Error checking user existence by email", extra={
                "email": email,
                "error": str(e),
            })
            raise
    
    async def get_user_hierarchy(self, user_id: UUID) -> List[User]:
        """Get user hierarchy (manager and all subordinates)."""
        try:
            # Get user
            user = await self.get_by_id(user_id)
            if not user:
                return []
            
            hierarchy = [user]
            
            # Get manager
            if user.manager_id:
                manager = await self.get_by_id(user.manager_id)
                if manager:
                    hierarchy.insert(0, manager)
            
            # Get subordinates
            subordinates = await self.get_by_manager(user_id)
            hierarchy.extend(subordinates)
            
            return hierarchy
            
        except Exception as e:
            logger.error("Error getting user hierarchy", extra={
                "user_id": str(user_id),
                "error": str(e),
            })
            raise
    
    async def get_active_users(self, organization_id: Optional[UUID] = None) -> List[User]:
        """Get all active users."""
        try:
            stmt = select(UserModel).where(UserModel.is_active == True)
            
            if organization_id:
                stmt = stmt.where(UserModel.organization_id == organization_id)
            
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error getting active users", extra={
                "organization_id": str(organization_id) if organization_id else None,
                "error": str(e),
            })
            raise
    
    async def get_recently_logged_in_users(self, days: int = 7) -> List[User]:
        """Get users who logged in recently."""
        try:
            from datetime import datetime, timedelta
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            stmt = select(UserModel).where(
                and_(
                    UserModel.last_login.isnot(None),
                    UserModel.last_login >= cutoff_date
                )
            )
            
            result = await self._session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(user_model) for user_model in user_models]
            
        except Exception as e:
            logger.error("Error getting recently logged in users", extra={
                "days": days,
                "error": str(e),
            })
            raise
    
    async def save(self, entity: User) -> User:
        """Save user."""
        try:
            # Check if user exists
            existing_user = await self.get_by_id(entity.id)
            
            if existing_user:
                # Update existing user
                user_model = await self._get_model_by_id(entity.id)
                self._update_model_from_entity(user_model, entity)
            else:
                # Create new user
                user_model = self._entity_to_model(entity)
                self._session.add(user_model)
            
            await self._session.commit()
            await self._session.refresh(user_model)
            
            return self._model_to_entity(user_model)
            
        except Exception as e:
            await self._session.rollback()
            logger.error("Error saving user", extra={
                "user_id": str(entity.id),
                "error": str(e),
            })
            raise
    
    async def delete(self, entity_id: UUID) -> bool:
        """Delete user by ID."""
        try:
            user_model = await self._get_model_by_id(entity_id)
            if not user_model:
                return False
            
            await self._session.delete(user_model)
            await self._session.commit()
            
            return True
            
        except Exception as e:
            await self._session.rollback()
            logger.error("Error deleting user", extra={
                "user_id": str(entity_id),
                "error": str(e),
            })
            raise
    
    async def exists(self, entity_id: UUID) -> bool:
        """Check if user exists."""
        try:
            stmt = select(UserModel.id).where(UserModel.id == entity_id)
            result = await self._session.execute(stmt)
            return result.scalar_one_or_none() is not None
            
        except Exception as e:
            logger.error("Error checking user existence", extra={
                "user_id": str(entity_id),
                "error": str(e),
            })
            raise
    
    async def _get_model_by_id(self, user_id: UUID) -> Optional[UserModel]:
        """Get user model by ID."""
        stmt = select(UserModel).where(UserModel.id == user_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
    
    def _model_to_entity(self, model: UserModel) -> User:
        """Convert model to entity."""
        return User(
            id=model.id,
            login=model.login,
            username=model.username,
            email=model.email,
            password_hash=model.password_hash,
            role=UserRole(model.role),
            status=UserStatus(model.status),
            is_active=model.is_active,
            manager_id=model.manager_id,
            department_id=model.department_id,
            organization_id=model.organization_id,
            position=model.position,
            phone=model.phone,
            avatar_url=model.avatar_url,
            bio=model.bio,
            created_at=model.created_at,
            updated_at=model.updated_at,
            last_login=model.last_login,
        )
    
    def _entity_to_model(self, entity: User) -> UserModel:
        """Convert entity to model."""
        return UserModel(
            id=entity.id,
            login=entity.login,
            username=entity.username,
            email=entity.email,
            password_hash=entity.password_hash,
            role=entity.role.value,
            status=entity.status.value,
            is_active=entity.is_active,
            manager_id=entity.manager_id,
            department_id=entity.department_id,
            organization_id=entity.organization_id,
            position=entity.position,
            phone=entity.phone,
            avatar_url=entity.avatar_url,
            bio=entity.bio,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            last_login=entity.last_login,
        )
    
    def _update_model_from_entity(self, model: UserModel, entity: User) -> None:
        """Update model from entity."""
        model.login = entity.login
        model.username = entity.username
        model.email = entity.email
        model.password_hash = entity.password_hash
        model.role = entity.role.value
        model.status = entity.status.value
        model.is_active = entity.is_active
        model.manager_id = entity.manager_id
        model.department_id = entity.department_id
        model.organization_id = entity.organization_id
        model.position = entity.position
        model.phone = entity.phone
        model.avatar_url = entity.avatar_url
        model.bio = entity.bio
        model.updated_at = entity.updated_at
        model.last_login = entity.last_login
