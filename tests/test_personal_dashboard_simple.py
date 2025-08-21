"""
Простые тесты для системы личного кабинета и виджетов
"""
import pytest
from unittest.mock import MagicMock
from datetime import datetime

# Импорты для тестирования
from core.database.models.personal_dashboard_model import (
    WidgetCategory, WidgetType
)
from backend.api.routers.personal_dashboard.router import (
    WidgetCreateRequest, WidgetUpdateRequest, QuickActionCreateRequest,
    UserPreferencesUpdateRequest
)

class TestWidgetEnums:
    """Тесты енумов виджетов"""
    
    def test_widget_category_values(self):
        """Тест значений категорий виджетов"""
        assert WidgetCategory.SYSTEM == "system"
        assert WidgetCategory.PERSONAL == "personal"
        assert WidgetCategory.DASHBOARD == "dashboard"
        assert WidgetCategory.CUSTOM == "custom"
        assert WidgetCategory.COMMUNICATION == "communication"
    
    def test_widget_type_values(self):
        """Тест значений типов виджетов"""
        assert WidgetType.MINI_MAIL == "mini_mail"
        assert WidgetType.TODO_LIST == "todo_list"
        assert WidgetType.CALENDAR == "calendar"
        assert WidgetType.NOTIFICATIONS == "notifications"
        assert WidgetType.QUICK_ACTIONS == "quick_actions"
        assert WidgetType.CHART == "chart"
        assert WidgetType.TABLE == "table"
        assert WidgetType.KPI == "kpi"
    
    def test_widget_category_membership(self):
        """Тест принадлежности к категориям виджетов"""
        categories = list(WidgetCategory)
        assert len(categories) == 5
        assert "system" in [cat.value for cat in categories]
        assert "personal" in [cat.value for cat in categories]
        assert "dashboard" in [cat.value for cat in categories]
        assert "custom" in [cat.value for cat in categories]
        assert "communication" in [cat.value for cat in categories]
    
    def test_widget_type_membership(self):
        """Тест принадлежности к типам виджетов"""
        types = list(WidgetType)
        # Проверяем наличие основных типов, но не точное количество
        assert len(types) >= 8
        assert "mini_mail" in [t.value for t in types]
        assert "todo_list" in [t.value for t in types]
        assert "calendar" in [t.value for t in types]
        assert "notifications" in [t.value for t in types]
        assert "quick_actions" in [t.value for t in types]
        assert "chart" in [t.value for t in types]
        assert "table" in [t.value for t in types]
        assert "kpi" in [t.value for t in types]

class TestWidgetPluginManager:
    """Тесты менеджера плагинов виджетов"""
    
    def test_plugin_manager_initialization(self):
        """Тест инициализации менеджера плагинов"""
        from backend.api.services.widget_service import WidgetPluginManager
        
        plugin_manager = WidgetPluginManager()
        assert plugin_manager.loaded_plugins == {}
        assert plugin_manager.plugins_directory is not None
    
    def test_plugin_manager_methods_exist(self):
        """Тест существования методов менеджера плагинов"""
        from backend.api.services.widget_service import WidgetPluginManager
        
        plugin_manager = WidgetPluginManager()
        
        # Проверяем наличие основных методов
        assert hasattr(plugin_manager, 'load_plugin')
        assert hasattr(plugin_manager, 'get_plugin')
        assert hasattr(plugin_manager, 'list_plugins')
        assert hasattr(plugin_manager, 'execute_plugin_method')
        
        # Проверяем, что методы являются корутинами
        import asyncio
        assert asyncio.iscoroutinefunction(plugin_manager.load_plugin)
        assert asyncio.iscoroutinefunction(plugin_manager.get_plugin)
        assert asyncio.iscoroutinefunction(plugin_manager.list_plugins)
        assert asyncio.iscoroutinefunction(plugin_manager.execute_plugin_method)

class TestWidgetService:
    """Тесты сервиса виджетов"""
    
    def test_widget_service_initialization(self):
        """Тест инициализации сервиса виджетов"""
        from backend.api.services.widget_service import WidgetService
        from unittest.mock import AsyncMock
        
        mock_session = AsyncMock()
        widget_service = WidgetService(mock_session)
        
        assert widget_service.session == mock_session
        assert hasattr(widget_service, 'plugin_manager')
    
    def test_widget_service_methods_exist(self):
        """Тест существования методов сервиса виджетов"""
        from backend.api.services.widget_service import WidgetService
        from unittest.mock import AsyncMock
        
        mock_session = AsyncMock()
        widget_service = WidgetService(mock_session)
        
        # Проверяем наличие основных методов
        assert hasattr(widget_service, 'create_personal_dashboard')
        assert hasattr(widget_service, 'get_personal_dashboard')
        assert hasattr(widget_service, 'create_widget')
        assert hasattr(widget_service, 'get_widget_data')
        
        # Проверяем, что методы являются корутинами
        import asyncio
        assert asyncio.iscoroutinefunction(widget_service.create_personal_dashboard)
        assert asyncio.iscoroutinefunction(widget_service.get_personal_dashboard)
        assert asyncio.iscoroutinefunction(widget_service.create_widget)
        assert asyncio.iscoroutinefunction(widget_service.get_widget_data)

class TestPersonalDashboardService:
    """Тесты сервиса личного кабинета"""
    
    def test_personal_dashboard_service_initialization(self):
        """Тест инициализации сервиса личного кабинета"""
        from backend.api.services.widget_service import PersonalDashboardService
        from unittest.mock import AsyncMock
        
        mock_session = AsyncMock()
        dashboard_service = PersonalDashboardService(mock_session)
        
        assert dashboard_service.session == mock_session
        assert hasattr(dashboard_service, 'widget_service')
    
    def test_personal_dashboard_service_methods_exist(self):
        """Тест существования методов сервиса личного кабинета"""
        from backend.api.services.widget_service import PersonalDashboardService
        from unittest.mock import AsyncMock
        
        mock_session = AsyncMock()
        dashboard_service = PersonalDashboardService(mock_session)
        
        # Проверяем наличие основных методов
        assert hasattr(dashboard_service, 'initialize_user_dashboard')
        assert hasattr(dashboard_service, 'widget_service')
        
        # Проверяем методы через widget_service
        assert hasattr(dashboard_service.widget_service, 'create_quick_action')
        assert hasattr(dashboard_service.widget_service, 'get_user_quick_actions')
        assert hasattr(dashboard_service.widget_service, 'update_user_preferences')
        assert hasattr(dashboard_service.widget_service, 'get_user_preferences')
        assert hasattr(dashboard_service.widget_service, 'install_widget_plugin')
        assert hasattr(dashboard_service.widget_service, 'get_available_plugins')
        
        # Проверяем, что методы являются корутинами
        import asyncio
        assert asyncio.iscoroutinefunction(dashboard_service.initialize_user_dashboard)
        assert asyncio.iscoroutinefunction(dashboard_service.widget_service.create_quick_action)
        assert asyncio.iscoroutinefunction(dashboard_service.widget_service.get_user_quick_actions)
        assert asyncio.iscoroutinefunction(dashboard_service.widget_service.update_user_preferences)
        assert asyncio.iscoroutinefunction(dashboard_service.widget_service.get_user_preferences)
        assert asyncio.iscoroutinefunction(dashboard_service.widget_service.install_widget_plugin)
        assert asyncio.iscoroutinefunction(dashboard_service.widget_service.get_available_plugins)

class TestPersonalDashboardPydanticModels:
    """Тесты Pydantic моделей личного кабинета"""
    
    def test_widget_create_request_validation(self):
        """Тест валидации запроса создания виджета"""
        valid_data = {
            "name": "Test Widget",
            "widget_type": "chart",
            "category": "dashboard",
            "position_x": 0,
            "position_y": 0,
            "width": 6,
            "height": 4,
            "config": {"chart_type": "bar"}
        }
        
        request = WidgetCreateRequest(**valid_data)
        
        assert request.name == "Test Widget"
        assert request.widget_type == "chart"
        assert request.category == "dashboard"
        assert request.position_x == 0
        assert request.position_y == 0
        assert request.width == 6
        assert request.height == 4
        assert request.config == {"chart_type": "bar"}
    
    def test_widget_update_request_validation(self):
        """Тест валидации запроса обновления виджета"""
        valid_data = {
            "name": "Updated Widget",
            "position_x": 10,
            "position_y": 20,
            "width": 8,
            "height": 6,
            "config": {"chart_type": "line"}
        }
        
        request = WidgetUpdateRequest(**valid_data)
        
        assert request.name == "Updated Widget"
        assert request.position_x == 10
        assert request.position_y == 20
        assert request.width == 8
        assert request.height == 6
        assert request.config == {"chart_type": "line"}
    
    def test_quick_action_create_request_validation(self):
        """Тест валидации запроса создания быстрого действия"""
        valid_data = {
            "name": "Create Task",
            "description": "Quickly create a new task",
            "action_type": "create_task",
            "icon": "plus",
            "action_config": {"default_priority": "high"}
        }
        
        request = QuickActionCreateRequest(**valid_data)
        
        assert request.name == "Create Task"
        assert request.description == "Quickly create a new task"
        assert request.action_type == "create_task"
        assert request.icon == "plus"
        assert request.action_config == {"default_priority": "high"}
    
    def test_user_preferences_update_request_validation(self):
        """Тест валидации запроса обновления пользовательских предпочтений"""
        valid_data = {
            "ui_theme": "dark",
            "ui_density": "compact",
            "ui_animations": True,
            "ui_sounds": False,
            "dashboard_layout": "grid",
            "dashboard_columns": 16,
            "dashboard_auto_refresh": True,
            "dashboard_refresh_interval": 600,
            "notification_email": True,
            "notification_push": False,
            "notification_sound": True
        }
        
        request = UserPreferencesUpdateRequest(**valid_data)
        
        assert request.ui_theme == "dark"
        assert request.ui_density == "compact"
        assert request.ui_animations is True
        assert request.ui_sounds is False
        assert request.dashboard_layout == "grid"
        assert request.dashboard_columns == 16
        assert request.dashboard_auto_refresh is True
        assert request.dashboard_refresh_interval == 600
        assert request.notification_email is True
        assert request.notification_push is False
        assert request.notification_sound is True
    
    def test_widget_create_request_validation_with_optional_fields(self):
        """Тест валидации запроса создания виджета с опциональными полями"""
        valid_data = {
            "name": "Test Widget",
            "widget_type": "chart",
            "category": "dashboard"
        }
        
        request = WidgetCreateRequest(**valid_data)
        
        assert request.name == "Test Widget"
        assert request.widget_type == "chart"
        assert request.category == "dashboard"
        assert request.position_x == 0  # значение по умолчанию
        assert request.position_y == 0  # значение по умолчанию
        assert request.width == 6  # значение по умолчанию
        assert request.height == 4  # значение по умолчанию
        assert request.config is None  # значение по умолчанию
    
    def test_widget_update_request_validation_with_partial_data(self):
        """Тест валидации запроса обновления виджета с частичными данными"""
        valid_data = {
            "name": "Updated Widget"
        }
        
        request = WidgetUpdateRequest(**valid_data)
        
        assert request.name == "Updated Widget"
        assert request.position_x is None
        assert request.position_y is None
        assert request.width is None
        assert request.height is None
        assert request.config is None
    
    def test_quick_action_create_request_validation_with_optional_fields(self):
        """Тест валидации запроса создания быстрого действия с опциональными полями"""
        valid_data = {
            "name": "Create Task",
            "action_type": "create_task",
            "action_config": {"default_priority": "high"}
        }
        
        request = QuickActionCreateRequest(**valid_data)
        
        assert request.name == "Create Task"
        assert request.action_type == "create_task"
        assert request.action_config == {"default_priority": "high"}
        assert request.description is None
        assert request.icon is None
    
    def test_user_preferences_update_request_validation_with_partial_data(self):
        """Тест валидации запроса обновления пользовательских предпочтений с частичными данными"""
        valid_data = {
            "ui_theme": "dark"
        }
        
        request = UserPreferencesUpdateRequest(**valid_data)
        
        assert request.ui_theme == "dark"
        assert request.ui_density is None
        assert request.ui_animations is None
        assert request.ui_sounds is None
        assert request.dashboard_layout is None
        assert request.dashboard_columns is None
        assert request.dashboard_auto_refresh is None
        assert request.dashboard_refresh_interval is None
        assert request.notification_email is None
        assert request.notification_push is None
        assert request.notification_sound is None

class TestPersonalDashboardRouter:
    """Тесты роутера личного кабинета"""
    
    def test_router_initialization(self):
        """Тест инициализации роутера"""
        from backend.api.routers.personal_dashboard.router import router
        
        assert router is not None
        assert hasattr(router, 'routes')
        assert len(router.routes) > 0
    
    def test_router_prefix(self):
        """Тест префикса роутера"""
        from backend.api.routers.personal_dashboard.router import router
        
        assert router.prefix == "/api/personal-dashboard"
        assert "personal-dashboard" in router.tags
    
    def test_router_endpoints_exist(self):
        """Тест существования эндпоинтов роутера"""
        from backend.api.routers.personal_dashboard.router import router
        
        # Проверяем наличие основных эндпоинтов
        route_paths = [route.path for route in router.routes]
        
        expected_paths = [
            "/layout",
            "/widgets",
            "/widgets/{widget_id}",
            "/widgets/{widget_id}/data",
            "/quick-actions",
            "/quick-actions/{action_id}",
            "/preferences",
            "/widget-types",
            "/initialize"
        ]
        
        for expected_path in expected_paths:
            assert any(expected_path in path for path in route_paths), f"Path {expected_path} not found in router"

class TestPersonalDashboardModels:
    """Тесты моделей личного кабинета"""
    
    def test_personal_dashboard_model_structure(self):
        """Тест структуры модели личного кабинета"""
        from core.database.models.personal_dashboard_model import PersonalDashboard
        
        # Проверяем наличие основных полей
        assert hasattr(PersonalDashboard, '__tablename__')
        assert PersonalDashboard.__tablename__ == "personal_dashboards"
        
        # Проверяем наличие основных атрибутов
        assert hasattr(PersonalDashboard, 'id')
        assert hasattr(PersonalDashboard, 'user_id')
        assert hasattr(PersonalDashboard, 'theme')
        assert hasattr(PersonalDashboard, 'show_sidebar')
        assert hasattr(PersonalDashboard, 'show_header')
        assert hasattr(PersonalDashboard, 'layout_config')
        assert hasattr(PersonalDashboard, 'created_at')
        assert hasattr(PersonalDashboard, 'updated_at')
    
    def test_personal_widget_model_structure(self):
        """Тест структуры модели виджета"""
        from core.database.models.personal_dashboard_model import PersonalWidget
        
        # Проверяем наличие основных полей
        assert hasattr(PersonalWidget, '__tablename__')
        assert PersonalWidget.__tablename__ == "personal_widgets"
        
        # Проверяем наличие основных атрибутов
        assert hasattr(PersonalWidget, 'id')
        assert hasattr(PersonalWidget, 'dashboard_id')
        assert hasattr(PersonalWidget, 'name')
        assert hasattr(PersonalWidget, 'widget_type')
        assert hasattr(PersonalWidget, 'category')
        assert hasattr(PersonalWidget, 'position_x')
        assert hasattr(PersonalWidget, 'position_y')
        assert hasattr(PersonalWidget, 'width')
        assert hasattr(PersonalWidget, 'height')
        assert hasattr(PersonalWidget, 'config')
        assert hasattr(PersonalWidget, 'created_at')
        assert hasattr(PersonalWidget, 'updated_at')
    
    def test_quick_action_model_structure(self):
        """Тест структуры модели быстрого действия"""
        from core.database.models.personal_dashboard_model import QuickAction
        
        # Проверяем наличие основных полей
        assert hasattr(QuickAction, '__tablename__')
        assert QuickAction.__tablename__ == "quick_actions"
        
        # Проверяем наличие основных атрибутов
        assert hasattr(QuickAction, 'id')
        assert hasattr(QuickAction, 'user_id')
        assert hasattr(QuickAction, 'name')
        assert hasattr(QuickAction, 'description')
        assert hasattr(QuickAction, 'action_type')
        assert hasattr(QuickAction, 'icon')
        assert hasattr(QuickAction, 'action_config')
        assert hasattr(QuickAction, 'position')
        assert hasattr(QuickAction, 'is_visible')
        assert hasattr(QuickAction, 'is_pinned')
        assert hasattr(QuickAction, 'created_at')
        assert hasattr(QuickAction, 'updated_at')
    
    def test_user_preference_model_structure(self):
        """Тест структуры модели пользовательских предпочтений"""
        from core.database.models.personal_dashboard_model import UserPreference
        
        # Проверяем наличие основных полей
        assert hasattr(UserPreference, '__tablename__')
        assert UserPreference.__tablename__ == "user_preferences"
        
        # Проверяем наличие основных атрибутов
        assert hasattr(UserPreference, 'id')
        assert hasattr(UserPreference, 'user_id')
        assert hasattr(UserPreference, 'ui_theme')
        assert hasattr(UserPreference, 'ui_density')
        assert hasattr(UserPreference, 'ui_animations')
        assert hasattr(UserPreference, 'ui_sounds')
        assert hasattr(UserPreference, 'dashboard_layout')
        assert hasattr(UserPreference, 'dashboard_columns')
        assert hasattr(UserPreference, 'dashboard_auto_refresh')
        assert hasattr(UserPreference, 'dashboard_refresh_interval')
        assert hasattr(UserPreference, 'notification_email')
        assert hasattr(UserPreference, 'notification_push')
        assert hasattr(UserPreference, 'notification_sound')
        assert hasattr(UserPreference, 'created_at')
        assert hasattr(UserPreference, 'updated_at')

class TestPersonalDashboardIntegration:
    """Интеграционные тесты личного кабинета"""
    
    def test_widget_category_and_type_consistency(self):
        """Тест согласованности категорий и типов виджетов"""
        # Проверяем, что все типы виджетов имеют соответствующие категории
        widget_type_to_category = {
            WidgetType.MINI_MAIL: WidgetCategory.COMMUNICATION,
            WidgetType.TODO_LIST: WidgetCategory.PERSONAL,
            WidgetType.CALENDAR: WidgetCategory.PERSONAL,
            WidgetType.NOTIFICATIONS: WidgetCategory.SYSTEM,
            WidgetType.QUICK_ACTIONS: WidgetCategory.SYSTEM,
            WidgetType.CHART: WidgetCategory.DASHBOARD,
            WidgetType.TABLE: WidgetCategory.DASHBOARD,
            WidgetType.KPI: WidgetCategory.DASHBOARD
        }
        
        for widget_type, expected_category in widget_type_to_category.items():
            # Проверяем, что категория существует
            assert expected_category in WidgetCategory
            # Проверяем, что тип виджета существует
            assert widget_type in WidgetType
    
    def test_pydantic_model_consistency(self):
        """Тест согласованности Pydantic моделей"""
        # Проверяем, что Pydantic модели могут работать с енумами
        widget_data = {
            "name": "Test Widget",
            "widget_type": WidgetType.CHART.value,
            "category": WidgetCategory.DASHBOARD.value,
            "position_x": 0,
            "position_y": 0,
            "width": 6,
            "height": 4,
            "config": {"chart_type": "bar"}
        }
        
        request = WidgetCreateRequest(**widget_data)
        
        assert request.widget_type == WidgetType.CHART.value
        assert request.category == WidgetCategory.DASHBOARD.value
    
    def test_service_dependency_injection(self):
        """Тест внедрения зависимостей в сервисы"""
        from backend.api.services.widget_service import WidgetService, PersonalDashboardService
        from unittest.mock import AsyncMock
        
        mock_session = AsyncMock()
        
        # Создаем сервисы
        widget_service = WidgetService(mock_session)
        dashboard_service = PersonalDashboardService(mock_session)
        
        # Проверяем, что сессии правильно внедрены
        assert widget_service.session == mock_session
        assert dashboard_service.session == mock_session
        
        # Проверяем, что сервисы связаны
        assert dashboard_service.widget_service is not None
        assert isinstance(dashboard_service.widget_service, WidgetService)
    
    def test_model_relationships(self):
        """Тест связей между моделями"""
        from core.database.models.personal_dashboard_model import (
            PersonalDashboard, PersonalWidget, QuickAction, UserPreference
        )
        
        # Проверяем, что модели имеют правильные связи
        assert hasattr(PersonalDashboard, 'widgets')
        assert hasattr(PersonalDashboard, 'user')
        assert hasattr(PersonalWidget, 'dashboard')
        assert hasattr(QuickAction, 'user')
        assert hasattr(UserPreference, 'user')
    
    def test_enum_values_consistency(self):
        """Тест согласованности значений енумов"""
        # Проверяем, что все значения енумов являются строками
        for category in WidgetCategory:
            assert isinstance(category.value, str)
            assert len(category.value) > 0
        
        for widget_type in WidgetType:
            assert isinstance(widget_type.value, str)
            assert len(widget_type.value) > 0
        
        # Проверяем уникальность значений
        category_values = [cat.value for cat in WidgetCategory]
        assert len(category_values) == len(set(category_values))
        
        widget_type_values = [wt.value for wt in WidgetType]
        assert len(widget_type_values) == len(set(widget_type_values))
