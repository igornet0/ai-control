"""
Password value object.
Represents a secure password with validation.
"""

import re
from src.domain.base import ValueObject


class Password(ValueObject):
    """Password value object."""
    
    def __init__(self, value: str):
        if not self._is_valid_password(value):
            raise ValueError("Password does not meet security requirements")
        super().__init__(value=value)
    
    @staticmethod
    def _is_valid_password(password: str) -> bool:
        """Validate password strength."""
        if not password or not isinstance(password, str):
            return False
        
        # Minimum length
        if len(password) < 8:
            return False
        
        # Check for at least one uppercase letter
        if not re.search(r'[A-Z]', password):
            return False
        
        # Check for at least one lowercase letter
        if not re.search(r'[a-z]', password):
            return False
        
        # Check for at least one digit
        if not re.search(r'\d', password):
            return False
        
        # Check for at least one special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            return False
        
        return True
    
    @classmethod
    def from_string(cls, value: str) -> "Password":
        """Create Password from string."""
        return cls(value)
    
    def __str__(self) -> str:
        """String representation (masked for security)."""
        return "*" * len(self.value)
    
    def __repr__(self) -> str:
        """Representation (masked for security)."""
        return f"Password({'*' * len(self.value)})"
