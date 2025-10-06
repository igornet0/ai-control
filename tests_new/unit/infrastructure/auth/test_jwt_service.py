"""Tests for JWT service."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from src.infrastructure.auth.jwt_service import JWTService
from src.domain.user_management.value_objects.user_id import UserId


class TestJWTService:
    """Test cases for JWTService."""

    @pytest.fixture
    def jwt_service(self):
        """Create JWTService instance."""
        return JWTService(
            secret_key="test-secret-key",
            algorithm="HS256",
            access_token_expire_minutes=30,
            refresh_token_expire_days=7
        )

    def test_create_access_token(self, jwt_service):
        """Test access token creation."""
        # Arrange
        user_id = UserId.generate()
        user_data = {
            "user_id": str(user_id),
            "email": "test@example.com",
            "role": "user"
        }

        # Act
        token = jwt_service.create_access_token(user_data)

        # Assert
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_refresh_token(self, jwt_service):
        """Test refresh token creation."""
        # Arrange
        user_id = UserId.generate()

        # Act
        token = jwt_service.create_refresh_token(str(user_id))

        # Assert
        assert isinstance(token, str)
        assert len(token) > 0

    def test_verify_access_token_success(self, jwt_service):
        """Test successful access token verification."""
        # Arrange
        user_id = UserId.generate()
        user_data = {
            "user_id": str(user_id),
            "email": "test@example.com",
            "role": "user"
        }
        token = jwt_service.create_access_token(user_data)

        # Act
        payload = jwt_service.verify_access_token(token)

        # Assert
        assert payload is not None
        assert payload["user_id"] == str(user_id)
        assert payload["email"] == "test@example.com"
        assert payload["role"] == "user"
        assert "exp" in payload

    def test_verify_access_token_invalid(self, jwt_service):
        """Test access token verification with invalid token."""
        # Arrange
        invalid_token = "invalid.token.here"

        # Act & Assert
        with pytest.raises(Exception):  # JWT decode error
            jwt_service.verify_access_token(invalid_token)

    def test_verify_access_token_expired(self, jwt_service):
        """Test access token verification with expired token."""
        # Arrange
        user_id = UserId.generate()
        user_data = {
            "user_id": str(user_id),
            "email": "test@example.com",
            "role": "user"
        }

        # Create token with very short expiration
        with patch.object(jwt_service, 'access_token_expire_minutes', 0):
            token = jwt_service.create_access_token(user_data)

        # Act & Assert
        with pytest.raises(Exception):  # JWT expired error
            jwt_service.verify_access_token(token)

    def test_verify_refresh_token_success(self, jwt_service):
        """Test successful refresh token verification."""
        # Arrange
        user_id = UserId.generate()
        token = jwt_service.create_refresh_token(str(user_id))

        # Act
        payload = jwt_service.verify_refresh_token(token)

        # Assert
        assert payload is not None
        assert payload["user_id"] == str(user_id)
        assert payload["token_type"] == "refresh"
        assert "exp" in payload

    def test_verify_refresh_token_invalid(self, jwt_service):
        """Test refresh token verification with invalid token."""
        # Arrange
        invalid_token = "invalid.token.here"

        # Act & Assert
        with pytest.raises(Exception):  # JWT decode error
            jwt_service.verify_refresh_token(invalid_token)

    def test_get_token_expiration(self, jwt_service):
        """Test token expiration calculation."""
        # Arrange
        user_id = UserId.generate()
        user_data = {
            "user_id": str(user_id),
            "email": "test@example.com",
            "role": "user"
        }

        # Act
        token = jwt_service.create_access_token(user_data)
        payload = jwt_service.verify_access_token(token)

        # Assert
        exp_timestamp = payload["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp)
        expected_exp = datetime.utcnow() + timedelta(minutes=30)
        
        # Allow 1 minute tolerance for test execution time
        assert abs((exp_datetime - expected_exp).total_seconds()) < 60

    def test_token_payload_structure(self, jwt_service):
        """Test token payload structure."""
        # Arrange
        user_id = UserId.generate()
        user_data = {
            "user_id": str(user_id),
            "email": "test@example.com",
            "role": "admin"
        }

        # Act
        access_token = jwt_service.create_access_token(user_data)
        refresh_token = jwt_service.create_refresh_token(str(user_id))

        access_payload = jwt_service.verify_access_token(access_token)
        refresh_payload = jwt_service.verify_refresh_token(refresh_token)

        # Assert
        # Access token payload
        assert "user_id" in access_payload
        assert "email" in access_payload
        assert "role" in access_payload
        assert "exp" in access_payload
        assert "iat" in access_payload
        assert "token_type" in access_payload
        assert access_payload["token_type"] == "access"

        # Refresh token payload
        assert "user_id" in refresh_payload
        assert "exp" in refresh_payload
        assert "iat" in refresh_payload
        assert "token_type" in refresh_payload
        assert refresh_payload["token_type"] == "refresh"
