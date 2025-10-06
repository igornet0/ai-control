"""Integration tests for User API endpoints."""

import pytest
from httpx import AsyncClient
from fastapi import FastAPI
from unittest.mock import AsyncMock, patch
from src.main import app
from src.domain.user_management.entities.user import User
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.user_management.value_objects.email import Email
from src.domain.user_management.value_objects.password import Password
from src.domain.user_management.value_objects.role import Role


class TestUserAPI:
    """Integration tests for User API."""

    @pytest.fixture
    async def client(self):
        """Create test client."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return User(
            id=UserId.generate(),
            email=Email("test@example.com"),
            password=Password("SecurePassword123!"),
            role=Role.USER,
            first_name="John",
            last_name="Doe"
        )

    @pytest.mark.asyncio
    async def test_create_user_success(self, client, mock_user):
        """Test successful user creation via API."""
        # Arrange
        user_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "first_name": "Jane",
            "last_name": "Smith",
            "role": "user"
        }

        with patch("src.presentation.api.dependencies.get_create_user_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = {
                "id": str(mock_user.id),
                "email": user_data["email"],
                "first_name": user_data["first_name"],
                "last_name": user_data["last_name"],
                "role": user_data["role"],
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.post("/api/v1/users", json=user_data)

            # Assert
            assert response.status_code == 201
            data = response.json()
            assert data["email"] == user_data["email"]
            assert data["first_name"] == user_data["first_name"]
            assert data["last_name"] == user_data["last_name"]
            assert data["role"] == user_data["role"]
            assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_create_user_validation_error(self, client):
        """Test user creation with validation error."""
        # Arrange
        user_data = {
            "email": "invalid-email",
            "password": "weak",
            "first_name": "Jane",
            "last_name": "Smith",
            "role": "user"
        }

        # Act
        response = await client.post("/api/v1/users", json=user_data)

        # Assert
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_get_user_success(self, client, mock_user):
        """Test successful user retrieval via API."""
        # Arrange
        user_id = str(mock_user.id)

        with patch("src.presentation.api.dependencies.get_user_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = {
                "id": user_id,
                "email": str(mock_user.email),
                "first_name": mock_user.first_name,
                "last_name": mock_user.last_name,
                "role": mock_user.role.value,
                "is_active": mock_user.is_active,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.get(f"/api/v1/users/{user_id}")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == user_id
            assert data["email"] == str(mock_user.email)

    @pytest.mark.asyncio
    async def test_get_user_not_found(self, client):
        """Test user retrieval with non-existent user."""
        # Arrange
        user_id = "non-existent-id"

        with patch("src.presentation.api.dependencies.get_user_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.side_effect = Exception("User not found")
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.get(f"/api/v1/users/{user_id}")

            # Assert
            assert response.status_code == 500  # Internal server error

    @pytest.mark.asyncio
    async def test_get_users_success(self, client, mock_user):
        """Test successful users list retrieval via API."""
        # Arrange
        with patch("src.presentation.api.dependencies.get_users_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = [
                {
                    "id": str(mock_user.id),
                    "email": str(mock_user.email),
                    "first_name": mock_user.first_name,
                    "last_name": mock_user.last_name,
                    "role": mock_user.role.value,
                    "is_active": mock_user.is_active,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                }
            ]
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.get("/api/v1/users")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["email"] == str(mock_user.email)

    @pytest.mark.asyncio
    async def test_update_user_success(self, client, mock_user):
        """Test successful user update via API."""
        # Arrange
        user_id = str(mock_user.id)
        update_data = {
            "first_name": "Updated",
            "last_name": "Name",
            "phone": "+1234567890"
        }

        with patch("src.presentation.api.dependencies.get_update_user_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = {
                "id": user_id,
                "email": str(mock_user.email),
                "first_name": update_data["first_name"],
                "last_name": update_data["last_name"],
                "phone": update_data["phone"],
                "role": mock_user.role.value,
                "is_active": mock_user.is_active,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.put(f"/api/v1/users/{user_id}", json=update_data)

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["first_name"] == update_data["first_name"]
            assert data["last_name"] == update_data["last_name"]
            assert data["phone"] == update_data["phone"]

    @pytest.mark.asyncio
    async def test_delete_user_success(self, client, mock_user):
        """Test successful user deletion via API."""
        # Arrange
        user_id = str(mock_user.id)

        with patch("src.presentation.api.dependencies.get_delete_user_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = None
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.delete(f"/api/v1/users/{user_id}")

            # Assert
            assert response.status_code == 204