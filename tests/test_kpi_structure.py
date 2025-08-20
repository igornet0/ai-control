"""
Тесты для проверки структуры KPI API без импорта FastAPI
"""

import pytest
import os
import ast

class TestKPIStructure:
    """Тесты структуры KPI API"""
    
    def test_kpi_router_file_exists(self):
        """Тест существования файла KPI роутера"""
        router_path = "backend/api/routers/kpi/router.py"
        assert os.path.exists(router_path), f"KPI router file not found: {router_path}"
    
    def test_kpi_service_file_exists(self):
        """Тест существования файла KPI сервиса"""
        service_path = "backend/services/kpi_service.py"
        assert os.path.exists(service_path), f"KPI service file not found: {service_path}"
    
    def test_kpi_router_structure(self):
        """Тест структуры KPI роутера"""
        router_path = "backend/api/routers/kpi/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных импортов
        assert "from fastapi import APIRouter" in content
        assert "router = APIRouter" in content
        assert 'prefix="/api/kpi"' in content
        
        # Проверяем наличие основных классов
        assert "class KPICreateRequest" in content
        assert "class KPIResponse" in content
        assert "class KPICalculationRequest" in content
        assert "class KPICalculationResponse" in content
    
    def test_kpi_service_structure(self):
        """Тест структуры KPI сервиса"""
        service_path = "backend/services/kpi_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных классов
        assert "class KPIService" in content
        assert "class KPICalculation" in content
        assert "class KPITrend" in content
        
        # Проверяем наличие основных методов
        assert "def calculate_kpi" in content
        assert "def validate_formula" in content
        assert "def get_kpi_formula_templates" in content
    
    def test_kpi_endpoints_defined(self):
        """Тест определения эндпоинтов KPI"""
        router_path = "backend/api/routers/kpi/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных эндпоинтов
        endpoints = [
            "@router.post(\"/\", response_model=KPIResponse)",
            "@router.get(\"/\", response_model=List[KPIResponse])",
            "@router.post(\"/calculate\", response_model=KPICalculationResponse)",
            "@router.post(\"/calculate/batch\", response_model=List[KPICalculationResponse])",
            "@router.get(\"/formulas/templates\")",
            "@router.post(\"/formulas/validate\")",
            "@router.get(\"/categories/list\")",
            "@router.get(\"/status/summary\")"
        ]
        
        for endpoint in endpoints:
            assert endpoint in content, f"Endpoint not found: {endpoint}"
    
    def test_kpi_models_defined(self):
        """Тест определения моделей KPI"""
        router_path = "backend/api/routers/kpi/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие всех моделей
        models = [
            "KPICreateRequest",
            "KPIUpdateRequest", 
            "KPIResponse",
            "KPICalculationRequest",
            "KPICalculationResponse",
            "KPIInsightsResponse"
        ]
        
        for model in models:
            assert f"class {model}" in content, f"Model not found: {model}"
    
    def test_kpi_service_methods_defined(self):
        """Тест определения методов KPI сервиса"""
        service_path = "backend/services/kpi_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных методов
        methods = [
            "calculate_kpi",
            "calculate_multiple_kpis",
            "validate_formula",
            "get_kpi_formula_templates",
            "get_kpi_insights"
        ]
        
        for method in methods:
            assert f"def {method}" in content, f"Method not found: {method}"
    
    def test_kpi_imports_correct(self):
        """Тест корректности импортов в KPI роутере"""
        router_path = "backend/api/routers/kpi/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие необходимых импортов
        imports = [
            "from fastapi import APIRouter",
            "from backend.services.kpi_service import kpi_service",
            "from backend.api.configuration.auth import verify_authorization"
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_kpi_service_imports_correct(self):
        """Тест корректности импортов в KPI сервисе"""
        service_path = "backend/services/kpi_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие необходимых импортов
        imports = [
            "from typing import",
            "from datetime import datetime",
            "from enum import Enum"
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_kpi_router_syntax_valid(self):
        """Тест валидности синтаксиса KPI роутера"""
        router_path = "backend/api/routers/kpi/router.py"
        
        try:
            with open(router_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Пытаемся распарсить файл
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in KPI router: {e}")
    
    def test_kpi_service_syntax_valid(self):
        """Тест валидности синтаксиса KPI сервиса"""
        service_path = "backend/services/kpi_service.py"
        
        try:
            with open(service_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Пытаемся распарсить файл
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in KPI service: {e}")
    
    def test_kpi_directory_structure(self):
        """Тест структуры директорий KPI"""
        # Проверяем существование директорий
        directories = [
            "backend/api/routers/kpi",
            "backend/services"
        ]
        
        for directory in directories:
            assert os.path.exists(directory), f"Directory not found: {directory}"
            assert os.path.isdir(directory), f"Not a directory: {directory}"
    
    def test_kpi_files_readable(self):
        """Тест читаемости файлов KPI"""
        files = [
            "backend/api/routers/kpi/router.py",
            "backend/services/kpi_service.py"
        ]
        
        for file_path in files:
            assert os.path.exists(file_path), f"File not found: {file_path}"
            assert os.access(file_path, os.R_OK), f"File not readable: {file_path}"
    
    def test_kpi_router_has_docstrings(self):
        """Тест наличия документации в KPI роутере"""
        router_path = "backend/api/routers/kpi/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие документации
        assert '"""API для управления KPI"""' in content or '"""\nAPI для управления KPI\n"""' in content
        assert '"""Запрос на создание KPI"""' in content
        assert '"""Ответ с данными KPI"""' in content
    
    def test_kpi_service_has_docstrings(self):
        """Тест наличия документации в KPI сервисе"""
        service_path = "backend/services/kpi_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие документации
        assert '"""Сервис для расчета и управления KPI"""' in content or '"""\nСервис для расчета и управления KPI\n"""' in content
        assert '"""Сервис для расчета KPI"""' in content or '"""Сервис для расчета и управления KPI"""' in content
