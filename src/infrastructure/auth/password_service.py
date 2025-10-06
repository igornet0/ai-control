"""
Password service for handling password hashing and verification.
"""

from typing import Optional

from passlib.context import CryptContext
from passlib.hash import bcrypt

from src.domain.exceptions import AuthenticationError


class PasswordService:
    """Service for handling password operations."""
    
    def __init__(self):
        # Configure password hashing context
        self.pwd_context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
            bcrypt__rounds=12,  # Number of rounds for bcrypt
        )
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        if not password:
            raise AuthenticationError("Password cannot be empty")
        
        try:
            return self.pwd_context.hash(password)
        except Exception as e:
            raise AuthenticationError(f"Failed to hash password: {str(e)}")
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        if not plain_password:
            return False
        
        if not hashed_password:
            return False
        
        try:
            return self.pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            raise AuthenticationError(f"Failed to verify password: {str(e)}")
    
    def is_password_strong(self, password: str) -> bool:
        """Check if password meets strength requirements."""
        if not password:
            return False
        
        # Minimum length
        if len(password) < 8:
            return False
        
        # Check for at least one uppercase letter
        if not any(c.isupper() for c in password):
            return False
        
        # Check for at least one lowercase letter
        if not any(c.islower() for c in password):
            return False
        
        # Check for at least one digit
        if not any(c.isdigit() for c in password):
            return False
        
        # Check for at least one special character
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in password):
            return False
        
        return True
    
    def get_password_strength_score(self, password: str) -> int:
        """Get password strength score (0-100)."""
        if not password:
            return 0
        
        score = 0
        
        # Length score (0-30 points)
        if len(password) >= 8:
            score += 10
        if len(password) >= 12:
            score += 10
        if len(password) >= 16:
            score += 10
        
        # Character variety score (0-40 points)
        if any(c.isupper() for c in password):
            score += 10
        if any(c.islower() for c in password):
            score += 10
        if any(c.isdigit() for c in password):
            score += 10
        
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if any(c in special_chars for c in password):
            score += 10
        
        # Complexity score (0-30 points)
        if len(set(password)) >= 8:
            score += 10
        if len(set(password)) >= 12:
            score += 10
        if len(set(password)) >= 16:
            score += 10
        
        return min(score, 100)
    
    def get_password_strength_level(self, password: str) -> str:
        """Get password strength level."""
        score = self.get_password_strength_score(password)
        
        if score < 30:
            return "weak"
        elif score < 60:
            return "medium"
        elif score < 80:
            return "strong"
        else:
            return "very_strong"
    
    def get_password_requirements(self) -> dict:
        """Get password requirements."""
        return {
            "min_length": 8,
            "require_uppercase": True,
            "require_lowercase": True,
            "require_digit": True,
            "require_special_char": True,
            "description": "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.",
        }
    
    def generate_secure_password(self, length: int = 16) -> str:
        """Generate a secure random password."""
        import secrets
        import string
        
        if length < 8:
            length = 8
        
        # Define character sets
        uppercase = string.ascii_uppercase
        lowercase = string.ascii_lowercase
        digits = string.digits
        special = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        
        # Ensure at least one character from each set
        password = [
            secrets.choice(uppercase),
            secrets.choice(lowercase),
            secrets.choice(digits),
            secrets.choice(special),
        ]
        
        # Fill the rest with random characters
        all_chars = uppercase + lowercase + digits + special
        for _ in range(length - 4):
            password.append(secrets.choice(all_chars))
        
        # Shuffle the password
        secrets.SystemRandom().shuffle(password)
        
        return ''.join(password)
    
    def check_password_breach(self, password: str) -> bool:
        """Check if password has been breached (placeholder implementation)."""
        # In a real implementation, you would check against known breach databases
        # For now, we'll just return False
        return False
    
    def get_password_breach_count(self, password: str) -> int:
        """Get number of times password has been breached (placeholder implementation)."""
        # In a real implementation, you would check against known breach databases
        # For now, we'll just return 0
        return 0
    
    def validate_password_change(
        self,
        old_password: str,
        new_password: str,
        current_hashed_password: str,
    ) -> dict:
        """Validate password change request."""
        result = {
            "valid": True,
            "errors": [],
            "warnings": [],
        }
        
        # Check if old password is correct
        if not self.verify_password(old_password, current_hashed_password):
            result["valid"] = False
            result["errors"].append("Current password is incorrect")
        
        # Check if new password is different from old password
        if old_password == new_password:
            result["valid"] = False
            result["errors"].append("New password must be different from current password")
        
        # Check password strength
        if not self.is_password_strong(new_password):
            result["valid"] = False
            result["errors"].append("New password does not meet strength requirements")
        
        # Check for password breach
        if self.check_password_breach(new_password):
            result["warnings"].append("This password has been found in data breaches")
        
        return result
    
    def get_password_policy(self) -> dict:
        """Get password policy information."""
        return {
            "min_length": 8,
            "max_length": 128,
            "require_uppercase": True,
            "require_lowercase": True,
            "require_digit": True,
            "require_special_char": True,
            "forbid_common_passwords": True,
            "forbid_user_info": True,
            "max_age_days": 90,
            "history_count": 5,
            "lockout_attempts": 5,
            "lockout_duration_minutes": 30,
        }
