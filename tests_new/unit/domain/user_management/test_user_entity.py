"""Tests for User entity."""

import pytest
from datetime import datetime
from src.domain.user_management.entities.user import User
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.user_management.value_objects.email import Email
from src.domain.user_management.value_objects.password import Password
from src.domain.user_management.value_objects.role import Role


class TestUserEntity:
    """Test cases for User entity."""

    def test_create_user_success(self):
        """Test successful user creation."""
        # Arrange
        user_id = UserId.generate()
        email = Email("test@example.com")
        password = Password("SecurePassword123!")
        role = Role.USER

        # Act
        user = User(
            id=user_id,
            email=email,
            password=password,
            role=role,
            first_name="John",
            last_name="Doe"
        )

        # Assert
        assert user.id == user_id
        assert user.email == email
        assert user.password == password
        assert user.role == role
        assert user.first_name == "John"
        assert user.last_name == "Doe"
        assert user.is_active is True
        assert user.created_at is not None
        assert user.updated_at is not None

    def test_user_equality(self):
        """Test user equality based on ID."""
        # Arrange
        user_id = UserId.generate()
        email = Email("test@example.com")
        password = Password("SecurePassword123!")
        role = Role.USER

        user1 = User(
            id=user_id,
            email=email,
            password=password,
            role=role,
            first_name="John",
            last_name="Doe"
        )

        user2 = User(
            id=user_id,
            email=Email("different@example.com"),
            password=Password("DifferentPassword123!"),
            role=Role.ADMIN,
            first_name="Jane",
            last_name="Smith"
        )

        # Act & Assert
        assert user1 == user2
        assert hash(user1) == hash(user2)

    def test_user_inequality(self):
        """Test user inequality with different IDs."""
        # Arrange
        email = Email("test@example.com")
        password = Password("SecurePassword123!")
        role = Role.USER

        user1 = User(
            id=UserId.generate(),
            email=email,
            password=password,
            role=role,
            first_name="John",
            last_name="Doe"
        )

        user2 = User(
            id=UserId.generate(),
            email=email,
            password=password,
            role=role,
            first_name="John",
            last_name="Doe"
        )

        # Act & Assert
        assert user1 != user2
        assert hash(user1) != hash(user2)

    def test_activate_user(self):
        """Test user activation."""
        # Arrange
        user = User(
            id=UserId.generate(),
            email=Email("test@example.com"),
            password=Password("SecurePassword123!"),
            role=Role.USER,
            first_name="John",
            last_name="Doe",
            is_active=False
        )

        # Act
        user.activate()

        # Assert
        assert user.is_active is True

    def test_deactivate_user(self):
        """Test user deactivation."""
        # Arrange
        user = User(
            id=UserId.generate(),
            email=Email("test@example.com"),
            password=Password("SecurePassword123!"),
            role=Role.USER,
            first_name="John",
            last_name="Doe",
            is_active=True
        )

        # Act
        user.deactivate()

        # Assert
        assert user.is_active is False

    def test_change_password(self):
        """Test password change."""
        # Arrange
        user = User(
            id=UserId.generate(),
            email=Email("test@example.com"),
            password=Password("OldPassword123!"),
            role=Role.USER,
            first_name="John",
            last_name="Doe"
        )
        new_password = Password("NewPassword123!")

        # Act
        user.change_password(new_password)

        # Assert
        assert user.password == new_password

    def test_update_profile(self):
        """Test profile update."""
        # Arrange
        user = User(
            id=UserId.generate(),
            email=Email("test@example.com"),
            password=Password("SecurePassword123!"),
            role=Role.USER,
            first_name="John",
            last_name="Doe"
        )

        # Act
        user.update_profile(
            first_name="Jane",
            last_name="Smith",
            phone="+1234567890"
        )

        # Assert
        assert user.first_name == "Jane"
        assert user.last_name == "Smith"
        assert user.phone == "+1234567890"

    def test_change_role(self):
        """Test role change."""
        # Arrange
        user = User(
            id=UserId.generate(),
            email=Email("test@example.com"),
            password=Password("SecurePassword123!"),
            role=Role.USER,
            first_name="John",
            last_name="Doe"
        )

        # Act
        user.change_role(Role.ADMIN)

        # Assert
        assert user.role == Role.ADMIN