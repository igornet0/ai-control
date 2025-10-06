"""
Authentication API controller.
Handles HTTP requests for authentication operations.
"""

from typing import Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from src.infrastructure.auth.auth_service import AuthService
from src.presentation.api.dependencies import get_user_repository
from src.presentation.middleware.auth_middleware import security, get_auth_middleware, AuthMiddleware
from src.domain.exceptions import AuthenticationError, ValidationError

router = APIRouter(prefix="/auth", tags=["authentication"])


class LoginRequest:
    """Request for user login."""
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password


class LoginResponse:
    """Response for user login."""
    
    def __init__(self, user: dict, tokens: dict):
        self.user = user
        self.tokens = tokens
        self.success = True
        self.message = "Login successful"


class RefreshTokenRequest:
    """Request for token refresh."""
    
    def __init__(self, refresh_token: str):
        self.refresh_token = refresh_token


class RefreshTokenResponse:
    """Response for token refresh."""
    
    def __init__(self, access_token: str, token_type: str = "bearer"):
        self.access_token = access_token
        self.token_type = token_type
        self.success = True
        self.message = "Token refreshed successfully"


class ChangePasswordRequest:
    """Request for password change."""
    
    def __init__(self, current_password: str, new_password: str):
        self.current_password = current_password
        self.new_password = new_password


class ChangePasswordResponse:
    """Response for password change."""
    
    def __init__(self):
        self.success = True
        self.message = "Password changed successfully"


class ResetPasswordRequest:
    """Request for password reset."""
    
    def __init__(self, email: str):
        self.email = email


class ResetPasswordResponse:
    """Response for password reset."""
    
    def __init__(self):
        self.success = True
        self.message = "Password reset email sent"


class ConfirmPasswordResetRequest:
    """Request for password reset confirmation."""
    
    def __init__(self, reset_token: str, new_password: str):
        self.reset_token = reset_token
        self.new_password = new_password


class ConfirmPasswordResetResponse:
    """Response for password reset confirmation."""
    
    def __init__(self):
        self.success = True
        self.message = "Password reset successfully"


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    username: str,
    password: str,
    user_repository = Depends(get_user_repository),
):
    """Login with username and password."""
    try:
        auth_service = AuthService(user_repository)
        
        # Authenticate user
        result = await auth_service.authenticate_user(username, password)
        
        if not result["authenticated"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        user = result["user"]
        tokens = result["tokens"]
        
        return LoginResponse(
            user={
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "is_active": user.is_active,
                "organization_id": str(user.organization_id) if user.organization_id else None,
                "department_id": str(user.department_id) if user.department_id else None,
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
            tokens=tokens,
        )
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/login/email", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login_with_email(
    email: str,
    password: str,
    user_repository = Depends(get_user_repository),
):
    """Login with email and password."""
    try:
        auth_service = AuthService(user_repository)
        
        # Authenticate user
        result = await auth_service.authenticate_user_by_email(email, password)
        
        if not result["authenticated"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        user = result["user"]
        tokens = result["tokens"]
        
        return LoginResponse(
            user={
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "is_active": user.is_active,
                "organization_id": str(user.organization_id) if user.organization_id else None,
                "department_id": str(user.department_id) if user.department_id else None,
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
            tokens=tokens,
        )
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/refresh", response_model=RefreshTokenResponse, status_code=status.HTTP_200_OK)
async def refresh_token(
    refresh_token: str,
    user_repository = Depends(get_user_repository),
):
    """Refresh access token using refresh token."""
    try:
        auth_service = AuthService(user_repository)
        
        # Refresh token
        tokens = await auth_service.refresh_access_token(refresh_token)
        
        return RefreshTokenResponse(
            access_token=tokens["access_token"],
            token_type=tokens["token_type"],
        )
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {str(e)}"
        )


@router.post("/change-password", response_model=ChangePasswordResponse, status_code=status.HTTP_200_OK)
async def change_password(
    current_password: str,
    new_password: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_repository = Depends(get_user_repository),
):
    """Change user password."""
    try:
        auth_service = AuthService(user_repository)
        
        # Get current user ID from token
        user_id = auth_service.get_user_id_from_token(credentials.credentials)
        
        # Change password
        success = await auth_service.change_password(user_id, current_password, new_password)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password change failed"
            )
        
        return ChangePasswordResponse()
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password change failed: {str(e)}"
        )


@router.post("/reset-password", response_model=ResetPasswordResponse, status_code=status.HTTP_200_OK)
async def reset_password(
    email: str,
    user_repository = Depends(get_user_repository),
):
    """Initiate password reset process."""
    try:
        auth_service = AuthService(user_repository)
        
        # Initiate password reset
        success = await auth_service.reset_password(email)
        
        # Always return success to prevent email enumeration
        return ResetPasswordResponse()
        
    except Exception as e:
        # Always return success to prevent email enumeration
        return ResetPasswordResponse()


@router.post("/confirm-password-reset", response_model=ConfirmPasswordResetResponse, status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    reset_token: str,
    new_password: str,
    user_repository = Depends(get_user_repository),
):
    """Confirm password reset with token."""
    try:
        auth_service = AuthService(user_repository)
        
        # Confirm password reset
        success = await auth_service.confirm_password_reset(reset_token, new_password)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset confirmation failed"
            )
        
        return ConfirmPasswordResetResponse()
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset confirmation failed: {str(e)}"
        )


@router.get("/me", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def get_current_user_info(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_repository = Depends(get_user_repository),
):
    """Get current user information."""
    try:
        auth_service = AuthService(user_repository)
        
        # Get current user
        user = await auth_service.get_current_user(credentials.credentials)
        
        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "department_id": str(user.department_id) if user.department_id else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat(),
        }
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user info: {str(e)}"
        )


@router.get("/token-info", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def get_token_info(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_repository = Depends(get_user_repository),
):
    """Get token information."""
    try:
        auth_service = AuthService(user_repository)
        
        # Get token info
        token_info = auth_service.get_token_info(credentials.credentials)
        
        return token_info
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get token info: {str(e)}"
        )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout():
    """Logout user (invalidate token on client side)."""
    # In a real implementation, you would:
    # 1. Add token to blacklist
    # 2. Store blacklist in Redis or database
    # 3. Check blacklist in middleware
    
    return {
        "success": True,
        "message": "Logout successful. Please remove the token from client storage."
    }


@router.get("/validate", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def validate_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_repository = Depends(get_user_repository),
):
    """Validate JWT token."""
    try:
        auth_service = AuthService(user_repository)
        
        # Validate token
        is_valid = auth_service.is_token_valid(credentials.credentials)
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Get token info
        token_info = auth_service.get_token_info(credentials.credentials)
        
        return {
            "valid": True,
            "token_info": token_info,
        }
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token validation failed: {str(e)}"
        )
