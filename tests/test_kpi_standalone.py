"""
Автономные тесты для KPI API с полным моком зависимостей
"""

import pytest
import uuid
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

class TestKPIStandalone:
    """Автономные тесты для KPI API"""
    
    @pytest.fixture
    def app(self):
        """Создаем приложение с полным моком всех зависимостей"""
        # Мокаем все импорты, которые могут вызвать проблемы с БД
        with patch('core.database.engine.db_helper'), \
             patch('backend.api.configuration.server.Server.get_db'), \
             patch('backend.api.middleware.auth_middleware.setup_auth_middleware'), \
             patch('backend.api.configuration.lifespan.app_lifespan'), \
             patch('backend.api.configuration.server.Server'):
            
            # Мокаем создание приложения
            with patch('backend.api.create_app.create_app') as mock_create_app:
                mock_app = MagicMock()
                mock_create_app.return_value = mock_app
                
                # Импортируем и создаем приложение
                from backend.api.create_app import create_app
                return create_app()
    
    @pytest.fixture
    def client(self, app):
        return TestClient(app)
    
    def test_kpi_endpoints_exist(self, client):
        """Тест существования эндпоинтов KPI"""
        # Проверяем, что эндпоинты доступны (даже если возвращают ошибки авторизации)
        endpoints = [
            ("GET", "/api/kpi/"),
            ("GET", "/api/kpi/formulas/templates"),
            ("POST", "/api/kpi/formulas/validate"),
            ("GET", "/api/kpi/categories/list"),
            ("GET", "/api/kpi/status/summary"),
            ("POST", "/api/kpi/calculate"),
            ("POST", "/api/kpi/calculate/batch"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})
            
            # Эндпоинт должен существовать (возвращать 401 или 422, но не 404)
            assert response.status_code in [401, 422, 400], f"Endpoint {method} {endpoint} not found"
    
    def test_kpi_unauthorized_access(self, client):
        """Тест доступа к KPI эндпоинтам без авторизации"""
        endpoints = [
            ("GET", "/api/kpi/"),
            ("GET", "/api/kpi/formulas/templates"),
            ("POST", "/api/kpi/formulas/validate"),
            ("GET", "/api/kpi/categories/list"),
            ("GET", "/api/kpi/status/summary"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})
            
            # Должна быть ошибка авторизации
            assert response.status_code == 401, f"Endpoint {method} {endpoint} should require authorization"
    
    def test_kpi_formula_validation_endpoint(self, client):
        """Тест эндпоинта валидации формулы"""
        # Проверяем, что эндпоинт принимает параметр formula
        response = client.post("/api/kpi/formulas/validate?formula=SUM(sales)")
        
        # Должна быть ошибка авторизации, но не 404
        assert response.status_code == 401
    
    def test_kpi_calculation_endpoint(self, client):
        """Тест эндпоинта расчета KPI"""
        # Проверяем, что эндпоинт принимает JSON
        calculation_data = {
            "formula": "SUM(sales)",
            "data_source": {"type": "csv", "file_path": "test.csv"}
        }
        
        response = client.post("/api/kpi/calculate", json=calculation_data)
        
        # Должна быть ошибка авторизации, но не 404
        assert response.status_code == 401
    
    def test_kpi_batch_calculation_endpoint(self, client):
        """Тест эндпоинта массового расчета KPI"""
        # Проверяем, что эндпоинт принимает массив
        calculations_data = [
            {
                "formula": "SUM(sales)",
                "data_source": {"type": "csv", "file_path": "sales.csv"}
            }
        ]
        
        response = client.post("/api/kpi/calculate/batch", json=calculations_data)
        
        # Должна быть ошибка авторизации, но не 404
        assert response.status_code == 401
    
    def test_kpi_endpoint_structure(self, client):
        """Тест структуры ответов KPI эндпоинтов"""
        # Проверяем, что эндпоинты возвращают правильную структуру ошибок
        response = client.get("/api/kpi/categories/list")
        
        # Должна быть ошибка авторизации с деталями
        assert response.status_code == 401
        error_data = response.json()
        assert "detail" in error_data
    
    def test_kpi_service_import(self):
        """Тест импорта KPI сервиса"""
        # Проверяем, что KPI сервис можно импортировать
        try:
            from backend.services.kpi_service import kpi_service, KPICalculation, KPITrend
            assert kpi_service is not None
            assert KPICalculation is not None
            assert KPITrend is not None
        except ImportError as e:
            pytest.fail(f"Failed to import KPI service: {e}")
    
    def test_kpi_router_import(self):
        """Тест импорта KPI роутера"""
        # Проверяем, что KPI роутер можно импортировать
        try:
            from backend.api.routers.kpi.router import router
            assert router is not None
            assert hasattr(router, 'routes')
        except ImportError as e:
            pytest.fail(f"Failed to import KPI router: {e}")
    
    def test_kpi_models_defined(self):
        """Тест определения моделей KPI"""
        # Проверяем, что модели Pydantic определены
        try:
            from backend.api.routers.kpi.router import (
                KPICreateRequest, KPIUpdateRequest, KPIResponse,
                KPICalculationRequest, KPICalculationResponse, KPIInsightsResponse
            )
            
            assert KPICreateRequest is not None
            assert KPIUpdateRequest is not None
            assert KPIResponse is not None
            assert KPICalculationRequest is not None
            assert KPICalculationResponse is not None
            assert KPIInsightsResponse is not None
            
        except ImportError as e:
            pytest.fail(f"Failed to import KPI models: {e}")
    
    def test_kpi_endpoint_methods(self, client):
        """Тест методов KPI эндпоинтов"""
        # Проверяем, что эндпоинты поддерживают правильные HTTP методы
        
        # GET эндпоинты
        get_endpoints = [
            "/api/kpi/",
            "/api/kpi/formulas/templates",
            "/api/kpi/categories/list",
            "/api/kpi/status/summary",
        ]
        
        for endpoint in get_endpoints:
            response = client.get(endpoint)
            assert response.status_code == 401  # Ошибка авторизации, но эндпоинт существует
        
        # POST эндпоинты
        post_endpoints = [
            "/api/kpi/formulas/validate",
            "/api/kpi/calculate",
            "/api/kpi/calculate/batch",
        ]
        
        for endpoint in post_endpoints:
            response = client.post(endpoint, json={})
            assert response.status_code in [401, 422]  # Ошибка авторизации или валидации
    
    def test_kpi_router_prefix(self):
        """Тест префикса KPI роутера"""
        try:
            from backend.api.routers.kpi.router import router
            assert router.prefix == "/api/kpi"
            assert "kpi" in router.tags
        except ImportError as e:
            pytest.fail(f"Failed to import KPI router: {e}")
    
    def test_kpi_service_methods(self):
        """Тест методов KPI сервиса"""
        try:
            from backend.services.kpi_service import kpi_service
            
            # Проверяем, что основные методы существуют
            assert hasattr(kpi_service, 'calculate_kpi')
            assert hasattr(kpi_service, 'calculate_multiple_kpis')
            assert hasattr(kpi_service, 'validate_formula')
            assert hasattr(kpi_service, 'get_kpi_formula_templates')
            assert hasattr(kpi_service, 'get_kpi_insights')
            
        except ImportError as e:
            pytest.fail(f"Failed to import KPI service: {e}")
    
    def test_kpi_data_structures(self):
        """Тест структур данных KPI"""
        try:
            from backend.services.kpi_service import KPICalculation, KPITrend
            
            # Проверяем, что классы определены
            assert KPICalculation is not None
            assert KPITrend is not None
            
            # Проверяем, что KPITrend имеет нужные значения
            assert hasattr(KPITrend, 'UP')
            assert hasattr(KPITrend, 'DOWN')
            assert hasattr(KPITrend, 'STABLE')
            
        except ImportError as e:
            pytest.fail(f"Failed to import KPI data structures: {e}")
