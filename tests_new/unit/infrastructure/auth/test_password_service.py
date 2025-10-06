"""Tests for Password service."""

import pytest
from src.infrastructure.auth.password_service import PasswordService


class TestPasswordService:
    """Test cases for PasswordService."""

    @pytest.fixture
    def password_service(self):
        """Create PasswordService instance."""
        return PasswordService()

    def test_hash_password(self, password_service):
        """Test password hashing."""
        # Arrange
        password = "SecurePassword123!"

        # Act
        hashed = password_service.hash_password(password)

        # Assert
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt hash format

    def test_verify_password_success(self, password_service):
        """Test successful password verification."""
        # Arrange
        password = "SecurePassword123!"
        hashed = password_service.hash_password(password)

        # Act
        is_valid = password_service.verify_password(password, hashed)

        # Assert
        assert is_valid is True

    def test_verify_password_failure(self, password_service):
        """Test failed password verification."""
        # Arrange
        password = "SecurePassword123!"
        wrong_password = "WrongPassword123!"
        hashed = password_service.hash_password(password)

        # Act
        is_valid = password_service.verify_password(wrong_password, hashed)

        # Assert
        assert is_valid is False

    def test_hash_different_passwords_different_hashes(self, password_service):
        """Test that different passwords produce different hashes."""
        # Arrange
        password1 = "Password123!"
        password2 = "DifferentPassword123!"

        # Act
        hash1 = password_service.hash_password(password1)
        hash2 = password_service.hash_password(password2)

        # Assert
        assert hash1 != hash2

    def test_hash_same_password_different_hashes(self, password_service):
        """Test that same password produces different hashes (due to salt)."""
        # Arrange
        password = "SecurePassword123!"

        # Act
        hash1 = password_service.hash_password(password)
        hash2 = password_service.hash_password(password)

        # Assert
        assert hash1 != hash2  # Different salts should produce different hashes

    def test_verify_both_hashes_of_same_password(self, password_service):
        """Test that both hashes of the same password verify correctly."""
        # Arrange
        password = "SecurePassword123!"

        # Act
        hash1 = password_service.hash_password(password)
        hash2 = password_service.hash_password(password)

        # Assert
        assert password_service.verify_password(password, hash1) is True
        assert password_service.verify_password(password, hash2) is True

    def test_hash_empty_password(self, password_service):
        """Test hashing empty password."""
        # Arrange
        password = ""

        # Act
        hashed = password_service.hash_password(password)

        # Assert
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert password_service.verify_password(password, hashed) is True

    def test_verify_empty_password_against_hash(self, password_service):
        """Test verifying empty password against hash."""
        # Arrange
        password = ""
        hashed = password_service.hash_password(password)

        # Act
        is_valid = password_service.verify_password(password, hashed)

        # Assert
        assert is_valid is True

    def test_hash_very_long_password(self, password_service):
        """Test hashing very long password."""
        # Arrange
        password = "A" * 1000  # Very long password

        # Act
        hashed = password_service.hash_password(password)

        # Assert
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert password_service.verify_password(password, hashed) is True

    def test_hash_special_characters(self, password_service):
        """Test hashing password with special characters."""
        # Arrange
        password = "P@ssw0rd!@#$%^&*()_+-=[]{}|;':\",./<>?"

        # Act
        hashed = password_service.hash_password(password)

        # Assert
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert password_service.verify_password(password, hashed) is True

    def test_hash_unicode_characters(self, password_service):
        """Test hashing password with unicode characters."""
        # Arrange
        password = "Пароль123!密码🔐"

        # Act
        hashed = password_service.hash_password(password)

        # Assert
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert password_service.verify_password(password, hashed) is True
