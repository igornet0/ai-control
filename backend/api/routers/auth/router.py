from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, HTTPException, Depends, status, Body
from fastapi.security import (HTTPBearer,
                              OAuth2PasswordRequestForm)
from datetime import timedelta
from typing import List

from core import settings
from core.database import (orm_get_user, orm_add_user, orm_get_user_by_id, orm_update_user, 
                          orm_get_users_by_role, orm_get_subordinates, orm_get_user_hierarchy,
                          orm_add_organization, orm_get_organization_by_id, orm_get_organizations,
                          orm_add_department, orm_get_department_by_id, orm_get_departments_by_organization)

from backend.api.configuration import (Server, 
                                       get_password_hash,
                                       UserResponse, UserLoginResponse,
                                       UserRegisterResponse, UserEmailResponse,
                                       UserUpdateResponse, UserHierarchyResponse,
                                       OrganizationResponse, DepartmentResponse,
                                       Token,
                                       verify_password, is_email,
                                       create_access_token,
                                       verify_authorization, require_role, require_roles)

import logging

http_bearer = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(http_bearer)])

logger = logging.getLogger("app_fastapi.auth")


@router.post("/register/", response_model=Token)
async def register(user: UserRegisterResponse, session: AsyncSession = Depends(Server.get_db)):

    db_user = await orm_get_user(session, UserEmailResponse(login=user.email, password=user.password))

    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = await orm_get_user(session, UserLoginResponse(login=user.login, password=user.password))

    if db_user:
        raise HTTPException(status_code=400, detail="Login already registered")
    
    hashed_password = get_password_hash(user.password)

    await orm_add_user(session, 
                        username=user.username,
                       login=user.login,
                       hashed_password=hashed_password,
                       email=user.email,
                       role=user.role,
                       position=user.position,
                       phone=user.phone,
                       manager_id=user.manager_id,
                       department_id=user.department_id,
                       organization_id=user.organization_id)
    
    access_token_expires = timedelta(minutes=settings.security.access_token_expire_minutes)

    return {
        "access_token": create_access_token(payload={"sub": user.login, "email": user.email}, 
                                            expires_delta=access_token_expires),
        "token_type": "bearer",
        "message": "User registered successfully"
    }


@router.post("/login_user/", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(Server.get_db)):
    
    unauthed_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if is_email(form_data.username):
        respont = UserEmailResponse
    else:
        respont = UserLoginResponse

    user = await orm_get_user(session, respont(login=form_data.username, password=form_data.password))

    if not user:
        raise unauthed_exc
    
    if not verify_password(
        plain_password=form_data.password,
        hashed_password=user.password_hash,
    ):
        raise unauthed_exc
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user inactive",
        )
    
    access_token_expires = timedelta(minutes=settings.security.access_token_expire_minutes)

    access_token = create_access_token(
        payload={"sub": user.login, "email": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, 
            "token_type": "bearer",
            "message": "User logged in successfully",}


@router.post("/refresh-token/", response_model=Token)
async def refresh_token(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, settings.security.refresh_secret_key, algorithms=[settings.security.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    new_access_token = create_access_token(payload={"sub": username})
    # new_refresh_token = create_refresh_token(data={"sub": username})
    
    return {
        "access_token": new_access_token,
        # "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.get("/user/me/", response_model=UserResponse)
async def auth_user_check_self_info(
    user: str = Depends(verify_authorization)
):
    return user

# Новые эндпоинты для управления пользователями

@router.get("/users/", response_model=List[UserResponse])
async def get_users(
    current_user = Depends(require_roles(["admin", "CEO"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить список всех пользователей (только для админов и CEO)"""
    from core.database.models import User
    from sqlalchemy import select
    
    query = select(User)
    result = await session.execute(query)
    return result.scalars().all()

@router.get("/users/{user_id}/", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user = Depends(require_roles(["admin", "CEO", "manager"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить пользователя по ID"""
    user = await orm_get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Проверяем права доступа
    if current_user.role == "manager" and user.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return user

@router.put("/users/{user_id}/", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdateResponse,
    current_user = Depends(require_roles(["admin", "CEO", "manager"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Обновить пользователя"""
    user = await orm_get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Проверяем права доступа
    if current_user.role == "manager" and user.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Обновляем пользователя
    updated_user = await orm_update_user(session, user_id, **user_update.dict(exclude_unset=True))
    return updated_user

@router.get("/users/{user_id}/hierarchy/", response_model=UserHierarchyResponse)
async def get_user_hierarchy(
    user_id: int,
    current_user = Depends(require_roles(["admin", "CEO", "manager"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить иерархию пользователя"""
    user = await orm_get_user_hierarchy(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Проверяем права доступа
    if current_user.role == "manager" and user.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return user

@router.get("/users/role/{role}/", response_model=List[UserResponse])
async def get_users_by_role(
    role: str,
    current_user = Depends(require_roles(["admin", "CEO"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить пользователей по роли"""
    users = await orm_get_users_by_role(session, role)
    return users

@router.get("/users/{user_id}/subordinates/", response_model=List[UserResponse])
async def get_subordinates(
    user_id: int,
    current_user = Depends(require_roles(["admin", "CEO", "manager"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить подчиненных пользователя"""
    # Проверяем права доступа
    if current_user.role == "manager" and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    subordinates = await orm_get_subordinates(session, user_id)
    return subordinates

# Эндпоинты для организаций

@router.post("/organizations/", response_model=OrganizationResponse)
async def create_organization(
    organization: OrganizationResponse,
    current_user = Depends(require_role("admin")),
    session: AsyncSession = Depends(Server.get_db)
):
    """Создать организацию (только для админов)"""
    new_org = await orm_add_organization(
        session,
        name=organization.name,
        description=organization.description,
        domain=organization.domain,
        logo_url=organization.logo_url
    )
    return new_org

@router.get("/organizations/", response_model=List[OrganizationResponse])
async def get_organizations(
    current_user = Depends(require_roles(["admin", "CEO"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить список организаций"""
    organizations = await orm_get_organizations(session)
    return organizations

@router.get("/organizations/{org_id}/", response_model=OrganizationResponse)
async def get_organization(
    org_id: int,
    current_user = Depends(require_roles(["admin", "CEO"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить организацию по ID"""
    organization = await orm_get_organization_by_id(session, org_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization

# Эндпоинты для департаментов

@router.post("/departments/", response_model=DepartmentResponse)
async def create_department(
    department: DepartmentResponse,
    current_user = Depends(require_roles(["admin", "CEO"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Создать департамент"""
    new_dept = await orm_add_department(
        session,
        name=department.name,
        organization_id=department.organization_id,
        description=department.description,
        manager_id=department.manager_id
    )
    return new_dept

@router.get("/departments/organization/{org_id}/", response_model=List[DepartmentResponse])
async def get_departments_by_organization(
    org_id: int,
    current_user = Depends(require_roles(["admin", "CEO", "manager"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить департаменты организации"""
    departments = await orm_get_departments_by_organization(session, org_id)
    return departments

@router.get("/departments/{dept_id}/", response_model=DepartmentResponse)
async def get_department(
    dept_id: int,
    current_user = Depends(require_roles(["admin", "CEO", "manager"])),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получить департамент по ID"""
    department = await orm_get_department_by_id(session, dept_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department
