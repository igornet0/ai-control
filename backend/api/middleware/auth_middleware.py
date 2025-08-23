"""
Middleware для проверки прав доступа
"""
from typing import Optional, List
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.configuration.auth import verify_authorization, verify_authorization_with_permission
from core.database import get_db_helper


class AuthMiddleware:
    """Middleware для проверки аутентификации и авторизации"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            
            # Проверяем, нужна ли аутентификация для этого пути
            if self._requires_auth(request.url.path):
                try:
                    # Проверяем аутентификацию
                    user = await verify_authorization(request)
                    
                    # Добавляем пользователя в scope для использования в endpoint'ах
                    scope["user"] = user
                    
                    # Проверяем права доступа если нужно
                    if self._requires_role_check(request.url.path):
                        await self._check_role_access(request, user)
                        
                except HTTPException as e:
                    response = JSONResponse(
                        status_code=e.status_code,
                        content={"detail": e.detail}
                    )
                    await response(scope, receive, send)
                    return
                except Exception as e:
                    response = JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={"detail": "Authentication failed"}
                    )
                    await response(scope, receive, send)
                    return
        
        await self.app(scope, receive, send)
    
    def _requires_auth(self, path: str) -> bool:
        """Проверяет, нужна ли аутентификация для данного пути"""
        # Пути, которые не требуют аутентификации
        public_paths = [
            "/auth/register/",
            "/auth/login_user/",
            "/auth/health/",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/favicon.ico"
        ]
        
        # Проверяем, начинается ли путь с публичного
        for public_path in public_paths:
            if path.startswith(public_path):
                return False
        
        return True
    
    def _requires_role_check(self, path: str) -> bool:
        """Проверяет, нужна ли проверка ролей для данного пути"""
        # Пути, которые требуют проверки ролей
        role_required_paths = [
            "/auth/users/",
            "/auth/organizations/",
            "/auth/departments/",
            "/auth/permissions/"
        ]
        
        for role_path in role_required_paths:
            if path.startswith(role_path):
                return True
        
        return False
    
    async def _check_role_access(self, request: Request, user) -> None:
        """Проверяет права доступа пользователя"""
        path = request.url.path
        method = request.method
        
        # Определяем требуемые роли для разных путей
        required_roles = self._get_required_roles(path, method)
        
        if required_roles and user.role not in required_roles and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(required_roles)}"
            )
    
    def _get_required_roles(self, path: str, method: str) -> Optional[List[str]]:
        """Возвращает требуемые роли для данного пути и метода"""
        # Маппинг путей и методов к требуемым ролям
        role_mapping = {
            # Управление пользователями
            ("/auth/users/", "GET"): ["admin", "CEO"],
            ("/auth/users/", "POST"): ["admin"],
            ("/auth/users/", "PUT"): ["admin", "CEO"],
            ("/auth/users/", "DELETE"): ["admin"],
            
            # Управление организациями
            ("/auth/organizations/", "GET"): ["admin", "CEO"],
            ("/auth/organizations/", "POST"): ["admin"],
            ("/auth/organizations/", "PUT"): ["admin", "CEO"],
            ("/auth/organizations/", "DELETE"): ["admin"],
            
            # Управление департаментами
            ("/auth/departments/", "GET"): ["admin", "CEO", "manager"],
            ("/auth/departments/", "POST"): ["admin", "CEO"],
            ("/auth/departments/", "PUT"): ["admin", "CEO", "manager"],
            ("/auth/departments/", "DELETE"): ["admin", "CEO"],
            
            # Управление разрешениями
            ("/auth/permissions/", "GET"): ["admin"],
            ("/auth/permissions/", "POST"): ["admin"],
            ("/auth/permissions/", "PUT"): ["admin"],
            ("/auth/permissions/", "DELETE"): ["admin"],
        }
        
        return role_mapping.get((path, method))


class PermissionMiddleware:
    """Middleware для проверки конкретных разрешений"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            
            # Проверяем, нужна ли проверка разрешений
            if self._requires_permission_check(request.url.path):
                try:
                    # Получаем пользователя из scope (должен быть добавлен AuthMiddleware)
                    user = scope.get("user")
                    if not user:
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="User not found in request scope"
                        )
                    
                    # Проверяем разрешения
                    await self._check_permissions(request, user)
                    
                except HTTPException as e:
                    response = JSONResponse(
                        status_code=e.status_code,
                        content={"detail": e.detail}
                    )
                    await response(scope, receive, send)
                    return
        
        await self.app(scope, receive, send)
    
    def _requires_permission_check(self, path: str) -> bool:
        """Проверяет, нужна ли проверка разрешений для данного пути"""
        # Пути, которые требуют проверки разрешений
        permission_required_paths = [
            "/auth/users/",
            "/auth/organizations/",
            "/auth/departments/",
            "/auth/permissions/"
        ]
        
        for permission_path in permission_required_paths:
            if path.startswith(permission_path):
                return True
        
        return False
    
    async def _check_permissions(self, request: Request, user) -> None:
        """Проверяет разрешения пользователя"""
        # Здесь можно добавить логику проверки конкретных разрешений
        # Например, проверка разрешений на уровне организации/департамента
        pass


def setup_auth_middleware(app):
    """Настраивает middleware для аутентификации и авторизации"""
    app.add_middleware(AuthMiddleware)
    app.add_middleware(PermissionMiddleware)
