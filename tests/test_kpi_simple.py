"""
Простые тесты для KPI API без подключения к базе данных
"""

import pytest
import uuid
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

class TestKPISimple:
    """Простые тесты для KPI API"""
    
    @pytest.fixture
    def app(self):
        """Создаем приложение с моками для базы данных"""
        with patch('core.database.engine.db_helper'), \
             patch('backend.api.configuration.server.Server.get_db'):
            
            from backend.api.create_app import create_app
            return create_app()
    
    @pytest.fixture
    def client(self, app):
        return TestClient(app)
    
    @pytest.fixture
    def auth_headers(self, client):
        """Заголовки авторизации для тестов"""
        # Мокаем регистрацию и авторизацию
        with patch('backend.api.routers.auth.router.register_user') as mock_register, \
             patch('backend.api.routers.auth.router.login_user') as mock_login:
            
            mock_register.return_value = {"message": "User registered successfully"}
            mock_login.return_value = {
                "access_token": "test_token_123",
                "token_type": "bearer"
            }
            
            # Регистрируем пользователя
            user_data = {
                "login": f"testuser_{uuid.uuid4().hex[:8]}",
                "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
                "password": "testpassword123",
                "first_name": "Test",
                "last_name": "User"
            }
            
            response = client.post("/api/auth/register", json=user_data)
            assert response.status_code == 200
            
            # Получаем токен
            login_data = {
                "username": user_data["login"],
                "password": user_data["password"]
            }
            
            response = client.post("/api/auth/login", data=login_data)
            assert response.status_code == 200
            
            token_data = response.json()
            token = token_data["access_token"]
            
            return {"Authorization": f"Bearer {token}"}
    
    def test_get_kpi_formula_templates(self, client, auth_headers):
        """Тест получения шаблонов формул KPI"""
        with patch('backend.services.kpi_service.kpi_service.get_kpi_formula_templates') as mock_templates:
            mock_templates.return_value = [
                {
                    "name": "Sales Sum",
                    "formula": "SUM(sales)",
                    "category": "sales",
                    "description": "Sum of all sales"
                }
            ]
            
            response = client.get("/api/kpi/formulas/templates", headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert "templates" in data
            assert "total_count" in data
            assert "categories" in data
            assert len(data["templates"]) == 1
    
    def test_validate_kpi_formula_success(self, client, auth_headers):
        """Тест успешной валидации формулы KPI"""
        with patch('backend.services.kpi_service.kpi_service.validate_formula') as mock_validate:
            mock_validate.return_value = {"valid": True, "type": "datacode", "message": "Valid formula"}
            
            response = client.post("/api/kpi/formulas/validate?formula=SUM(sales)", headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is True
            assert data["type"] == "datacode"
    
    def test_validate_kpi_formula_invalid(self, client, auth_headers):
        """Тест валидации неверной формулы KPI"""
        with patch('backend.services.kpi_service.kpi_service.validate_formula') as mock_validate:
            mock_validate.return_value = {"valid": False, "type": "error", "message": "Invalid formula"}
            
            response = client.post("/api/kpi/formulas/validate?formula=INVALID", headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is False
            assert data["type"] == "error"
    
    def test_get_kpi_categories(self, client, auth_headers):
        """Тест получения категорий KPI"""
        response = client.get("/api/kpi/categories/list", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert "sales" in data["categories"]
        assert "marketing" in data["categories"]
    
    def test_get_kpi_status_summary(self, client, auth_headers):
        """Тест получения сводки по статусам KPI"""
        response = client.get("/api/kpi/status/summary", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_kpis" in data
        assert "active_kpis" in data
        assert "success_count" in data
        assert "warning_count" in data
        assert "critical_count" in data
        assert "error_count" in data
        assert "last_updated" in data
    
    def test_list_kpis_unauthorized(self, client):
        """Тест получения списка KPI без авторизации"""
        response = client.get("/api/kpi/")
        
        assert response.status_code == 401
    
    def test_get_kpi_formula_templates_unauthorized(self, client):
        """Тест получения шаблонов формул без авторизации"""
        response = client.get("/api/kpi/formulas/templates")
        
        assert response.status_code == 401
    
    def test_validate_kpi_formula_unauthorized(self, client):
        """Тест валидации формулы без авторизации"""
        response = client.post("/api/kpi/formulas/validate?formula=SUM(sales)")
        
        assert response.status_code == 401
    
    def test_get_kpi_categories_unauthorized(self, client):
        """Тест получения категорий без авторизации"""
        response = client.get("/api/kpi/categories/list")
        
        assert response.status_code == 401
    
    def test_get_kpi_status_summary_unauthorized(self, client):
        """Тест получения сводки без авторизации"""
        response = client.get("/api/kpi/status/summary")
        
        assert response.status_code == 401
