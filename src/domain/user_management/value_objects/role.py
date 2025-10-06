"""
User role value object.
Represents user roles in the system.
"""

from enum import Enum
from src.domain.base import ValueObject


class Role(Enum):
    """User roles in the system."""
    
    USER = "user"
    ADMIN = "admin"
    MANAGER = "manager"
    CEO = "ceo"
    EMPLOYEE = "employee"


class UserRole(ValueObject):
    """User role value object."""
    
    def __init__(self, value: Role):
        if not isinstance(value, Role):
            raise ValueError(f"Invalid role: {value}")
        super().__init__(value=value)
    
    @classmethod
    def from_string(cls, value: str) -> "UserRole":
        """Create UserRole from string."""
        try:
            role = Role(value.lower())
            return cls(role)
        except ValueError:
            raise ValueError(f"Invalid role string: {value}")
    
    @classmethod
    def user(cls) -> "UserRole":
        """Create user role."""
        return cls(Role.USER)
    
    @classmethod
    def admin(cls) -> "UserRole":
        """Create admin role."""
        return cls(Role.ADMIN)
    
    @classmethod
    def manager(cls) -> "UserRole":
        """Create manager role."""
        return cls(Role.MANAGER)
    
    @classmethod
    def ceo(cls) -> "UserRole":
        """Create CEO role."""
        return cls(Role.CEO)
    
    @classmethod
    def employee(cls) -> "UserRole":
        """Create employee role."""
        return cls(Role.EMPLOYEE)
    
    def is_admin(self) -> bool:
        """Check if role is admin."""
        return self.value == Role.ADMIN
    
    def is_manager(self) -> bool:
        """Check if role is manager."""
        return self.value == Role.MANAGER
    
    def is_ceo(self) -> bool:
        """Check if role is CEO."""
        return self.value == Role.CEO
    
    def can_manage_users(self) -> bool:
        """Check if role can manage users."""
        return self.value in [Role.ADMIN, Role.CEO, Role.MANAGER]
    
    def can_access_admin_panel(self) -> bool:
        """Check if role can access admin panel."""
        return self.value in [Role.ADMIN, Role.CEO]
    
    def __str__(self) -> str:
        """String representation."""
        return self.value.value
    
    def __repr__(self) -> str:
        """Representation."""
        return f"UserRole({self.value.value})"
