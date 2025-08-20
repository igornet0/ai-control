import asyncio
from typing import Optional, Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, Depends, status, Form
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import re

from core.settings import settings
from core.database import User, orm_get_user_by_login

from backend.api.configuration import TokenData, Server, UserResponse, UserLoginResponse

TOKEN_TYPE_FIELD = "type"
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

EMAIL_REGEX = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'

def is_email(string: str) -> bool:
    """Проверяет, соответствует ли строка формату email"""
    return re.fullmatch(EMAIL_REGEX, string) is not None

def verify_password(plain_password, hashed_password) -> bool:
    return Server.pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password) -> str:
    return Server.pwd_context.hash(password)

def create_access_token(payload: dict,
                        private_key: str = settings.security.private_key_path.read_text(),
                        algorithm: str = settings.security.algorithm,
                        expires_delta: Optional[timedelta] = None):
    to_encode = payload.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc), TOKEN_TYPE_FIELD: ACCESS_TOKEN_TYPE})

    return jwt.encode(to_encode, private_key, algorithm=algorithm)

def decode_access_token(token: str | bytes, public_key: str = settings.security.public_key_path.read_text(),
                        algorithm: str = settings.security.algorithm):
    
    return jwt.decode(token, public_key, algorithms=[algorithm])

def get_current_token_payload(
    token: str = Depends(Server.oauth2_scheme),
) -> dict:
    try:
        payload = decode_access_token(
            token=token,
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid token error: {e}",
        )
    
    return payload

def validate_token_type(
    payload: dict,
    token_type: str,
) -> bool:
    
    current_token_type = payload.get(TOKEN_TYPE_FIELD)

    if current_token_type == token_type:
        return True
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"invalid token type {current_token_type!r} expected {token_type!r}",
    )

async def get_user_by_token_sub(payload: dict, session: Annotated[AsyncSession, Depends(Server.get_db)]) -> User:

    username: str | None = payload.get("sub")

    user = await orm_get_user_by_login(session, UserLoginResponse(login=username, password=""))

    if user:
        return user
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="token invalid (user not found)",
    )

def get_auth_user_from_token_of_type(token_type: str):
    async def get_auth_user_from_token(
        payload: dict = Depends(get_current_token_payload),
        session: AsyncSession = Depends(Server.get_db),
    ) -> User:

        validate_token_type(payload, token_type)
        
        return await get_user_by_token_sub(payload, session)

    return get_auth_user_from_token

def get_current_active_auth_user(
    current_user,
):
    if current_user.active:
        return current_user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="inactive user",
    )

async def validate_auth_user(
        response: UserLoginResponse,
        session: AsyncSession = Depends(Server.get_db),
    ):

    unauthed_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = await orm_get_user_by_login(session, response)

    if not user:
        raise unauthed_exc

    if not verify_password(
        plain_password=response.password,
        hashed_password=user.password,
    ):
        raise unauthed_exc

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user inactive",
        )

    return user

async def get_current_user(token: Annotated[str, Depends(Server.oauth2_scheme)], db: Annotated[AsyncSession, Depends(Server.get_db)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)

        username: str = payload.get("sub")

        if username is None:
            raise credentials_exception
        
        token_data = TokenData(login=username)

    except JWTError:
        raise credentials_exception
    
    user = await orm_get_user_by_login(db, token_data)

    if user is None:
        raise credentials_exception
    
    return user

async def verify_authorization(token: str = Depends(Server.oauth2_scheme), 
                               session: AsyncSession = Depends(Server.get_db)):
    
    payload = get_current_token_payload(token)
    validate_token_type(payload, "access")

    user = await get_user_by_token_sub(payload, session)
    
    if user.is_active:
        return user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="inactive user",
    )

async def verify_authorization_admin(token: str = Depends(Server.oauth2_scheme), 
                               session: AsyncSession = Depends(Server.get_db)):
    
    payload = get_current_token_payload(token)
    validate_token_type(payload, "access")

    user = await get_user_by_token_sub(payload, session)
    
    if user.is_active and user.role == "admin":
        return user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="inactive user",
    )

# Новые функции для проверки разрешений
async def verify_authorization_with_permission(
    resource: str,
    action: str,
    token: str = Depends(Server.oauth2_scheme),
    session: AsyncSession = Depends(Server.get_db)
):
    """Проверка авторизации с проверкой разрешений"""
    user = await verify_authorization(token, session)
    
    # Проверяем разрешения
    from core.database import orm_check_user_permission
    has_permission = await orm_check_user_permission(session, user.id, resource, action)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions for {action} on {resource}"
        )
    
    return user

def require_role(required_role: str):
    """Декоратор для проверки роли пользователя"""
    async def role_checker(
        user = Depends(verify_authorization),
        session: AsyncSession = Depends(Server.get_db)
    ):
        if user.role != required_role and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {required_role} required"
            )
        return user
    return role_checker

def require_roles(required_roles: list[str]):
    """Декоратор для проверки одной из ролей пользователя"""
    async def roles_checker(
        user = Depends(verify_authorization),
        session: AsyncSession = Depends(Server.get_db)
    ):
        if user.role not in required_roles and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of roles {required_roles} required"
            )
        return user
    return roles_checker

async def get_current_user_id(token: str = Depends(Server.oauth2_scheme)) -> int:
    """Получить ID текущего пользователя"""
    try:
        payload = decode_access_token(token)
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")