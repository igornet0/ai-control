"""
Тест регистрации пользователя
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from fastapi import status

from backend.api.create_app import create_app


class TestUserRegistration:
    """Тест регистрации пользователя"""
    
    @pytest.fixture
    def app(self):
        """Создаем приложение для тестирования"""
        return create_app()
    
    @pytest.fixture
    def client(self, app):
        """Создаем тестовый клиент"""
        return TestClient(app)
    
    def test_user_registration_success(self, client):
        """Тест успешной регистрации пользователя"""
        # Генерируем уникальные данные
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "login": f"testuser_{unique_id}",
            "username": f"Test User {unique_id}",
            "email": f"testuser_{unique_id}@example.com",
            "password": "testpassword123",
            "role": "employee"
        }
        
        # Регистрируем пользователя
        response = client.post("/auth/register/", json=user_data)
        
        # Проверяем успешную регистрацию
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert "message" in response_data
        assert "access_token" in response_data
        assert "token_type" in response_data
        assert response_data["message"] == "User registered successfully"
        assert response_data["token_type"] == "bearer"
    
    def test_user_registration_duplicate_login(self, client):
        """Тест регистрации с дублирующимся логином"""
        # Генерируем уникальные данные
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "login": f"duplicate_{unique_id}",
            "username": f"Duplicate User {unique_id}",
            "email": f"duplicate1_{unique_id}@example.com",
            "password": "testpassword123",
            "role": "employee"
        }
        
        # Первая регистрация
        response1 = client.post("/auth/register/", json=user_data)
        assert response1.status_code == status.HTTP_200_OK
        
        # Вторая регистрация с тем же логином
        user_data["email"] = f"duplicate2_{unique_id}@example.com"
        response2 = client.post("/auth/register/", json=user_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_user_registration_duplicate_email(self, client):
        """Тест регистрации с дублирующимся email"""
        # Генерируем уникальные данные
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "login": f"email1_{unique_id}",
            "username": f"Email User 1 {unique_id}",
            "email": f"sameemail_{unique_id}@example.com",
            "password": "testpassword123",
            "role": "employee"
        }
        
        # Первая регистрация
        response1 = client.post("/auth/register/", json=user_data)
        assert response1.status_code == status.HTTP_200_OK
        
        # Вторая регистрация с тем же email
        user_data["login"] = f"email2_{unique_id}"
        response2 = client.post("/auth/register/", json=user_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_user_registration_invalid_role(self, client):
        """Тест регистрации с недопустимой ролью"""
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "login": f"invalidrole_{unique_id}",
            "username": f"Invalid Role User {unique_id}",
            "email": f"invalidrole_{unique_id}@example.com",
            "password": "testpassword123",
            "role": "invalid_role"  # Несуществующая роль
        }
        
        response = client.post("/auth/register/", json=user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_user_registration_missing_fields(self, client):
        """Тест регистрации с отсутствующими полями"""
        # Тест без логина
        user_data = {
            "username": "Test User",
            "email": "test@example.com",
            "password": "testpassword123",
            "role": "employee"
        }
        
        response = client.post("/auth/register/", json=user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_admin_registration(self, client):
        """Тест регистрации админа"""
        unique_id = uuid.uuid4().hex[:8]
        admin_data = {
            "login": f"admin_{unique_id}",
            "username": f"Admin User {unique_id}",
            "email": f"admin_{unique_id}@example.com",
            "password": "adminpassword123",
            "role": "admin"
        }
        
        response = client.post("/auth/register/", json=admin_data)
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert "user_id" in response_data
        assert response_data["user_id"] is not None
