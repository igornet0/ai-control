"""
Authentication service for handling user authentication and authorization.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import UUID

from src.infrastructure.auth.jwt_service import JWTService
from src.infrastructure.auth.password_service import PasswordService
from src.domain.exceptions import AuthenticationError, AuthorizationError, EntityNotFound
from src.domain.user_management.repositories.user_repository import UserRepository
from src.domain.user_management.entities.user import User, UserRole


class AuthService:
    """Service for handling authentication and authorization."""
    
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
        self.jwt_service = JWTService()
        self.password_service = PasswordService()
    
    async def authenticate_user(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate user with username and password."""
        try:
            # Get user by username
            user = await self.user_repository.get_by_username(username)
            if not user:
                raise AuthenticationError("Invalid username or password")
            
            # Check if user is active
            if not user.is_active:
                raise AuthenticationError("User account is deactivated")
            
            # Verify password
            if not self.password_service.verify_password(password, user.password_hash):
                raise AuthenticationError("Invalid username or password")
            
            # Update last login
            user.last_login = datetime.utcnow()
            await self.user_repository.update(user)
            
            # Create tokens
            tokens = self.jwt_service.create_token_pair(
                user_id=user.id,
                username=user.username,
                email=user.email,
                role=user.role.value,
                permissions=self._get_user_permissions(user),
                organization_id=user.organization_id,
                department_id=user.department_id,
            )
            
            return {
                "user": user,
                "tokens": tokens,
                "authenticated": True,
            }
            
        except EntityNotFound:
            raise AuthenticationError("Invalid username or password")
        except Exception as e:
            raise AuthenticationError(f"Authentication failed: {str(e)}")
    
    async def authenticate_user_by_email(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate user with email and password."""
        try:
            # Get user by email
            user = await self.user_repository.get_by_email(email)
            if not user:
                raise AuthenticationError("Invalid email or password")
            
            # Check if user is active
            if not user.is_active:
                raise AuthenticationError("User account is deactivated")
            
            # Verify password
            if not self.password_service.verify_password(password, user.password_hash):
                raise AuthenticationError("Invalid email or password")
            
            # Update last login
            user.last_login = datetime.utcnow()
            await self.user_repository.update(user)
            
            # Create tokens
            tokens = self.jwt_service.create_token_pair(
                user_id=user.id,
                username=user.username,
                email=user.email,
                role=user.role.value,
                permissions=self._get_user_permissions(user),
                organization_id=user.organization_id,
                department_id=user.department_id,
            )
            
            return {
                "user": user,
                "tokens": tokens,
                "authenticated": True,
            }
            
        except EntityNotFound:
            raise AuthenticationError("Invalid email or password")
        except Exception as e:
            raise AuthenticationError(f"Authentication failed: {str(e)}")
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, str]:
        """Refresh access token using refresh token."""
        try:
            # Verify refresh token
            payload = self.jwt_service.verify_refresh_token(refresh_token)
            user_id = UUID(payload.get("sub"))
            
            # Get user to ensure they still exist and are active
            user = await self.user_repository.get_by_id(user_id)
            if not user:
                raise AuthenticationError("User not found")
            
            if not user.is_active:
                raise AuthenticationError("User account is deactivated")
            
            # Create new access token
            access_token = self.jwt_service.create_access_token(
                user_id=user.id,
                username=user.username,
                email=user.email,
                role=user.role.value,
                permissions=self._get_user_permissions(user),
                organization_id=user.organization_id,
                department_id=user.department_id,
            )
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
            }
            
        except Exception as e:
            raise AuthenticationError(f"Token refresh failed: {str(e)}")
    
    async def get_current_user(self, token: str) -> User:
        """Get current user from JWT token."""
        try:
            # Verify token and get user ID
            user_id = self.jwt_service.get_user_id_from_token(token)
            
            # Get user from repository
            user = await self.user_repository.get_by_id(user_id)
            if not user:
                raise AuthenticationError("User not found")
            
            if not user.is_active:
                raise AuthenticationError("User account is deactivated")
            
            return user
            
        except Exception as e:
            raise AuthenticationError(f"Failed to get current user: {str(e)}")
    
    async def change_password(
        self,
        user_id: UUID,
        current_password: str,
        new_password: str,
    ) -> bool:
        """Change user password."""
        try:
            # Get user
            user = await self.user_repository.get_by_id(user_id)
            if not user:
                raise EntityNotFound("User", str(user_id))
            
            # Validate password change
            validation = self.password_service.validate_password_change(
                current_password, new_password, user.password_hash
            )
            
            if not validation["valid"]:
                raise AuthenticationError(f"Password change validation failed: {', '.join(validation['errors'])}")
            
            # Hash new password
            new_password_hash = self.password_service.hash_password(new_password)
            
            # Update user password
            user.password_hash = new_password_hash
            await self.user_repository.update(user)
            
            return True
            
        except Exception as e:
            raise AuthenticationError(f"Password change failed: {str(e)}")
    
    async def reset_password(self, email: str) -> bool:
        """Initiate password reset process."""
        try:
            # Get user by email
            user = await self.user_repository.get_by_email(email)
            if not user:
                # Don't reveal if email exists or not
                return True
            
            if not user.is_active:
                # Don't reveal if account is deactivated
                return True
            
            # In a real implementation, you would:
            # 1. Generate a secure reset token
            # 2. Store it in database with expiration
            # 3. Send email with reset link
            
            # For now, we'll just return True
            return True
            
        except Exception as e:
            raise AuthenticationError(f"Password reset failed: {str(e)}")
    
    async def confirm_password_reset(
        self,
        reset_token: str,
        new_password: str,
    ) -> bool:
        """Confirm password reset with token."""
        try:
            # In a real implementation, you would:
            # 1. Verify reset token
            # 2. Check if token is expired
            # 3. Get user from token
            # 4. Update password
            # 5. Invalidate reset token
            
            # For now, we'll just return True
            return True
            
        except Exception as e:
            raise AuthenticationError(f"Password reset confirmation failed: {str(e)}")
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token and return payload."""
        return self.jwt_service.verify_access_token(token)
    
    def is_token_valid(self, token: str) -> bool:
        """Check if token is valid."""
        return self.jwt_service.is_token_valid(token)
    
    def is_token_expired(self, token: str) -> bool:
        """Check if token is expired."""
        return self.jwt_service.is_token_expired(token)
    
    def get_token_info(self, token: str) -> Dict[str, Any]:
        """Get comprehensive token information."""
        return self.jwt_service.get_token_info(token)
    
    def has_permission(self, token: str, permission: str) -> bool:
        """Check if user has specific permission."""
        try:
            permissions = self.jwt_service.get_permissions_from_token(token)
            return permission in permissions
        except AuthenticationError:
            return False
    
    def has_role(self, token: str, role: str) -> bool:
        """Check if user has specific role."""
        try:
            user_role = self.jwt_service.get_role_from_token(token)
            return user_role == role
        except AuthenticationError:
            return False
    
    def has_any_role(self, token: str, roles: List[str]) -> bool:
        """Check if user has any of the specified roles."""
        try:
            user_role = self.jwt_service.get_role_from_token(token)
            return user_role in roles
        except AuthenticationError:
            return False
    
    def is_admin(self, token: str) -> bool:
        """Check if user is admin."""
        return self.has_role(token, UserRole.ADMIN.value)
    
    def is_manager(self, token: str) -> bool:
        """Check if user is manager or higher."""
        return self.has_any_role(token, [UserRole.ADMIN.value, UserRole.CEO.value, UserRole.MANAGER.value])
    
    def is_employee(self, token: str) -> bool:
        """Check if user is employee or higher."""
        return self.has_any_role(token, [
            UserRole.ADMIN.value,
            UserRole.CEO.value,
            UserRole.MANAGER.value,
            UserRole.EMPLOYEE.value
        ])
    
    def get_user_id_from_token(self, token: str) -> UUID:
        """Get user ID from token."""
        return self.jwt_service.get_user_id_from_token(token)
    
    def get_username_from_token(self, token: str) -> str:
        """Get username from token."""
        return self.jwt_service.get_username_from_token(token)
    
    def get_email_from_token(self, token: str) -> str:
        """Get email from token."""
        return self.jwt_service.get_email_from_token(token)
    
    def get_role_from_token(self, token: str) -> str:
        """Get role from token."""
        return self.jwt_service.get_role_from_token(token)
    
    def get_permissions_from_token(self, token: str) -> List[str]:
        """Get permissions from token."""
        return self.jwt_service.get_permissions_from_token(token)
    
    def get_organization_id_from_token(self, token: str) -> Optional[UUID]:
        """Get organization ID from token."""
        return self.jwt_service.get_organization_id_from_token(token)
    
    def get_department_id_from_token(self, token: str) -> Optional[UUID]:
        """Get department ID from token."""
        return self.jwt_service.get_department_id_from_token(token)
    
    def _get_user_permissions(self, user: User) -> List[str]:
        """Get user permissions based on role."""
        permissions = []
        
        # Base permissions for all users
        permissions.extend([
            "read:own_profile",
            "update:own_profile",
            "read:own_tasks",
            "create:own_tasks",
            "update:own_tasks",
            "read:own_documents",
            "create:own_documents",
            "update:own_documents",
            "read:own_events",
            "create:own_events",
            "update:own_events",
        ])
        
        # Role-specific permissions
        if user.role == UserRole.ADMIN:
            permissions.extend([
                "read:all_users",
                "create:users",
                "update:users",
                "delete:users",
                "read:all_tasks",
                "create:tasks",
                "update:tasks",
                "delete:tasks",
                "read:all_documents",
                "create:documents",
                "update:documents",
                "delete:documents",
                "read:all_events",
                "create:events",
                "update:events",
                "delete:events",
                "read:all_kpis",
                "create:kpis",
                "update:kpis",
                "delete:kpis",
                "read:all_dashboards",
                "create:dashboards",
                "update:dashboards",
                "delete:dashboards",
                "read:system_settings",
                "update:system_settings",
                "read:audit_logs",
                "manage:organizations",
                "manage:departments",
            ])
        elif user.role == UserRole.CEO:
            permissions.extend([
                "read:all_users",
                "create:users",
                "update:users",
                "read:all_tasks",
                "create:tasks",
                "update:tasks",
                "read:all_documents",
                "create:documents",
                "update:documents",
                "read:all_events",
                "create:events",
                "update:events",
                "read:all_kpis",
                "create:kpis",
                "update:kpis",
                "read:all_dashboards",
                "create:dashboards",
                "update:dashboards",
                "read:system_settings",
                "manage:organizations",
                "manage:departments",
            ])
        elif user.role == UserRole.MANAGER:
            permissions.extend([
                "read:team_users",
                "create:team_users",
                "update:team_users",
                "read:team_tasks",
                "create:tasks",
                "update:tasks",
                "read:team_documents",
                "create:documents",
                "update:documents",
                "read:team_events",
                "create:events",
                "update:events",
                "read:team_kpis",
                "create:kpis",
                "update:kpis",
                "read:team_dashboards",
                "create:dashboards",
                "update:dashboards",
                "manage:team",
            ])
        elif user.role == UserRole.EMPLOYEE:
            permissions.extend([
                "read:team_tasks",
                "read:team_documents",
                "read:team_events",
                "read:team_kpis",
                "read:team_dashboards",
            ])
        
        return permissions
