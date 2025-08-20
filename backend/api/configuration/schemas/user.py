from typing import Optional
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
    # role: Optional[str] = "manager"  # Default role can be set here
    # is_active: Optional[bool] = True  # Default to active user

class UserResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    id: int
    login: str
    username: str
    email: Optional[EmailStr] = None
    # password_hash: str
    role: str
    created: datetime
    is_active: Optional[bool] = True

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
