"""
User domain entity.
Represents a user in the system with business logic and validation.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class UserRole(str, Enum):
    """User roles in the system."""
    
    ADMIN = "admin"
    CEO = "CEO"
    MANAGER = "manager"
    EMPLOYEE = "employee"


class UserStatus(str, Enum):
    """User status."""
    
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class UserCreatedEvent(DomainEvent):
    """Event raised when a user is created."""
    
    def __init__(self, user_id: UUID, username: str, email: str, role: UserRole):
        super().__init__(
            event_type="user_created",
            aggregate_id=str(user_id),
            aggregate_type="User",
            data={
                "user_id": str(user_id),
                "username": username,
                "email": email,
                "role": role.value,
            }
        )


class UserUpdatedEvent(DomainEvent):
    """Event raised when a user is updated."""
    
    def __init__(self, user_id: UUID, changes: dict):
        super().__init__(
            event_type="user_updated",
            aggregate_id=str(user_id),
            aggregate_type="User",
            data={
                "user_id": str(user_id),
                "changes": changes,
            }
        )


class UserDeactivatedEvent(DomainEvent):
    """Event raised when a user is deactivated."""
    
    def __init__(self, user_id: UUID, reason: str):
        super().__init__(
            event_type="user_deactivated",
            aggregate_id=str(user_id),
            aggregate_type="User",
            data={
                "user_id": str(user_id),
                "reason": reason,
            }
        )


class User(AggregateRoot):
    """User domain entity."""
    
    # Basic information
    login: str = Field(..., min_length=3, max_length=255, description="User login")
    username: str = Field(..., min_length=1, max_length=255, description="Display name")
    email: EmailStr = Field(..., description="User email")
    password_hash: str = Field(..., description="Hashed password")
    
    # Status and role
    role: UserRole = Field(default=UserRole.EMPLOYEE, description="User role")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="User status")
    is_active: bool = Field(default=True, description="Is user active")
    
    # Organizational information
    manager_id: Optional[UUID] = Field(default=None, description="Manager ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    position: Optional[str] = Field(default=None, max_length=255, description="Job position")
    
    # Contact information
    phone: Optional[str] = Field(default=None, max_length=50, description="Phone number")
    avatar_url: Optional[str] = Field(default=None, max_length=500, description="Avatar URL")
    bio: Optional[str] = Field(default=None, description="User biography")
    
    # Timestamps
    last_login: Optional[datetime] = Field(default=None, description="Last login time")
    
    @validator("login")
    def validate_login(cls, v):
        """Validate login format."""
        if not v.isalnum() and "_" not in v and "-" not in v:
            raise ValidationError(
                field="login",
                value=v,
                reason="Login must contain only alphanumeric characters, underscores, and hyphens"
            )
        return v.lower()
    
    @validator("username")
    def validate_username(cls, v):
        """Validate username."""
        if not v.strip():
            raise ValidationError(
                field="username",
                value=v,
                reason="Username cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("phone")
    def validate_phone(cls, v):
        """Validate phone number format."""
        if v is not None:
            # Remove all non-digit characters
            digits_only = "".join(filter(str.isdigit, v))
            if len(digits_only) < 10 or len(digits_only) > 15:
                raise ValidationError(
                    field="phone",
                    value=v,
                    reason="Phone number must contain 10-15 digits"
                )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the user."""
        # Check role hierarchy
        if self.role == UserRole.CEO and self.manager_id is not None:
            raise BusinessRuleViolation(
                "CEO cannot have a manager",
                {"role": self.role.value, "manager_id": str(self.manager_id)}
            )
        
        # Check if user is trying to be their own manager
        if self.manager_id == self.id:
            raise BusinessRuleViolation(
                "User cannot be their own manager",
                {"user_id": str(self.id), "manager_id": str(self.manager_id)}
            )
        
        # Check if inactive user has active status
        if not self.is_active and self.status == UserStatus.ACTIVE:
            raise BusinessRuleViolation(
                "Inactive user cannot have active status",
                {"is_active": self.is_active, "status": self.status.value}
            )
    
    def can_manage_users(self) -> bool:
        """Check if user can manage other users."""
        return self.role in [UserRole.ADMIN, UserRole.CEO, UserRole.MANAGER]
    
    def can_access_admin_panel(self) -> bool:
        """Check if user can access admin panel."""
        return self.role in [UserRole.ADMIN, UserRole.CEO]
    
    def can_manage_departments(self) -> bool:
        """Check if user can manage departments."""
        return self.role in [UserRole.ADMIN, UserRole.CEO]
    
    def can_view_all_tasks(self) -> bool:
        """Check if user can view all tasks."""
        return self.role in [UserRole.ADMIN, UserRole.CEO, UserRole.MANAGER]
    
    def can_assign_tasks(self) -> bool:
        """Check if user can assign tasks."""
        return self.role in [UserRole.ADMIN, UserRole.CEO, UserRole.MANAGER]
    
    def is_subordinate_of(self, manager_id: UUID) -> bool:
        """Check if user is subordinate of given manager."""
        if self.manager_id == manager_id:
            return True
        
        # Check if manager is in the hierarchy chain
        # This would require additional logic to traverse the hierarchy
        return False
    
    def update_profile(
        self,
        username: Optional[str] = None,
        email: Optional[EmailStr] = None,
        phone: Optional[str] = None,
        bio: Optional[str] = None,
        avatar_url: Optional[str] = None,
        position: Optional[str] = None,
    ) -> None:
        """Update user profile information."""
        changes = {}
        
        if username is not None and username != self.username:
            self.username = username
            changes["username"] = username
        
        if email is not None and email != self.email:
            self.email = email
            changes["email"] = str(email)
        
        if phone is not None and phone != self.phone:
            self.phone = phone
            changes["phone"] = phone
        
        if bio is not None and bio != self.bio:
            self.bio = bio
            changes["bio"] = bio
        
        if avatar_url is not None and avatar_url != self.avatar_url:
            self.avatar_url = avatar_url
            changes["avatar_url"] = avatar_url
        
        if position is not None and position != self.position:
            self.position = position
            changes["position"] = position
        
        if changes:
            self.mark_as_updated()
            self.add_domain_event(UserUpdatedEvent(self.id, changes))
    
    def change_role(self, new_role: UserRole, changed_by: UUID) -> None:
        """Change user role."""
        if new_role == self.role:
            return
        
        old_role = self.role
        self.role = new_role
        
        # Validate business rules after role change
        self.validate_business_rules()
        
        self.mark_as_updated()
        self.add_domain_event(UserUpdatedEvent(
            self.id,
            {
                "role": {"old": old_role.value, "new": new_role.value},
                "changed_by": str(changed_by),
            }
        ))
    
    def assign_manager(self, manager_id: UUID, assigned_by: UUID) -> None:
        """Assign a manager to the user."""
        if manager_id == self.manager_id:
            return
        
        if manager_id == self.id:
            raise BusinessRuleViolation(
                "User cannot be their own manager",
                {"user_id": str(self.id), "manager_id": str(manager_id)}
            )
        
        old_manager_id = self.manager_id
        self.manager_id = manager_id
        
        # Validate business rules after manager assignment
        self.validate_business_rules()
        
        self.mark_as_updated()
        self.add_domain_event(UserUpdatedEvent(
            self.id,
            {
                "manager_id": {
                    "old": str(old_manager_id) if old_manager_id else None,
                    "new": str(manager_id)
                },
                "assigned_by": str(assigned_by),
            }
        ))
    
    def deactivate(self, reason: str, deactivated_by: UUID) -> None:
        """Deactivate the user."""
        if not self.is_active:
            return
        
        self.is_active = False
        self.status = UserStatus.INACTIVE
        
        self.mark_as_updated()
        self.add_domain_event(UserDeactivatedEvent(self.id, reason))
        self.add_domain_event(UserUpdatedEvent(
            self.id,
            {
                "is_active": False,
                "status": UserStatus.INACTIVE.value,
                "deactivated_by": str(deactivated_by),
                "reason": reason,
            }
        ))
    
    def activate(self, activated_by: UUID) -> None:
        """Activate the user."""
        if self.is_active:
            return
        
        self.is_active = True
        self.status = UserStatus.ACTIVE
        
        self.mark_as_updated()
        self.add_domain_event(UserUpdatedEvent(
            self.id,
            {
                "is_active": True,
                "status": UserStatus.ACTIVE.value,
                "activated_by": str(activated_by),
            }
        ))
    
    def update_last_login(self) -> None:
        """Update last login timestamp."""
        self.last_login = datetime.utcnow()
        self.mark_as_updated()
    
    @classmethod
    def create(
        cls,
        login: str,
        username: str,
        email: EmailStr,
        password_hash: str,
        role: UserRole = UserRole.EMPLOYEE,
        manager_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        organization_id: Optional[UUID] = None,
        position: Optional[str] = None,
        phone: Optional[str] = None,
        bio: Optional[str] = None,
    ) -> "User":
        """Create a new user."""
        user = cls(
            login=login,
            username=username,
            email=email,
            password_hash=password_hash,
            role=role,
            manager_id=manager_id,
            department_id=department_id,
            organization_id=organization_id,
            position=position,
            phone=phone,
            bio=bio,
        )
        
        # Validate business rules
        user.validate_business_rules()
        
        # Add domain event
        user.add_domain_event(UserCreatedEvent(user.id, username, str(email), role))
        
        return user
