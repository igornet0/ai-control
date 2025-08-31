import asyncio
import logging
from typing import Optional, Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, Depends, status, Form
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import re
from passlib.context import CryptContext

from core.settings import settings
from core.database import User, orm_get_user_by_login

from backend.api.configuration import TokenData, Server, UserResponse, UserLoginResponse

# Настройка логирования
logger = logging.getLogger(__name__)

# Настройка хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TYPE_FIELD = "type"
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

EMAIL_REGEX = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'

def is_email(string: str) -> bool:
    """Проверяет, соответствует ли строка формату email"""
    return re.fullmatch(EMAIL_REGEX, string) is not None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.security.access_token_expire_minutes)
    
    to_encode.update({"exp": expire, TOKEN_TYPE_FIELD: TOKEN_TYPE_ACCESS})
    
    # Используем secret_key для HS256 и private_key для RS256
    if settings.security.algorithm == "HS256":
        key = settings.security.secret_key
    else:
        key = settings.security.private_key_path.read_text()
    
    encoded_jwt = jwt.encode(to_encode, key, algorithm=settings.security.algorithm)
    return encoded_jwt

def decode_access_token(token: str, algorithm: str = settings.security.algorithm):
    try:
        # Используем secret_key для HS256 и public_key для RS256
        if algorithm == "HS256":
            key = settings.security.secret_key
        else:
            key = settings.security.public_key_path.read_text()
        
        payload = jwt.decode(token, key, algorithms=[algorithm])
        return payload
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_token_payload(
    token: str = Depends(Server.oauth2_scheme),
) -> dict:
    try:
        payload = decode_access_token(token=token)
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def validate_token_type(payload: dict, expected_type: str):
    token_type = payload.get(TOKEN_TYPE_FIELD)
    if token_type != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type: expected {expected_type}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_user_by_token_sub(payload: dict, session: AsyncSession) -> User:
    username: str | None = payload.get("sub")
    
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user = await orm_get_user_by_login(session, username)
        
        if user:
            return user
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during user lookup",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def verify_authorization(
    token: str = Depends(Server.oauth2_scheme),
    session: AsyncSession = Depends(Server.get_db)
):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = get_current_token_payload(token)
        validate_token_type(payload, TOKEN_TYPE_ACCESS)
        user = await get_user_by_token_sub(payload, session)
        
        if hasattr(user, 'is_active') and user.is_active:
            return user
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is not active",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during authorization",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    token: str = Depends(Server.oauth2_scheme),
    session: AsyncSession = Depends(Server.get_db)
) -> User:
    try:
        payload = get_current_token_payload(token)
        user = await get_user_by_token_sub(payload, session)
        return user
    except HTTPException:
        raise

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def authenticate_user(session: AsyncSession, username: str, password: str):
    user = await orm_get_user_by_login(session, username)
    if not user:
        return False
    if not user.verify_password(password):
        return False
    return user

async def create_user(session: AsyncSession, user_data: dict):
    user = User(**user_data)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user

# Функции для проверки ролей
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