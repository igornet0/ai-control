"""
Простые тесты для API обработки данных
"""

import pytest
from fastapi.testclient import TestClient
from fastapi import status

from backend.api.create_app import create_app


class TestDataProcessingSimple:
    """Простые тесты для API обработки данных"""
    
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
    
    def test_docs_endpoint(self, client):
        """Тест доступа к документации"""
        response = client.get("/docs")
        assert response.status_code == 200
    
    def test_data_processing_endpoints_exist(self, client):
        """Тест существования эндпоинтов обработки данных"""
        # Проверяем, что эндпоинты требуют авторизации (401)
        response = client.get("/api/data-processing/supported-formats")
        assert response.status_code == 401
        
        response = client.post("/api/data-processing/upload")
        assert response.status_code == 401
        
        response = client.get("/api/data-processing/files")
        assert response.status_code == 401
    
    def test_upload_endpoint_requires_auth(self, client):
        """Тест что эндпоинт загрузки требует авторизации"""
        response = client.post("/api/data-processing/upload")
        assert response.status_code == 401
    
    def test_process_endpoint_requires_auth(self, client):
        """Тест что эндпоинт обработки требует авторизации"""
        response = client.post("/api/data-processing/process", json={})
        assert response.status_code == 401
    
    def test_validate_script_endpoint_requires_auth(self, client):
        """Тест что эндпоинт валидации требует авторизации"""
        response = client.post("/api/data-processing/validate-script")
        assert response.status_code == 401
    
    def test_execute_script_endpoint_requires_auth(self, client):
        """Тест что эндпоинт выполнения скрипта требует авторизации"""
        response = client.post("/api/data-processing/execute-script")
        assert response.status_code == 401
    
    def test_datacode_functions_endpoint_requires_auth(self, client):
        """Тест что эндпоинт функций DataCode требует авторизации"""
        response = client.get("/api/data-processing/datacode-functions")
        assert response.status_code == 401
