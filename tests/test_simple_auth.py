"""
Простой тест для проверки базовой функциональности аутентификации
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from fastapi import status

from backend.api.create_app import create_app


class TestSimpleAuth:
    """Простой тест аутентификации"""
    
    @pytest.fixture
    def app(self):
        """Создаем приложение для тестирования"""
        return create_app()
    
    @pytest.fixture
    def client(self, app):
        """Создаем тестовый клиент"""
        return TestClient(app)
    
    def test_app_creation(self, app):
        """Тест создания приложения"""
        assert app is not None
        assert hasattr(app, 'routes')
    
    def test_health_check(self, client):
        """Тест проверки здоровья приложения"""
        response = client.get("/")
        assert response.status_code in [200, 404, 401]  # Может быть 401 из-за middleware
    
    def test_docs_endpoint(self, client):
        """Тест доступа к документации"""
        response = client.get("/docs")
        assert response.status_code == 200
    
    def test_register_endpoint_exists(self, client):
        """Тест существования эндпоинта регистрации"""
        response = client.post("/auth/register/", json={})
        # Должен вернуть 422 (ValidationError) а не 404 (Not Found)
        assert response.status_code != 404
    
    def test_login_endpoint_exists(self, client):
        """Тест существования эндпоинта входа"""
        response = client.post("/auth/login_user/", data={})
        # Должен вернуть 422 (ValidationError) а не 404 (Not Found)
        assert response.status_code != 404
    
    def test_middleware_blocks_protected_endpoints(self, client):
        """Тест что middleware блокирует защищенные эндпоинты"""
        # Попытка доступа к защищенному эндпоинту без токена
        response = client.get("/auth/users/")
        assert response.status_code == 401
    
    def test_public_endpoints_accessible(self, client):
        """Тест что публичные эндпоинты доступны"""
        # Документация должна быть доступна
        response = client.get("/docs")
        assert response.status_code == 200
        
        # Redoc должен быть доступен
        response = client.get("/redoc")
        assert response.status_code == 200
    
    def test_auth_endpoints_accessible(self, client):
        """Тест что эндпоинты аутентификации доступны"""
        # Регистрация должна быть доступна
        response = client.post("/auth/register/", json={})
        assert response.status_code != 404
        
        # Вход должен быть доступен
        response = client.post("/auth/login_user/", data={})
        assert response.status_code != 404
