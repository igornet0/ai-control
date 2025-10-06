"""Integration tests for Authentication API endpoints."""

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


class TestAuthAPI:
    """Integration tests for Authentication API."""

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
    async def test_register_success(self, client, mock_user):
        """Test successful user registration via API."""
        # Arrange
        registration_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "first_name": "Jane",
            "last_name": "Smith"
        }

        with patch("src.presentation.api.dependencies.get_auth_service") as mock_auth_service:
            mock_auth_service_instance = AsyncMock()
            mock_auth_service_instance.register.return_value = {
                "user": {
                    "id": str(mock_user.id),
                    "email": registration_data["email"],
                    "first_name": registration_data["first_name"],
                    "last_name": registration_data["last_name"],
                    "role": "user",
                    "is_active": True
                },
                "access_token": "mock-access-token",
                "refresh_token": "mock-refresh-token"
            }
            mock_auth_service.return_value = mock_auth_service_instance

            # Act
            response = await client.post("/api/v1/auth/register", json=registration_data)

            # Assert
            assert response.status_code == 201
            data = response.json()
            assert "user" in data
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["user"]["email"] == registration_data["email"]

    @pytest.mark.asyncio
    async def test_register_validation_error(self, client):
        """Test user registration with validation error."""
        # Arrange
        registration_data = {
            "email": "invalid-email",
            "password": "weak",
            "first_name": "Jane",
            "last_name": "Smith"
        }

        # Act
        response = await client.post("/api/v1/auth/register", json=registration_data)

        # Assert
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_login_success(self, client, mock_user):
        """Test successful user login via API."""
        # Arrange
        login_data = {
            "email": "test@example.com",
            "password": "SecurePassword123!"
        }

        with patch("src.presentation.api.dependencies.get_auth_service") as mock_auth_service:
            mock_auth_service_instance = AsyncMock()
            mock_auth_service_instance.login.return_value = {
                "user": {
                    "id": str(mock_user.id),
                    "email": login_data["email"],
                    "first_name": mock_user.first_name,
                    "last_name": mock_user.last_name,
                    "role": mock_user.role.value,
                    "is_active": mock_user.is_active
                },
                "access_token": "mock-access-token",
                "refresh_token": "mock-refresh-token"
            }
            mock_auth_service.return_value = mock_auth_service_instance

            # Act
            response = await client.post("/api/v1/auth/login", json=login_data)

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert "user" in data
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["user"]["email"] == login_data["email"]

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        # Arrange
        login_data = {
            "email": "test@example.com",
            "password": "WrongPassword123!"
        }

        with patch("src.presentation.api.dependencies.get_auth_service") as mock_auth_service:
            mock_auth_service_instance = AsyncMock()
            mock_auth_service_instance.login.side_effect = Exception("Invalid credentials")
            mock_auth_service.return_value = mock_auth_service_instance

            # Act
            response = await client.post("/api/v1/auth/login", json=login_data)

            # Assert
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client, mock_user):
        """Test successful token refresh via API."""
        # Arrange
        refresh_data = {
            "refresh_token": "valid-refresh-token"
        }

        with patch("src.presentation.api.dependencies.get_auth_service") as mock_auth_service:
            mock_auth_service_instance = AsyncMock()
            mock_auth_service_instance.refresh_token.return_value = {
                "access_token": "new-access-token",
                "refresh_token": "new-refresh-token"
            }
            mock_auth_service.return_value = mock_auth_service_instance

            # Act
            response = await client.post("/api/v1/auth/refresh", json=refresh_data)

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert "refresh_token" in data

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, client):
        """Test token refresh with invalid refresh token."""
        # Arrange
        refresh_data = {
            "refresh_token": "invalid-refresh-token"
        }

        with patch("src.presentation.api.dependencies.get_auth_service") as mock_auth_service:
            mock_auth_service_instance = AsyncMock()
            mock_auth_service_instance.refresh_token.side_effect = Exception("Invalid refresh token")
            mock_auth_service.return_value = mock_auth_service_instance

            # Act
            response = await client.post("/api/v1/auth/refresh", json=refresh_data)

            # Assert
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_logout_success(self, client):
        """Test successful logout via API."""
        # Arrange
        logout_data = {
            "refresh_token": "valid-refresh-token"
        }

        with patch("src.presentation.api.dependencies.get_auth_service") as mock_auth_service:
            mock_auth_service_instance = AsyncMock()
            mock_auth_service_instance.logout.return_value = None
            mock_auth_service.return_value = mock_auth_service_instance

            # Act
            response = await client.post("/api/v1/auth/logout", json=logout_data)

            # Assert
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_current_user_success(self, client, mock_user):
        """Test successful current user retrieval via API."""
        # Arrange
        with patch("src.presentation.api.dependencies.get_current_user_id") as mock_get_user_id:
            mock_get_user_id.return_value = str(mock_user.id)

            with patch("src.presentation.api.dependencies.get_auth_service") as mock_auth_service:
                mock_auth_service_instance = AsyncMock()
                mock_auth_service_instance.get_current_user.return_value = {
                    "id": str(mock_user.id),
                    "email": str(mock_user.email),
                    "first_name": mock_user.first_name,
                    "last_name": mock_user.last_name,
                    "role": mock_user.role.value,
                    "is_active": mock_user.is_active
                }
                mock_auth_service.return_value = mock_auth_service_instance

                # Act
                response = await client.get("/api/v1/auth/me")

                # Assert
                assert response.status_code == 200
                data = response.json()
                assert data["id"] == str(mock_user.id)
                assert data["email"] == str(mock_user.email)

    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client):
        """Test current user retrieval without authentication."""
        # Arrange
        with patch("src.presentation.api.dependencies.get_current_user_id") as mock_get_user_id:
            mock_get_user_id.side_effect = Exception("Unauthorized")

            # Act
            response = await client.get("/api/v1/auth/me")

            # Assert
            assert response.status_code == 401
