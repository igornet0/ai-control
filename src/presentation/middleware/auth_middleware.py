"""
Authentication middleware for FastAPI.
Handles JWT token validation and user authentication.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.utils import get_authorization_scheme_param

from src.infrastructure.auth.auth_service import AuthService
from src.infrastructure.auth.jwt_service import JWTService
from src.domain.exceptions import AuthenticationError, AuthorizationError
from src.presentation.api.dependencies import get_user_repository


# Security scheme
security = HTTPBearer(auto_error=False)


class AuthMiddleware:
    """Authentication middleware for FastAPI."""
    
    def __init__(self, auth_service: AuthService):
        self.auth_service = auth_service
        self.jwt_service = JWTService()
    
    async def get_current_user_id(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> UUID:
        """Get current user ID from JWT token."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_id = self.jwt_service.get_user_id_from_token(credentials.credentials)
            return user_id
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def get_current_user(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> dict:
        """Get current user from JWT token."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user = await self.auth_service.get_current_user(credentials.credentials)
            return {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "is_active": user.is_active,
                "organization_id": user.organization_id,
                "department_id": user.department_id,
            }
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def get_optional_current_user(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> Optional[dict]:
        """Get current user from JWT token (optional)."""
        if not credentials:
            return None
        
        try:
            user = await self.auth_service.get_current_user(credentials.credentials)
            return {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "is_active": user.is_active,
                "organization_id": user.organization_id,
                "department_id": user.department_id,
            }
        except AuthenticationError:
            return None
    
    async def require_permission(self, permission: str, credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
        """Require specific permission."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            if not self.auth_service.has_permission(credentials.credentials, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission required: {permission}",
                )
            return True
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def require_role(self, role: str, credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
        """Require specific role."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            if not self.auth_service.has_role(credentials.credentials, role):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role required: {role}",
                )
            return True
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def require_any_role(self, roles: List[str], credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
        """Require any of the specified roles."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            if not self.auth_service.has_any_role(credentials.credentials, roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"One of these roles required: {', '.join(roles)}",
                )
            return True
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def require_admin(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
        """Require admin role."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            if not self.auth_service.is_admin(credentials.credentials):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin role required",
                )
            return True
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def require_manager(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
        """Require manager role or higher."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            if not self.auth_service.is_manager(credentials.credentials):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Manager role or higher required",
                )
            return True
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def require_employee(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
        """Require employee role or higher."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            if not self.auth_service.is_employee(credentials.credentials):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Employee role or higher required",
                )
            return True
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def validate_token(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
        """Validate JWT token."""
        if not credentials:
            return False
        
        try:
            return self.auth_service.is_token_valid(credentials.credentials)
        except AuthenticationError:
            return False
    
    async def get_token_info(self, credentials: Optional[HTTPAuthorizationCredentials] = None) -> dict:
        """Get token information."""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            return self.auth_service.get_token_info(credentials.credentials)
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )


# Dependency functions
async def get_auth_middleware() -> AuthMiddleware:
    """Get authentication middleware instance."""
    user_repository = await get_user_repository()
    auth_service = AuthService(user_repository)
    return AuthMiddleware(auth_service)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> UUID:
    """Get current user ID dependency."""
    return await auth_middleware.get_current_user_id(credentials)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> dict:
    """Get current user dependency."""
    return await auth_middleware.get_current_user(credentials)


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> Optional[dict]:
    """Get optional current user dependency."""
    return await auth_middleware.get_optional_current_user(credentials)


async def require_permission(
    permission: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> bool:
    """Require permission dependency."""
    return await auth_middleware.require_permission(permission, credentials)


async def require_role(
    role: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> bool:
    """Require role dependency."""
    return await auth_middleware.require_role(role, credentials)


async def require_any_role(
    roles: List[str],
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> bool:
    """Require any role dependency."""
    return await auth_middleware.require_any_role(roles, credentials)


async def require_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> bool:
    """Require admin role dependency."""
    return await auth_middleware.require_admin(credentials)


async def require_manager(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> bool:
    """Require manager role dependency."""
    return await auth_middleware.require_manager(credentials)


async def require_employee(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> bool:
    """Require employee role dependency."""
    return await auth_middleware.require_employee(credentials)


async def validate_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> bool:
    """Validate token dependency."""
    return await auth_middleware.validate_token(credentials)


async def get_token_info(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_middleware: AuthMiddleware = Depends(get_auth_middleware),
) -> dict:
    """Get token info dependency."""
    return await auth_middleware.get_token_info(credentials)