"""
Тесты для KPI API
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

class TestKPI:
    """Тесты для KPI API"""
    
    @pytest.fixture
    def app(self):
        from backend.api.create_app import create_app
        return create_app()
    
    @pytest.fixture
    def client(self, app):
        return TestClient(app)
    
    @pytest.fixture
    def auth_headers(self, client):
        """Заголовки авторизации для тестов"""
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
    
    def test_create_kpi_success(self, client, auth_headers):
        """Тест успешного создания KPI"""
        kpi_data = {
            "name": "Test KPI",
            "description": "Test KPI description",
            "formula": "SUM(sales)",
            "data_source": {
                "type": "csv",
                "file_path": "test_data.csv"
            },
            "target_value": 1000,
            "category": "sales"
        }
        
        with patch('backend.services.kpi_service.kpi_service.validate_formula') as mock_validate:
            mock_validate.return_value = {"valid": True, "type": "datacode", "message": "Valid formula"}
            
            response = client.post("/api/kpi/", json=kpi_data, headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == kpi_data["name"]
            assert data["formula"] == kpi_data["formula"]
            assert data["category"] == kpi_data["category"]
    
    def test_create_kpi_invalid_formula(self, client, auth_headers):
        """Тест создания KPI с неверной формулой"""
        kpi_data = {
            "name": "Test KPI",
            "formula": "INVALID_FORMULA",
            "data_source": {
                "type": "csv",
                "file_path": "test_data.csv"
            }
        }
        
        with patch('backend.services.kpi_service.kpi_service.validate_formula') as mock_validate:
            mock_validate.return_value = {"valid": False, "type": "error", "message": "Invalid formula"}
            
            response = client.post("/api/kpi/", json=kpi_data, headers=auth_headers)
            
            assert response.status_code == 400
            assert "Invalid formula" in response.json()["detail"]
    
    def test_create_kpi_unauthorized(self, client):
        """Тест создания KPI без авторизации"""
        kpi_data = {
            "name": "Test KPI",
            "formula": "SUM(sales)",
            "data_source": {"type": "csv", "file_path": "test_data.csv"}
        }
        
        response = client.post("/api/kpi/", json=kpi_data)
        
        assert response.status_code == 401
    
    def test_list_kpis_success(self, client, auth_headers):
        """Тест получения списка KPI"""
        response = client.get("/api/kpi/", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_kpis_unauthorized(self, client):
        """Тест получения списка KPI без авторизации"""
        response = client.get("/api/kpi/")
        
        assert response.status_code == 401
    
    def test_get_kpi_not_found(self, client, auth_headers):
        """Тест получения несуществующего KPI"""
        response = client.get("/api/kpi/999", headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_calculate_kpi_success(self, client, auth_headers):
        """Тест успешного расчета KPI"""
        calculation_data = {
            "formula": "SUM(sales)",
            "data_source": {
                "type": "csv",
                "file_path": "test_data.csv"
            },
            "target_value": 1000
        }
        
        with patch('backend.services.kpi_service.kpi_service.validate_formula') as mock_validate, \
             patch('backend.services.kpi_service.kpi_service.calculate_kpi') as mock_calculate, \
             patch('backend.services.kpi_service.kpi_service.get_kpi_insights') as mock_insights:
            
            mock_validate.return_value = {"valid": True, "type": "datacode", "message": "Valid formula"}
            
            mock_calculation = MagicMock()
            mock_calculation.value = 950
            mock_calculation.target = 1000
            mock_calculation.previous_value = 900
            mock_calculation.trend.value = "up"
            mock_calculation.change_percentage = 5.56
            mock_calculation.status = "warning"
            mock_calculation.calculated_at = "2024-01-01T12:00:00"
            mock_calculation.metadata = {}
            
            mock_calculate.return_value = mock_calculation
            mock_insights.return_value = {"summary": "Good performance"}
            
            response = client.post("/api/kpi/calculate", json=calculation_data, headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["value"] == 950
            assert data["target"] == 1000
            assert data["trend"] == "up"
            assert data["status"] == "warning"
    
    def test_calculate_kpi_missing_params(self, client, auth_headers):
        """Тест расчета KPI с недостающими параметрами"""
        calculation_data = {
            "target_value": 1000
        }
        
        response = client.post("/api/kpi/calculate", json=calculation_data, headers=auth_headers)
        
        assert response.status_code == 400
        assert "Formula and data_source are required" in response.json()["detail"]
    
    def test_calculate_kpi_invalid_formula(self, client, auth_headers):
        """Тест расчета KPI с неверной формулой"""
        calculation_data = {
            "formula": "INVALID_FORMULA",
            "data_source": {
                "type": "csv",
                "file_path": "test_data.csv"
            }
        }
        
        with patch('backend.services.kpi_service.kpi_service.validate_formula') as mock_validate:
            mock_validate.return_value = {"valid": False, "type": "error", "message": "Invalid formula"}
            
            response = client.post("/api/kpi/calculate", json=calculation_data, headers=auth_headers)
            
            assert response.status_code == 400
            assert "Invalid formula" in response.json()["detail"]
    
    def test_calculate_multiple_kpis_success(self, client, auth_headers):
        """Тест успешного расчета нескольких KPI"""
        calculations_data = [
            {
                "formula": "SUM(sales)",
                "data_source": {"type": "csv", "file_path": "sales.csv"},
                "target_value": 1000
            },
            {
                "formula": "AVG(revenue)",
                "data_source": {"type": "csv", "file_path": "revenue.csv"},
                "target_value": 500
            }
        ]
        
        with patch('backend.services.kpi_service.kpi_service.calculate_multiple_kpis') as mock_calculate, \
             patch('backend.services.kpi_service.kpi_service.get_kpi_insights') as mock_insights:
            
            mock_calculation1 = MagicMock()
            mock_calculation1.value = 950
            mock_calculation1.target = 1000
            mock_calculation1.previous_value = 900
            mock_calculation1.trend.value = "up"
            mock_calculation1.change_percentage = 5.56
            mock_calculation1.status = "warning"
            mock_calculation1.calculated_at = "2024-01-01T12:00:00"
            mock_calculation1.metadata = {}
            
            mock_calculation2 = MagicMock()
            mock_calculation2.value = 520
            mock_calculation2.target = 500
            mock_calculation2.previous_value = 480
            mock_calculation2.trend.value = "up"
            mock_calculation2.change_percentage = 8.33
            mock_calculation2.status = "success"
            mock_calculation2.calculated_at = "2024-01-01T12:00:00"
            mock_calculation2.metadata = {}
            
            mock_calculate.return_value = [mock_calculation1, mock_calculation2]
            mock_insights.return_value = {"summary": "Good performance"}
            
            response = client.post("/api/kpi/calculate/batch", json=calculations_data, headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["value"] == 950
            assert data[1]["value"] == 520
    
    def test_calculate_multiple_kpis_empty_list(self, client, auth_headers):
        """Тест расчета нескольких KPI с пустым списком"""
        response = client.post("/api/kpi/calculate/batch", json=[], headers=auth_headers)
        
        assert response.status_code == 400
        assert "No KPI requests provided" in response.json()["detail"]
    
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
    
    def test_get_kpi_insights_not_found(self, client, auth_headers):
        """Тест получения инсайтов для несуществующего расчета"""
        response = client.get("/api/kpi/insights/nonexistent", headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_refresh_kpi_not_found(self, client, auth_headers):
        """Тест обновления несуществующего KPI"""
        response = client.post("/api/kpi/refresh/999", headers=auth_headers)
        
        assert response.status_code == 404
    
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
