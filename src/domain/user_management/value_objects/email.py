"""
Email value object.
Represents a valid email address.
"""

import re
from pydantic import EmailStr
from src.domain.base import ValueObject


class Email(ValueObject):
    """Email value object."""
    
    def __init__(self, value: str):
        if not self._is_valid_email(value):
            raise ValueError(f"Invalid email format: {value}")
        super().__init__(value=value.lower().strip())
    
    @staticmethod
    def _is_valid_email(email: str) -> bool:
        """Validate email format."""
        if not email or not isinstance(email, str):
            return False
        
        # Basic email regex pattern
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email.strip()))
    
    @classmethod
    def from_string(cls, value: str) -> "Email":
        """Create Email from string."""
        return cls(value)
    
    def get_domain(self) -> str:
        """Get email domain."""
        return self.value.split('@')[1]
    
    def get_local_part(self) -> str:
        """Get email local part."""
        return self.value.split('@')[0]
    
    def __str__(self) -> str:
        """String representation."""
        return self.value
    
    def __repr__(self) -> str:
        """Representation."""
        return f"Email({self.value})"
