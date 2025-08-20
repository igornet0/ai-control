from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr
from datetime import datetime

class UserLoginResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    login: str
    password: str

class UserEmailResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    login: EmailStr
    password: str

class UserRegisterResponse(BaseModel):
    login: str
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = "employee"
    position: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[int] = None
    department_id: Optional[int] = None
    organization_id: Optional[int] = None

class UserUpdateResponse(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    manager_id: Optional[int] = None
    department_id: Optional[int] = None
    organization_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    id: int
    login: str
    username: str
    email: Optional[EmailStr] = None
    role: str
    position: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    manager_id: Optional[int] = None
    department_id: Optional[int] = None
    organization_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    is_active: Optional[bool] = True

class UserHierarchyResponse(BaseModel):
    """Ответ с иерархией пользователей"""
    id: int
    username: str
    role: str
    position: Optional[str] = None
    subordinates: List['UserHierarchyResponse'] = []

class OrganizationResponse(BaseModel):
    """Схема организации"""
    id: int
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class DepartmentResponse(BaseModel):
    """Схема департамента"""
    id: int
    name: str
    description: Optional[str] = None
    organization_id: int
    manager_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class PermissionResponse(BaseModel):
    """Схема разрешения"""
    id: int
    name: str
    description: Optional[str] = None
    resource: str
    action: str
    created_at: datetime

class RolePermissionResponse(BaseModel):
    """Схема связи роли и разрешения"""
    id: int
    role: str
    permission_id: int
    permission: PermissionResponse

class TokenData(BaseModel):
    model_config = ConfigDict(strict=True)

    email: Optional[str] = None
    login: Optional[str] = None

class Token(BaseModel):
    model_config = ConfigDict(strict=True)
    
    access_token: str
    refresh_token: Optional[str] = None
    token_type: Optional[str] = "Bearer"
    message: Optional[str] = None

# Обновляем UserHierarchyResponse для поддержки рекурсии
UserHierarchyResponse.model_rebuild()
