"""
JWT service for authentication and authorization.
Handles JWT token creation, validation, and user authentication.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import UUID

import jwt
from jwt import PyJWTError

from src.infrastructure.config.settings import get_settings
from src.domain.exceptions import AuthenticationError, AuthorizationError


class JWTService:
    """JWT service for handling authentication tokens."""
    
    def __init__(self):
        self.settings = get_settings()
        self.secret_key = self.settings.jwt_secret_key
        self.algorithm = self.settings.jwt_algorithm
        self.access_token_expire_minutes = self.settings.jwt_access_token_expire_minutes
        self.refresh_token_expire_days = self.settings.jwt_refresh_token_expire_days
    
    def create_access_token(
        self,
        user_id: UUID,
        username: str,
        email: str,
        role: str,
        permissions: Optional[List[str]] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a JWT access token."""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode = {
            "sub": str(user_id),
            "username": username,
            "email": email,
            "role": role,
            "permissions": permissions or [],
            "organization_id": str(organization_id) if organization_id else None,
            "department_id": str(department_id) if department_id else None,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access",
        }
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            return encoded_jwt
        except Exception as e:
            raise AuthenticationError(f"Failed to create access token: {str(e)}")
    
    def create_refresh_token(
        self,
        user_id: UUID,
        username: str,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a JWT refresh token."""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        
        to_encode = {
            "sub": str(user_id),
            "username": username,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
        }
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            return encoded_jwt
        except Exception as e:
            raise AuthenticationError(f"Failed to create refresh token: {str(e)}")
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token")
        except Exception as e:
            raise AuthenticationError(f"Token verification failed: {str(e)}")
    
    def verify_access_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode an access token."""
        payload = self.verify_token(token)
        
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type")
        
        return payload
    
    def verify_refresh_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode a refresh token."""
        payload = self.verify_token(token)
        
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")
        
        return payload
    
    def get_user_id_from_token(self, token: str) -> UUID:
        """Get user ID from token."""
        payload = self.verify_access_token(token)
        user_id_str = payload.get("sub")
        
        if not user_id_str:
            raise AuthenticationError("User ID not found in token")
        
        try:
            return UUID(user_id_str)
        except ValueError:
            raise AuthenticationError("Invalid user ID format in token")
    
    def get_username_from_token(self, token: str) -> str:
        """Get username from token."""
        payload = self.verify_access_token(token)
        username = payload.get("username")
        
        if not username:
            raise AuthenticationError("Username not found in token")
        
        return username
    
    def get_email_from_token(self, token: str) -> str:
        """Get email from token."""
        payload = self.verify_access_token(token)
        email = payload.get("email")
        
        if not email:
            raise AuthenticationError("Email not found in token")
        
        return email
    
    def get_role_from_token(self, token: str) -> str:
        """Get role from token."""
        payload = self.verify_access_token(token)
        role = payload.get("role")
        
        if not role:
            raise AuthenticationError("Role not found in token")
        
        return role
    
    def get_permissions_from_token(self, token: str) -> List[str]:
        """Get permissions from token."""
        payload = self.verify_access_token(token)
        permissions = payload.get("permissions", [])
        
        return permissions
    
    def get_organization_id_from_token(self, token: str) -> Optional[UUID]:
        """Get organization ID from token."""
        payload = self.verify_access_token(token)
        org_id_str = payload.get("organization_id")
        
        if not org_id_str:
            return None
        
        try:
            return UUID(org_id_str)
        except ValueError:
            raise AuthenticationError("Invalid organization ID format in token")
    
    def get_department_id_from_token(self, token: str) -> Optional[UUID]:
        """Get department ID from token."""
        payload = self.verify_access_token(token)
        dept_id_str = payload.get("department_id")
        
        if not dept_id_str:
            return None
        
        try:
            return UUID(dept_id_str)
        except ValueError:
            raise AuthenticationError("Invalid department ID format in token")
    
    def is_token_expired(self, token: str) -> bool:
        """Check if token is expired."""
        try:
            payload = self.verify_token(token)
            exp = payload.get("exp")
            
            if not exp:
                return True
            
            return datetime.utcnow() > datetime.fromtimestamp(exp)
        except AuthenticationError:
            return True
    
    def get_token_expiration(self, token: str) -> Optional[datetime]:
        """Get token expiration time."""
        try:
            payload = self.verify_token(token)
            exp = payload.get("exp")
            
            if not exp:
                return None
            
            return datetime.fromtimestamp(exp)
        except AuthenticationError:
            return None
    
    def get_token_issued_at(self, token: str) -> Optional[datetime]:
        """Get token issued at time."""
        try:
            payload = self.verify_token(token)
            iat = payload.get("iat")
            
            if not iat:
                return None
            
            return datetime.fromtimestamp(iat)
        except AuthenticationError:
            return None
    
    def get_token_remaining_time(self, token: str) -> Optional[timedelta]:
        """Get remaining time until token expires."""
        try:
            exp = self.get_token_expiration(token)
            
            if not exp:
                return None
            
            remaining = exp - datetime.utcnow()
            return remaining if remaining > timedelta(0) else timedelta(0)
        except AuthenticationError:
            return None
    
    def is_token_valid(self, token: str) -> bool:
        """Check if token is valid."""
        try:
            self.verify_access_token(token)
            return True
        except AuthenticationError:
            return False
    
    def refresh_access_token(self, refresh_token: str) -> str:
        """Create a new access token from refresh token."""
        payload = self.verify_refresh_token(refresh_token)
        user_id = UUID(payload.get("sub"))
        username = payload.get("username")
        
        # In a real implementation, you would fetch user details from database
        # For now, we'll use the data from the refresh token
        return self.create_access_token(
            user_id=user_id,
            username=username,
            email="",  # Would be fetched from database
            role="",   # Would be fetched from database
        )
    
    def create_token_pair(
        self,
        user_id: UUID,
        username: str,
        email: str,
        role: str,
        permissions: Optional[List[str]] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
    ) -> Dict[str, str]:
        """Create both access and refresh tokens."""
        access_token = self.create_access_token(
            user_id=user_id,
            username=username,
            email=email,
            role=role,
            permissions=permissions,
            organization_id=organization_id,
            department_id=department_id,
        )
        
        refresh_token = self.create_refresh_token(
            user_id=user_id,
            username=username,
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    
    def decode_token_without_verification(self, token: str) -> Dict[str, Any]:
        """Decode token without verification (for debugging)."""
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
        except Exception as e:
            raise AuthenticationError(f"Failed to decode token: {str(e)}")
    
    def get_token_info(self, token: str) -> Dict[str, Any]:
        """Get comprehensive token information."""
        try:
            payload = self.verify_access_token(token)
            
            return {
                "user_id": payload.get("sub"),
                "username": payload.get("username"),
                "email": payload.get("email"),
                "role": payload.get("role"),
                "permissions": payload.get("permissions", []),
                "organization_id": payload.get("organization_id"),
                "department_id": payload.get("department_id"),
                "issued_at": self.get_token_issued_at(token),
                "expires_at": self.get_token_expiration(token),
                "remaining_time": self.get_token_remaining_time(token),
                "is_expired": self.is_token_expired(token),
                "is_valid": self.is_token_valid(token),
            }
        except AuthenticationError as e:
            return {
                "error": str(e),
                "is_valid": False,
                "is_expired": True,
            }
