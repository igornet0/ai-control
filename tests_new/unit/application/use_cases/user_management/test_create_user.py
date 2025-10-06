"""Tests for CreateUserUseCase."""

import pytest
from unittest.mock import Mock, AsyncMock
from src.application.use_cases.user_management.create_user import CreateUserUseCase
from src.application.dto.user_dto import CreateUserRequest, UserResponse
from src.domain.user_management.entities.user import User
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.user_management.value_objects.email import Email
from src.domain.user_management.value_objects.password import Password
from src.domain.user_management.value_objects.role import Role
from src.domain.exceptions import EntityAlreadyExists, ValidationError


class TestCreateUserUseCase:
    """Test cases for CreateUserUseCase."""

    @pytest.fixture
    def mock_user_repository(self):
        """Create mock user repository."""
        return AsyncMock()

    @pytest.fixture
    def create_user_use_case(self, mock_user_repository):
        """Create CreateUserUseCase instance with mocked dependencies."""
        return CreateUserUseCase(user_repository=mock_user_repository)

    @pytest.mark.asyncio
    async def test_create_user_success(self, create_user_use_case, mock_user_repository):
        """Test successful user creation."""
        # Arrange
        request = CreateUserRequest(
            email="test@example.com",
            password="SecurePassword123!",
            first_name="John",
            last_name="Doe",
            role="user"
        )

        mock_user_repository.find_by_email.return_value = None
        mock_user_repository.save.return_value = None

        # Act
        result = await create_user_use_case.execute(request)

        # Assert
        assert isinstance(result, UserResponse)
        assert result.email == "test@example.com"
        assert result.first_name == "John"
        assert result.last_name == "Doe"
        assert result.role == "user"
        assert result.is_active is True

        mock_user_repository.find_by_email.assert_called_once_with(Email("test@example.com"))
        mock_user_repository.save.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_user_email_already_exists(self, create_user_use_case, mock_user_repository):
        """Test user creation with existing email."""
        # Arrange
        request = CreateUserRequest(
            email="existing@example.com",
            password="SecurePassword123!",
            first_name="John",
            last_name="Doe",
            role="user"
        )

        existing_user = User(
            id=UserId.generate(),
            email=Email("existing@example.com"),
            password=Password("SomePassword123!"),
            role=Role.USER,
            first_name="Existing",
            last_name="User"
        )

        mock_user_repository.find_by_email.return_value = existing_user

        # Act & Assert
        with pytest.raises(EntityAlreadyExists, match="User with email existing@example.com already exists"):
            await create_user_use_case.execute(request)

        mock_user_repository.find_by_email.assert_called_once_with(Email("existing@example.com"))
        mock_user_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_user_invalid_email(self, create_user_use_case, mock_user_repository):
        """Test user creation with invalid email."""
        # Arrange
        request = CreateUserRequest(
            email="invalid-email",
            password="SecurePassword123!",
            first_name="John",
            last_name="Doe",
            role="user"
        )

        # Act & Assert
        with pytest.raises(ValidationError, match="Invalid email format"):
            await create_user_use_case.execute(request)

        mock_user_repository.find_by_email.assert_not_called()
        mock_user_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_user_weak_password(self, create_user_use_case, mock_user_repository):
        """Test user creation with weak password."""
        # Arrange
        request = CreateUserRequest(
            email="test@example.com",
            password="weak",
            first_name="John",
            last_name="Doe",
            role="user"
        )

        # Act & Assert
        with pytest.raises(ValidationError, match="Password does not meet security requirements"):
            await create_user_use_case.execute(request)

        mock_user_repository.find_by_email.assert_not_called()
        mock_user_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_user_invalid_role(self, create_user_use_case, mock_user_repository):
        """Test user creation with invalid role."""
        # Arrange
        request = CreateUserRequest(
            email="test@example.com",
            password="SecurePassword123!",
            first_name="John",
            last_name="Doe",
            role="invalid_role"
        )

        # Act & Assert
        with pytest.raises(ValidationError, match="Invalid role"):
            await create_user_use_case.execute(request)

        mock_user_repository.find_by_email.assert_not_called()
        mock_user_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_user_admin_role(self, create_user_use_case, mock_user_repository):
        """Test successful admin user creation."""
        # Arrange
        request = CreateUserRequest(
            email="admin@example.com",
            password="SecurePassword123!",
            first_name="Admin",
            last_name="User",
            role="admin"
        )

        mock_user_repository.find_by_email.return_value = None
        mock_user_repository.save.return_value = None

        # Act
        result = await create_user_use_case.execute(request)

        # Assert
        assert isinstance(result, UserResponse)
        assert result.email == "admin@example.com"
        assert result.role == "admin"
        assert result.is_active is True

        mock_user_repository.find_by_email.assert_called_once_with(Email("admin@example.com"))
        mock_user_repository.save.assert_called_once()
