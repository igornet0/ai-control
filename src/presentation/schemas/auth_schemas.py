"""
Authentication-related API schemas.
"""

from typing import Optional
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime


class TokenSchema(BaseModel):
    """Token schema."""
    
    access_token: str = Field(..., description="Access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    refresh_token: Optional[str] = Field(None, description="Refresh token")


class TokenRefreshSchema(BaseModel):
    """Token refresh schema."""
    
    refresh_token: str = Field(..., description="Refresh token")


class AuthResponseSchema(BaseModel):
    """Authentication response schema."""
    
    user: dict = Field(..., description="User information")
    token: TokenSchema = Field(..., description="Token information")
    expires_at: datetime = Field(..., description="Token expiration timestamp")


class LoginSchema(BaseModel):
    """Login schema."""
    
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., description="User password")
    remember_me: bool = Field(False, description="Remember me")


class RegisterSchema(BaseModel):
    """Registration schema."""
    
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=8, description="User password")
    confirm_password: str = Field(..., description="Confirm password")
    first_name: str = Field(..., min_length=1, max_length=50, description="First name")
    last_name: str = Field(..., min_length=1, max_length=50, description="Last name")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    phone: Optional[str] = Field(None, description="Phone number")
    position: Optional[str] = Field(None, description="Job position")


class PasswordResetRequestSchema(BaseModel):
    """Password reset request schema."""
    
    email: EmailStr = Field(..., description="User email")


class PasswordResetSchema(BaseModel):
    """Password reset schema."""
    
    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class PasswordChangeSchema(BaseModel):
    """Password change schema."""
    
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class EmailVerificationSchema(BaseModel):
    """Email verification schema."""
    
    token: str = Field(..., description="Verification token")


class TwoFactorAuthSetupSchema(BaseModel):
    """Two-factor authentication setup schema."""
    
    secret: str = Field(..., description="2FA secret")
    qr_code: str = Field(..., description="QR code for 2FA setup")


class TwoFactorAuthVerifySchema(BaseModel):
    """Two-factor authentication verification schema."""
    
    code: str = Field(..., description="2FA code")


class SessionSchema(BaseModel):
    """Session schema."""
    
    session_id: str = Field(..., description="Session ID")
    user_id: str = Field(..., description="User ID")
    created_at: datetime = Field(..., description="Session creation timestamp")
    expires_at: datetime = Field(..., description="Session expiration timestamp")
    is_active: bool = Field(..., description="Whether session is active")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")


class SessionListSchema(BaseModel):
    """Session list schema."""
    
    sessions: list[SessionSchema] = Field(..., description="List of sessions")
    total: int = Field(..., description="Total number of sessions")


class LogoutSchema(BaseModel):
    """Logout schema."""
    
    session_id: Optional[str] = Field(None, description="Session ID to logout")
    logout_all: bool = Field(False, description="Logout from all sessions")


class AuthStatusSchema(BaseModel):
    """Authentication status schema."""
    
    is_authenticated: bool = Field(..., description="Whether user is authenticated")
    user_id: Optional[str] = Field(None, description="User ID")
    session_id: Optional[str] = Field(None, description="Session ID")
    expires_at: Optional[datetime] = Field(None, description="Session expiration timestamp")
    permissions: list[str] = Field(default_factory=list, description="User permissions")
    roles: list[str] = Field(default_factory=list, description="User roles")
