"""
Структурные тесты для системы отчетности
"""
import pytest
import os
import ast
from pathlib import Path

class TestReportsStructure:
    """Тесты структуры системы отчетности"""
    
    def test_reports_service_file_exists(self):
        """Тест существования файла сервиса отчетов"""
        service_path = "backend/api/services/reports_service.py"
        assert os.path.exists(service_path), f"Service file not found: {service_path}"
    
    def test_reports_router_file_exists(self):
        """Тест существования файла роутера отчетов"""
        router_path = "backend/api/routers/reports/router.py"
        assert os.path.exists(router_path), f"Router file not found: {router_path}"
    
    def test_reports_service_structure(self):
        """Тест структуры сервиса отчетов"""
        service_path = "backend/api/services/reports_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные классы и енумы
        assert 'class ReportType(str, Enum):' in content
        assert 'class ExportFormat(str, Enum):' in content
        assert 'class ReportsService:' in content
        assert 'class ReportGenerator:' in content
        
        # Проверяем методы сервиса
        assert 'async def generate_task_summary_report(' in content
        assert 'async def generate_performance_report(' in content
        assert 'async def generate_time_tracking_report(' in content
        assert 'async def export_report_data(' in content
    
    def test_reports_router_structure(self):
        """Тест структуры роутера отчетов"""
        router_path = "backend/api/routers/reports/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные компоненты
        assert 'router = APIRouter(prefix="/api/reports", tags=["reports"])' in content
        
        # Проверяем Pydantic модели
        assert 'class ReportFilters(BaseModel):' in content
        assert 'class TaskSummaryFilters(ReportFilters):' in content
        assert 'class PerformanceFilters(BaseModel):' in content
        assert 'class TimeTrackingFilters(BaseModel):' in content
        assert 'class ExportRequest(BaseModel):' in content
        
        # Проверяем вспомогательные функции
        assert 'def can_access_reports(' in content
    
    def test_reports_endpoints_defined(self):
        """Тест определения эндпоинтов отчетов"""
        router_path = "backend/api/routers/reports/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных эндпоинтов
        endpoints = [
            '@router.get("/task-summary", response_model=Dict[str, Any])',
            '@router.get("/performance", response_model=Dict[str, Any])',
            '@router.get("/time-tracking", response_model=Dict[str, Any])',
            '@router.post("/export")',
            '@router.get("/types")',
            '@router.get("/dashboard-data")',
            '@router.delete("/cache")'
        ]
        
        for endpoint in endpoints:
            assert endpoint in content, f"Endpoint not found: {endpoint}"
    
    def test_reports_enums_defined(self):
        """Тест определения енумов отчетов"""
        service_path = "backend/api/services/reports_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения ReportType
        report_types = [
            'TASK_SUMMARY = "task_summary"',
            'PERFORMANCE = "performance"',
            'TIME_TRACKING = "time_tracking"',
            'USER_WORKLOAD = "user_workload"',
            'DEPARTMENT_ANALYTICS = "department_analytics"',
            'PROJECT_PROGRESS = "project_progress"',
            'TASK_COMPLETION = "task_completion"'
        ]
        
        for report_type in report_types:
            assert report_type in content, f"Report type not found: {report_type}"
        
        # Проверяем значения ExportFormat
        export_formats = [
            'JSON = "json"',
            'CSV = "csv"',
            'EXCEL = "excel"',
            'PDF = "pdf"'
        ]
        
        for export_format in export_formats:
            assert export_format in content, f"Export format not found: {export_format}"
    
    def test_reports_service_methods_defined(self):
        """Тест определения методов сервиса отчетов"""
        service_path = "backend/api/services/reports_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем методы ReportsService
        service_methods = [
            'async def generate_task_summary_report(',
            'async def generate_performance_report(',
            'async def generate_time_tracking_report(',
            'async def export_report_data(',
            'async def _export_to_csv(',
            'async def _export_to_excel(',
            'async def _export_to_pdf('
        ]
        
        for method in service_methods:
            assert method in content, f"Service method not found: {method}"
        
        # Проверяем методы ReportGenerator
        generator_methods = [
            'async def get_or_generate_report(',
            'def clear_cache('
        ]
        
        for method in generator_methods:
            assert method in content, f"Generator method not found: {method}"
    
    def test_reports_imports_correct(self):
        """Тест корректности импортов в роутере отчетов"""
        router_path = "backend/api/routers/reports/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные импорты
        imports = [
            'from backend.api.configuration.auth import verify_authorization, require_role',
            'from backend.api.configuration.server import Server',
            'from backend.api.services.reports_service import',
            'from core.database.models.task_model import TaskStatus, TaskPriority, TaskType'
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_reports_service_imports_correct(self):
        """Тест корректности импортов в сервисе отчетов"""
        service_path = "backend/api/services/reports_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные импорты
        imports = [
            'from core.database.models.task_model import',
            'from core.database.models.main_models import User, Organization, Department',
            'from sqlalchemy.ext.asyncio import AsyncSession',
            'from sqlalchemy import select, func, and_, or_, desc, asc'
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_reports_router_syntax_valid(self):
        """Тест валидности синтаксиса роутера отчетов"""
        router_path = "backend/api/routers/reports/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        try:
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in reports router: {e}")
    
    def test_reports_service_syntax_valid(self):
        """Тест валидности синтаксиса сервиса отчетов"""
        service_path = "backend/api/services/reports_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        try:
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in reports service: {e}")
    
    def test_reports_directory_structure(self):
        """Тест структуры директорий отчетов"""
        
        # Проверяем, что директории существуют
        assert os.path.exists("backend/api/routers/reports"), "Reports router directory not found"
        assert os.path.exists("backend/api/services"), "Services directory not found"
        
        # Проверяем файлы
        router_file = "backend/api/routers/reports/router.py"
        service_file = "backend/api/services/reports_service.py"
        
        assert os.path.isfile(router_file), f"Router file not found: {router_file}"
        assert os.path.isfile(service_file), f"Service file not found: {service_file}"
    
    def test_reports_files_readable(self):
        """Тест читаемости файлов отчетов"""
        
        files_to_check = [
            "backend/api/routers/reports/router.py",
            "backend/api/services/reports_service.py"
        ]
        
        for file_path in files_to_check:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    assert len(content) > 0, f"File is empty: {file_path}"
            except Exception as e:
                pytest.fail(f"Cannot read file {file_path}: {e}")
    
    def test_reports_router_has_docstrings(self):
        """Тест наличия докстрингов в роутере отчетов"""
        router_path = "backend/api/routers/reports/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем докстринги для основных функций
        function_docstrings = [
            '"""Получение сводного отчета по задачам"""',
            '"""Получение отчета по производительности"""',
            '"""Получение отчета по учету времени"""',
            '"""Экспорт отчета в различные форматы"""',
            '"""Получение списка доступных типов отчетов"""',
            '"""Получение данных для дашборда отчетов"""',
            '"""Очистка кэша отчетов (только для администраторов)"""'
        ]
        
        for expected_docstring in function_docstrings:
            # Либо точное совпадение, либо без тройных кавычек
            assert (expected_docstring in content or 
                    expected_docstring.strip('"""') in content), f"Docstring not found: {expected_docstring}"
    
    def test_reports_service_has_docstrings(self):
        """Тест наличия докстрингов в сервисе отчетов"""
        service_path = "backend/api/services/reports_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем докстринги для основных классов и методов
        docstrings = [
            '"""Сервис для работы с отчетами"""',
            '"""Генерация сводного отчета по задачам"""',
            '"""Генерация отчета по производительности"""',
            '"""Генерация отчета по учету времени"""',
            '"""Экспорт данных отчета в различные форматы"""'
        ]
        
        for docstring in docstrings:
            # Либо точное совпадение, либо без тройных кавычек
            assert (docstring in content or 
                    docstring.strip('"""') in content), f"Docstring not found: {docstring}"
    
    def test_reports_global_instance_exists(self):
        """Тест существования глобального экземпляра генератора отчетов"""
        service_path = "backend/api/services/reports_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, что создан глобальный экземпляр
        assert 'report_generator = ReportGenerator()' in content, "Global report_generator instance not found"
