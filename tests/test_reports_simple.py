"""
Простые тесты для системы отчетности
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta

class TestReportsEnums:
    """Тесты енумов отчетности"""
    
    def test_report_type_enum_values(self):
        """Тест значений enum ReportType"""
        from backend.api.services.reports_service import ReportType
        
        expected_values = [
            "task_summary", "performance", "time_tracking", "user_workload",
            "department_analytics", "project_progress", "task_completion"
        ]
        
        for value in expected_values:
            enum_name = value.upper()
            assert hasattr(ReportType, enum_name), f"Missing ReportType value: {value}"
    
    def test_export_format_enum_values(self):
        """Тест значений enum ExportFormat"""
        from backend.api.services.reports_service import ExportFormat
        
        expected_values = ["json", "csv", "excel", "pdf"]
        
        for value in expected_values:
            enum_name = value.upper()
            assert hasattr(ExportFormat, enum_name), f"Missing ExportFormat value: {value}"


class TestReportsService:
    """Тесты сервиса отчетов"""
    
    def test_reports_service_class_exists(self):
        """Тест существования класса ReportsService"""
        from backend.api.services.reports_service import ReportsService
        
        assert ReportsService is not None
        
        # Проверяем, что методы существуют
        assert hasattr(ReportsService, 'generate_task_summary_report')
        assert hasattr(ReportsService, 'generate_performance_report')
        assert hasattr(ReportsService, 'generate_time_tracking_report')
        assert hasattr(ReportsService, 'export_report_data')
    
    def test_report_generator_class_exists(self):
        """Тест существования класса ReportGenerator"""
        from backend.api.services.reports_service import ReportGenerator
        
        assert ReportGenerator is not None
        
        # Проверяем, что методы существуют
        assert hasattr(ReportGenerator, 'get_or_generate_report')
        assert hasattr(ReportGenerator, 'clear_cache')
    
    def test_global_report_generator_exists(self):
        """Тест существования глобального экземпляра генератора отчетов"""
        from backend.api.services.reports_service import report_generator
        
        assert report_generator is not None
        assert hasattr(report_generator, 'get_or_generate_report')
        assert hasattr(report_generator, 'clear_cache')


class TestReportsAPI:
    """Тесты API отчетов"""
    
    @patch('backend.api.routers.reports.router.verify_authorization')
    @patch('backend.api.routers.reports.router.Server.get_db')
    def test_router_exists(self, mock_get_db, mock_verify_auth):
        """Тест существования роутера отчетов"""
        from backend.api.routers.reports.router import router
        
        assert router is not None
        assert router.prefix == "/api/reports"
        assert "reports" in router.tags
    
    @patch('backend.api.routers.reports.router.verify_authorization')
    @patch('backend.api.routers.reports.router.Server.get_db')
    def test_task_summary_endpoint_exists(self, mock_get_db, mock_verify_auth):
        """Тест существования эндпоинта сводного отчета"""
        from backend.api.routers.reports.router import router
        
        routes = [route for route in router.routes if hasattr(route, 'methods')]
        task_summary_routes = [route for route in routes if 'GET' in route.methods and route.path == '/task-summary']
        assert len(task_summary_routes) > 0, "GET /task-summary endpoint not found"
    
    @patch('backend.api.routers.reports.router.verify_authorization')
    @patch('backend.api.routers.reports.router.Server.get_db')
    def test_performance_endpoint_exists(self, mock_get_db, mock_verify_auth):
        """Тест существования эндпоинта отчета производительности"""
        from backend.api.routers.reports.router import router
        
        routes = [route for route in router.routes if hasattr(route, 'methods')]
        performance_routes = [route for route in routes if 'GET' in route.methods and route.path == '/performance']
        assert len(performance_routes) > 0, "GET /performance endpoint not found"
    
    @patch('backend.api.routers.reports.router.verify_authorization')
    @patch('backend.api.routers.reports.router.Server.get_db')
    def test_time_tracking_endpoint_exists(self, mock_get_db, mock_verify_auth):
        """Тест существования эндпоинта отчета времени"""
        from backend.api.routers.reports.router import router
        
        routes = [route for route in router.routes if hasattr(route, 'methods')]
        time_tracking_routes = [route for route in routes if 'GET' in route.methods and route.path == '/time-tracking']
        assert len(time_tracking_routes) > 0, "GET /time-tracking endpoint not found"
    
    @patch('backend.api.routers.reports.router.verify_authorization')
    @patch('backend.api.routers.reports.router.Server.get_db')
    def test_export_endpoint_exists(self, mock_get_db, mock_verify_auth):
        """Тест существования эндпоинта экспорта"""
        from backend.api.routers.reports.router import router
        
        routes = [route for route in router.routes if hasattr(route, 'methods')]
        export_routes = [route for route in routes if 'POST' in route.methods and route.path == '/export']
        assert len(export_routes) > 0, "POST /export endpoint not found"


class TestReportsPydanticModels:
    """Тесты Pydantic моделей отчетов"""
    
    def test_report_filters_model(self):
        """Тест модели ReportFilters"""
        from backend.api.routers.reports.router import ReportFilters
        
        # Создаем фильтр с базовыми параметрами
        filter_data = {
            "start_date": datetime.now() - timedelta(days=30),
            "end_date": datetime.now(),
            "user_id": 1,
            "department_id": 1,
            "organization_id": 1
        }
        
        filters = ReportFilters(**filter_data)
        assert filters.start_date == filter_data["start_date"]
        assert filters.end_date == filter_data["end_date"]
        assert filters.user_id == filter_data["user_id"]
        assert filters.department_id == filter_data["department_id"]
        assert filters.organization_id == filter_data["organization_id"]
    
    def test_task_summary_filters_model(self):
        """Тест модели TaskSummaryFilters"""
        from backend.api.routers.reports.router import TaskSummaryFilters
        from core.database.models.task_model import TaskStatus, TaskPriority
        
        # Создаем фильтр с расширенными параметрами
        filter_data = {
            "start_date": datetime.now() - timedelta(days=7),
            "end_date": datetime.now(),
            "status_filter": [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS],
            "priority_filter": [TaskPriority.HIGH, TaskPriority.CRITICAL]
        }
        
        filters = TaskSummaryFilters(**filter_data)
        assert filters.start_date == filter_data["start_date"]
        assert filters.end_date == filter_data["end_date"]
        assert filters.status_filter == filter_data["status_filter"]
        assert filters.priority_filter == filter_data["priority_filter"]
    
    def test_export_request_model(self):
        """Тест модели ExportRequest"""
        from backend.api.routers.reports.router import ExportRequest
        from backend.api.services.reports_service import ReportType, ExportFormat
        
        # Создаем запрос на экспорт
        request_data = {
            "report_type": ReportType.TASK_SUMMARY,
            "format_type": ExportFormat.CSV,
            "filters": {"start_date": "2024-01-01", "end_date": "2024-01-31"}
        }
        
        export_request = ExportRequest(**request_data)
        assert export_request.report_type == ReportType.TASK_SUMMARY
        assert export_request.format_type == ExportFormat.CSV
        assert export_request.filters == request_data["filters"]


class TestReportsHelperFunctions:
    """Тесты вспомогательных функций отчетов"""
    
    def test_can_access_reports_function_exists(self):
        """Тест существования функции проверки доступа к отчетам"""
        from backend.api.routers.reports.router import can_access_reports
        
        assert callable(can_access_reports), "can_access_reports function not found"
    
    def test_can_access_reports_admin(self):
        """Тест доступа администратора к отчетам"""
        from backend.api.routers.reports.router import can_access_reports
        
        admin_user = {"role": "admin", "organization_id": 1, "department_id": 1}
        
        # Админ может видеть все отчеты
        assert can_access_reports(admin_user)
        assert can_access_reports(admin_user, organization_id=2)
        assert can_access_reports(admin_user, department_id=2)
        assert can_access_reports(admin_user, organization_id=2, department_id=2)
    
    def test_can_access_reports_ceo(self):
        """Тест доступа CEO к отчетам"""
        from backend.api.routers.reports.router import can_access_reports
        
        ceo_user = {"role": "CEO", "organization_id": 1, "department_id": 1}
        
        # CEO может видеть все отчеты
        assert can_access_reports(ceo_user)
        assert can_access_reports(ceo_user, organization_id=2)
        assert can_access_reports(ceo_user, department_id=2)
    
    def test_can_access_reports_manager(self):
        """Тест доступа менеджера к отчетам"""
        from backend.api.routers.reports.router import can_access_reports
        
        manager_user = {"role": "manager", "organization_id": 1, "department_id": 1}
        
        # Менеджер может видеть отчеты своего департамента и организации
        assert can_access_reports(manager_user)
        assert can_access_reports(manager_user, organization_id=1)
        assert can_access_reports(manager_user, department_id=1)
        assert can_access_reports(manager_user, organization_id=1, department_id=1)
        
        # Но не может видеть отчеты других департаментов/организаций
        assert not can_access_reports(manager_user, organization_id=2)
        assert not can_access_reports(manager_user, department_id=2)
    
    def test_can_access_reports_employee(self):
        """Тест доступа сотрудника к отчетам"""
        from backend.api.routers.reports.router import can_access_reports
        
        employee_user = {"role": "employee", "organization_id": 1, "department_id": 1}
        
        # Сотрудник может видеть только отчеты своей организации и департамента
        assert can_access_reports(employee_user, organization_id=1, department_id=1)
        
        # Но не может видеть отчеты других департаментов/организаций
        assert not can_access_reports(employee_user, organization_id=2, department_id=1)
        assert not can_access_reports(employee_user, organization_id=1, department_id=2)
        assert not can_access_reports(employee_user, organization_id=2, department_id=2)


class TestReportsServiceMethods:
    """Тесты методов сервиса отчетов"""
    
    @patch('backend.api.services.reports_service.select')
    @patch('backend.api.services.reports_service.AsyncSession')
    def test_reports_service_initialization(self, mock_session, mock_select):
        """Тест инициализации сервиса отчетов"""
        from backend.api.services.reports_service import ReportsService
        
        mock_session_instance = MagicMock()
        service = ReportsService(mock_session_instance)
        
        assert service.session == mock_session_instance
    
    def test_export_format_validation(self):
        """Тест валидации форматов экспорта"""
        from backend.api.services.reports_service import ExportFormat
        
        # Проверяем, что все необходимые форматы определены
        assert ExportFormat.JSON == "json"
        assert ExportFormat.CSV == "csv"
        assert ExportFormat.EXCEL == "excel"
        assert ExportFormat.PDF == "pdf"
    
    def test_report_type_validation(self):
        """Тест валидации типов отчетов"""
        from backend.api.services.reports_service import ReportType
        
        # Проверяем, что все необходимые типы отчетов определены
        assert ReportType.TASK_SUMMARY == "task_summary"
        assert ReportType.PERFORMANCE == "performance"
        assert ReportType.TIME_TRACKING == "time_tracking"
        assert ReportType.USER_WORKLOAD == "user_workload"
        assert ReportType.DEPARTMENT_ANALYTICS == "department_analytics"
        assert ReportType.PROJECT_PROGRESS == "project_progress"
        assert ReportType.TASK_COMPLETION == "task_completion"


class TestReportGenerator:
    """Тесты генератора отчетов"""
    
    def test_report_generator_initialization(self):
        """Тест инициализации генератора отчетов"""
        from backend.api.services.reports_service import ReportGenerator
        
        generator = ReportGenerator()
        
        assert hasattr(generator, '_cache')
        assert hasattr(generator, '_cache_ttl')
        assert generator._cache_ttl == 300  # 5 минут
    
    def test_report_generator_cache_operations(self):
        """Тест операций с кэшем генератора отчетов"""
        from backend.api.services.reports_service import ReportGenerator
        
        generator = ReportGenerator()
        
        # Проверяем начальное состояние кэша
        assert len(generator._cache) == 0
        
        # Проверяем метод очистки кэша
        generator._cache["test_key"] = ("test_data", datetime.now().timestamp())
        assert len(generator._cache) == 1
        
        generator.clear_cache()
        assert len(generator._cache) == 0
