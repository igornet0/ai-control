"""
Функциональные тесты для системы личного кабинета и виджетов
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Импорты для тестирования
from core.database.models.personal_dashboard_model import (
    WidgetCategory, WidgetType
)
from backend.api.services.widget_service import (
    WidgetPluginManager, WidgetService, PersonalDashboardService
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
    
    @pytest.fixture
    def plugin_manager(self):
        """Фикстура менеджера плагинов"""
        return WidgetPluginManager()
    
    def test_plugin_manager_initialization(self, plugin_manager):
        """Тест инициализации менеджера плагинов"""
        assert plugin_manager.loaded_plugins == {}
        assert plugin_manager.plugins_directory is not None
    
    @pytest.mark.asyncio
    @patch('importlib.util.spec_from_file_location')
    @patch('importlib.util.module_from_spec')
    async def test_load_plugin_success(self, mock_module_from_spec, mock_spec_from_file, plugin_manager):
        """Тест успешной загрузки плагина"""
        # Мокаем модуль плагина
        mock_plugin_module = MagicMock()
        mock_plugin_module.PLUGIN_INFO = {
            'name': 'test_plugin',
            'version': '1.0.0',
            'description': 'Test plugin'
        }
        mock_module_from_spec.return_value = mock_plugin_module
        
        # Мокаем spec
        mock_spec = MagicMock()
        mock_spec.loader = MagicMock()
        mock_spec_from_file.return_value = mock_spec
        
        # Тестируем загрузку плагина
        plugin_path = "/path/to/plugin.py"
        
        with patch('pathlib.Path.exists', return_value=True):
            result = await plugin_manager.load_plugin(plugin_path)
        
        assert result is not None
        assert result['name'] == 'test_plugin'
        assert 'test_plugin' in plugin_manager.loaded_plugins
    
    @pytest.mark.asyncio
    async def test_load_plugin_invalid_path(self, plugin_manager):
        """Тест загрузки плагина с неверным путем"""
        plugin_path = "/nonexistent/path/plugin.py"
        
        with patch('pathlib.Path.exists', return_value=False):
            result = await plugin_manager.load_plugin(plugin_path)
        
        assert result is None
        assert plugin_path not in plugin_manager.loaded_plugins
    
    @pytest.mark.asyncio
    async def test_get_plugin_success(self, plugin_manager):
        """Тест получения загруженного плагина"""
        plugin_name = "test_plugin"
        mock_plugin = {"name": plugin_name, "version": "1.0.0"}
        plugin_manager.loaded_plugins[plugin_name] = mock_plugin
        
        result = await plugin_manager.get_plugin(plugin_name)
        
        assert result == mock_plugin
    
    @pytest.mark.asyncio
    async def test_get_plugin_not_found(self, plugin_manager):
        """Тест получения несуществующего плагина"""
        plugin_name = "nonexistent_plugin"
        
        result = await plugin_manager.get_plugin(plugin_name)
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_list_plugins(self, plugin_manager):
        """Тест списка плагинов"""
        plugin_manager.loaded_plugins = {
            "plugin1": {"name": "plugin1", "version": "1.0.0"},
            "plugin2": {"name": "plugin2", "version": "1.0.0"},
            "plugin3": {"name": "plugin3", "version": "1.0.0"}
        }
        
        result = await plugin_manager.list_plugins()
        
        assert len(result) == 3
        assert any(p['name'] == "plugin1" for p in result)
        assert any(p['name'] == "plugin2" for p in result)
        assert any(p['name'] == "plugin3" for p in result)

class TestWidgetService:
    """Тесты сервиса виджетов"""
    
    @pytest.fixture
    def mock_session(self):
        """Фикстура мок сессии БД"""
        return AsyncMock()
    
    @pytest.fixture
    def widget_service(self, mock_session):
        """Фикстура сервиса виджетов"""
        return WidgetService(mock_session)
    
    @pytest.mark.asyncio
    async def test_create_personal_dashboard_success(self, widget_service, mock_session):
        """Тест успешного создания личного кабинета"""
        user_id = 1
        
        # Мокаем результат
        mock_dashboard = MagicMock()
        mock_dashboard.user_id = user_id
        mock_dashboard.theme = "default"
        mock_session.execute.return_value.scalar_one.return_value = mock_dashboard
        
        result = await widget_service.create_personal_dashboard(user_id)
        
        assert result is not None
        assert result.user_id == user_id
        assert result.theme == "default"
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_personal_dashboard_success(self, widget_service, mock_session):
        """Тест успешного получения личного кабинета"""
        user_id = 1
        
        # Мокаем результат
        mock_dashboard = MagicMock()
        mock_dashboard.user_id = user_id
        mock_dashboard.theme = "light"
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_dashboard
        
        result = await widget_service.get_personal_dashboard(user_id)
        
        assert result is not None
        assert result.user_id == user_id
        assert result.theme == "light"
    
    @pytest.mark.asyncio
    async def test_get_personal_dashboard_not_found(self, widget_service, mock_session):
        """Тест получения несуществующего личного кабинета"""
        user_id = 999
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        
        result = await widget_service.get_personal_dashboard(user_id)
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_create_widget_success(self, widget_service, mock_session):
        """Тест успешного создания виджета"""
        dashboard_id = 1
        widget_data = {
            "name": "Test Widget",
            "widget_type": WidgetType.CHART,
            "category": WidgetCategory.DASHBOARD,
            "position_x": 0,
            "position_y": 0,
            "width": 6,
            "height": 4,
            "config": {"chart_type": "bar"}
        }
        
        # Мокаем результат
        mock_widget = MagicMock()
        mock_widget.name = widget_data["name"]
        mock_widget.widget_type = widget_data["widget_type"]
        mock_widget.category = widget_data["category"]
        mock_session.execute.return_value.scalar_one.return_value = mock_widget
        
        result = await widget_service.create_widget(dashboard_id, widget_data)
        
        assert result is not None
        assert result.name == widget_data["name"]
        assert result.widget_type == widget_data["widget_type"]
        assert result.category == widget_data["category"]
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_widget_data_success(self, widget_service, mock_session):
        """Тест успешного получения данных виджета"""
        widget_id = 1
        
        # Мокаем виджет с данными
        mock_widget = MagicMock()
        mock_widget.id = widget_id
        mock_widget.config = {
            "chart_type": "bar",
            "data_source": "sales",
            "refresh_interval": 300
        }
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_widget
        
        result = await widget_service.get_widget_data(widget_id)
        
        assert result is not None
        assert "widget" in result
        assert "data" in result
        assert result["widget"].id == widget_id
        assert result["data"]["chart_type"] == "bar"
    
    @pytest.mark.asyncio
    async def test_get_dashboard_widgets_success(self, widget_service, mock_session):
        """Тест успешного получения виджетов дашборда"""
        dashboard_id = 1
        
        # Мокаем виджеты
        mock_widgets = [
            MagicMock(name="Widget 1", widget_type=WidgetType.CHART),
            MagicMock(name="Widget 2", widget_type=WidgetType.TABLE)
        ]
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_widgets
        
        result = await widget_service.get_dashboard_widgets(dashboard_id)
        
        assert len(result) == 2
        assert result[0].name == "Widget 1"
        assert result[1].name == "Widget 2"

class TestPersonalDashboardService:
    """Тесты сервиса личного кабинета"""
    
    @pytest.fixture
    def mock_session(self):
        """Фикстура мок сессии БД"""
        return AsyncMock()
    
    @pytest.fixture
    def dashboard_service(self, mock_session):
        """Фикстура сервиса личного кабинета"""
        return PersonalDashboardService(mock_session)
    
    @pytest.mark.asyncio
    async def test_create_personal_dashboard_success(self, dashboard_service, mock_session):
        """Тест успешного создания личного кабинета"""
        user_id = 1
        dashboard_data = {
            "theme": "dark",
            "show_sidebar": True,
            "show_header": False,
            "layout_config": {"columns": 12, "rows": 8}
        }
        
        # Мокаем результат
        mock_dashboard = MagicMock()
        mock_dashboard.user_id = user_id
        mock_dashboard.theme = dashboard_data["theme"]
        mock_dashboard.show_sidebar = dashboard_data["show_sidebar"]
        mock_dashboard.show_header = dashboard_data["show_header"]
        mock_session.execute.return_value.scalar_one.return_value = mock_dashboard
        
        result = await dashboard_service.create_personal_dashboard(user_id, dashboard_data)
        
        assert result is not None
        assert result.user_id == user_id
        assert result.theme == dashboard_data["theme"]
        assert result.show_sidebar == dashboard_data["show_sidebar"]
        assert result.show_header == dashboard_data["show_header"]
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_personal_dashboard_success(self, dashboard_service, mock_session):
        """Тест успешного получения личного кабинета"""
        user_id = 1
        
        # Мокаем результат
        mock_dashboard = MagicMock()
        mock_dashboard.user_id = user_id
        mock_dashboard.theme = "light"
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_dashboard
        
        result = await dashboard_service.get_personal_dashboard(user_id)
        
        assert result is not None
        assert result.user_id == user_id
        assert result.theme == "light"
    
    @pytest.mark.asyncio
    async def test_get_personal_dashboard_not_found(self, dashboard_service, mock_session):
        """Тест получения несуществующего личного кабинета"""
        user_id = 999
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        
        result = await dashboard_service.get_personal_dashboard(user_id)
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_update_dashboard_layout_success(self, dashboard_service, mock_session):
        """Тест успешного обновления макета дашборда"""
        user_id = 1
        layout_data = {
            "theme": "dark",
            "show_sidebar": False,
            "show_header": True,
            "layout_config": {"columns": 16, "rows": 10}
        }
        
        # Мокаем результат
        mock_dashboard = MagicMock()
        mock_dashboard.user_id = user_id
        mock_dashboard.theme = layout_data["theme"]
        mock_dashboard.show_sidebar = layout_data["show_sidebar"]
        mock_dashboard.show_header = layout_data["show_header"]
        mock_dashboard.layout_config = layout_data["layout_config"]
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_dashboard
        
        result = await dashboard_service.update_dashboard_layout(user_id, layout_data)
        
        assert result is not None
        assert result.theme == layout_data["theme"]
        assert result.show_sidebar == layout_data["show_sidebar"]
        assert result.show_header == layout_data["show_header"]
        assert result.layout_config == layout_data["layout_config"]
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_quick_action_success(self, dashboard_service, mock_session):
        """Тест успешного создания быстрого действия"""
        user_id = 1
        action_data = {
            "name": "Create Task",
            "description": "Quickly create a new task",
            "action_type": "create_task",
            "icon": "plus",
            "shortcut": "Ctrl+T",
            "action_config": {"default_priority": "high"}
        }
        
        # Мокаем результат
        mock_action = MagicMock()
        mock_action.user_id = user_id
        mock_action.name = action_data["name"]
        mock_action.action_type = action_data["action_type"]
        mock_session.execute.return_value.scalar_one.return_value = mock_action
        
        result = await dashboard_service.create_quick_action(user_id, action_data)
        
        assert result is not None
        assert result.user_id == user_id
        assert result.name == action_data["name"]
        assert result.action_type == action_data["action_type"]
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_user_quick_actions_success(self, dashboard_service, mock_session):
        """Тест успешного получения быстрых действий пользователя"""
        user_id = 1
        
        # Мокаем быстрые действия
        mock_actions = [
            MagicMock(name="Create Task", shortcut="Ctrl+T"),
            MagicMock(name="Send Message", shortcut="Ctrl+M")
        ]
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_actions
        
        result = await dashboard_service.get_user_quick_actions(user_id)
        
        assert len(result) == 2
        assert result[0].name == "Create Task"
        assert result[1].name == "Send Message"
    
    @pytest.mark.asyncio
    async def test_update_user_preferences_success(self, dashboard_service, mock_session):
        """Тест успешного обновления пользовательских предпочтений"""
        user_id = 1
        preferences_data = {
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
        
        # Мокаем результат
        mock_preferences = MagicMock()
        mock_preferences.user_id = user_id
        mock_preferences.ui_theme = preferences_data["ui_theme"]
        mock_preferences.ui_density = preferences_data["ui_density"]
        mock_preferences.ui_animations = preferences_data["ui_animations"]
        mock_preferences.ui_sounds = preferences_data["ui_sounds"]
        mock_preferences.dashboard_layout = preferences_data["dashboard_layout"]
        mock_preferences.dashboard_columns = preferences_data["dashboard_columns"]
        mock_preferences.dashboard_auto_refresh = preferences_data["dashboard_auto_refresh"]
        mock_preferences.dashboard_refresh_interval = preferences_data["dashboard_refresh_interval"]
        mock_preferences.notification_email = preferences_data["notification_email"]
        mock_preferences.notification_push = preferences_data["notification_push"]
        mock_preferences.notification_sound = preferences_data["notification_sound"]
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_preferences
        
        result = await dashboard_service.update_user_preferences(user_id, preferences_data)
        
        assert result is not None
        assert result.user_id == user_id
        assert result.ui_theme == "dark"
        assert result.ui_density == "compact"
        assert result.ui_animations is True
        assert result.ui_sounds is False
        assert result.dashboard_layout == "grid"
        assert result.dashboard_columns == 16
        assert result.dashboard_auto_refresh is True
        assert result.dashboard_refresh_interval == 600
        assert result.notification_email is True
        assert result.notification_push is False
        assert result.notification_sound is True
    
    @pytest.mark.asyncio
    async def test_initialize_user_dashboard_success(self, dashboard_service, mock_session):
        """Тест успешной инициализации личного кабинета пользователя"""
        user_id = 1
        
        # Мокаем отсутствие существующего дашборда
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        
        # Мокаем созданный дашборд
        mock_dashboard = MagicMock()
        mock_dashboard.user_id = user_id
        mock_dashboard.theme = "default"
        
        # Мокаем созданные виджеты
        mock_widgets = [
            MagicMock(name="Mini Mail", widget_type=WidgetType.MINI_MAIL),
            MagicMock(name="To-Do List", widget_type=WidgetType.TODO_LIST)
        ]
        
        # Мокаем созданные быстрые действия
        mock_actions = [
            MagicMock(name="Create Task", action_type="create_task")
        ]
        
        # Настраиваем моки для разных вызовов
        def mock_scalar_one_or_none():
            return None  # Для проверки существования дашборда
        
        def mock_scalar_one():
            return mock_dashboard  # Для создания дашборда
        
        mock_session.execute.return_value.scalar_one_or_none.side_effect = mock_scalar_one_or_none
        mock_session.execute.return_value.scalar_one.side_effect = mock_scalar_one
        
        result = await dashboard_service.initialize_user_dashboard(user_id)
        
        assert result is not None
        assert result["dashboard"].user_id == user_id
        assert len(result["widgets"]) >= 2  # Минимум 2 виджета по умолчанию
        assert len(result["quick_actions"]) >= 1  # Минимум 1 быстрое действие
        mock_session.commit.assert_called()

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

class TestPersonalDashboardIntegration:
    """Интеграционные тесты личного кабинета"""
    
    @pytest.fixture
    def mock_user(self):
        """Фикстура мок пользователя"""
        return MagicMock(id=1, email="test@example.com", role="employee")
    
    @pytest.fixture
    def mock_session(self):
        """Фикстура мок сессии БД"""
        return AsyncMock()
    
    @pytest.mark.asyncio
    async def test_dashboard_creation_with_widgets(self, mock_session, mock_user):
        """Тест создания дашборда с виджетами"""
        dashboard_service = PersonalDashboardService(mock_session)
        widget_service = WidgetService(mock_session)
        
        # Создаем дашборд
        dashboard_data = {
            "theme": "dark",
            "show_sidebar": True,
            "show_header": True,
            "layout_config": {"columns": 12, "rows": 8}
        }
        
        # Мокаем созданный дашборд
        mock_dashboard = MagicMock()
        mock_dashboard.id = 1
        mock_dashboard.user_id = mock_user.id
        mock_dashboard.theme = dashboard_data["theme"]
        mock_session.execute.return_value.scalar_one.return_value = mock_dashboard
        
        dashboard = await dashboard_service.create_personal_dashboard(
            mock_user.id, dashboard_data
        )
        
        # Создаем виджет
        widget_data = {
            "name": "Test Widget",
            "widget_type": WidgetType.CHART,
            "category": WidgetCategory.DASHBOARD,
            "position_x": 0,
            "position_y": 0,
            "width": 6,
            "height": 4,
            "config": {"chart_type": "bar"}
        }
        
        # Мокаем созданный виджет
        mock_widget = MagicMock()
        mock_widget.id = 1
        mock_widget.dashboard_id = dashboard.id
        mock_widget.name = widget_data["name"]
        mock_widget.widget_type = widget_data["widget_type"]
        mock_session.execute.return_value.scalar_one.return_value = mock_widget
        
        widget = await widget_service.create_widget(
            dashboard.id, widget_data
        )
        
        # Проверяем результаты
        assert dashboard is not None
        assert dashboard.user_id == mock_user.id
        assert dashboard.theme == dashboard_data["theme"]
        
        assert widget is not None
        assert widget.dashboard_id == dashboard.id
        assert widget.name == widget_data["name"]
        assert widget.widget_type == widget_data["widget_type"]
    
    @pytest.mark.asyncio
    async def test_widget_data_retrieval(self, mock_session):
        """Тест получения данных виджета"""
        widget_service = WidgetService(mock_session)
        
        # Мокаем виджет с данными
        mock_widget = MagicMock()
        mock_widget.id = 1
        mock_widget.config = {
            "chart_type": "bar",
            "data_source": "sales",
            "refresh_interval": 300
        }
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_widget
        
        # Получаем данные виджета
        result = await widget_service.get_widget_data(mock_widget.id)
        
        assert result is not None
        assert "widget" in result
        assert "data" in result
        assert result["widget"].id == mock_widget.id
        assert result["data"]["chart_type"] == "bar"
        assert result["data"]["data_source"] == "sales"
        assert result["data"]["refresh_interval"] == 300
    
    @pytest.mark.asyncio
    async def test_quick_actions_workflow(self, mock_session, mock_user):
        """Тест рабочего процесса быстрых действий"""
        dashboard_service = PersonalDashboardService(mock_session)
        
        # Создаем быстрое действие
        action_data = {
            "name": "Create Task",
            "description": "Quickly create a new task",
            "action_type": "create_task",
            "icon": "plus",
            "shortcut": "Ctrl+T",
            "action_config": {"default_priority": "high", "default_assignee": "self"}
        }
        
        # Мокаем созданное действие
        mock_action = MagicMock()
        mock_action.id = 1
        mock_action.user_id = mock_user.id
        mock_action.name = action_data["name"]
        mock_action.action_type = action_data["action_type"]
        mock_action.config = action_data["action_config"]
        mock_session.execute.return_value.scalar_one.return_value = mock_action
        
        action = await dashboard_service.create_quick_action(
            mock_user.id, action_data
        )
        
        # Получаем все быстрые действия пользователя
        mock_actions = [mock_action]
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_actions
        
        actions = await dashboard_service.get_user_quick_actions(
            mock_user.id
        )
        
        # Проверяем результаты
        assert action is not None
        assert action.user_id == mock_user.id
        assert action.name == action_data["name"]
        assert action.action_type == action_data["action_type"]
        assert action.config["default_priority"] == "high"
        
        assert len(actions) == 1
        assert actions[0].id == action.id
    
    @pytest.mark.asyncio
    async def test_user_preferences_workflow(self, mock_session, mock_user):
        """Тест рабочего процесса пользовательских предпочтений"""
        dashboard_service = PersonalDashboardService(mock_session)
        
        # Обновляем предпочтения
        preferences_data = {
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
        
        # Мокаем обновленные предпочтения
        mock_preferences = MagicMock()
        mock_preferences.user_id = mock_user.id
        mock_preferences.ui_theme = preferences_data["ui_theme"]
        mock_preferences.ui_density = preferences_data["ui_density"]
        mock_preferences.ui_animations = preferences_data["ui_animations"]
        mock_preferences.ui_sounds = preferences_data["ui_sounds"]
        mock_preferences.dashboard_layout = preferences_data["dashboard_layout"]
        mock_preferences.dashboard_columns = preferences_data["dashboard_columns"]
        mock_preferences.dashboard_auto_refresh = preferences_data["dashboard_auto_refresh"]
        mock_preferences.dashboard_refresh_interval = preferences_data["dashboard_refresh_interval"]
        mock_preferences.notification_email = preferences_data["notification_email"]
        mock_preferences.notification_push = preferences_data["notification_push"]
        mock_preferences.notification_sound = preferences_data["notification_sound"]
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_preferences
        
        preferences = await dashboard_service.update_user_preferences(
            mock_user.id, preferences_data
        )
        
        # Проверяем результаты
        assert preferences is not None
        assert preferences.user_id == mock_user.id
        assert preferences.ui_theme == "dark"
        assert preferences.ui_density == "compact"
        assert preferences.ui_animations is True
        assert preferences.ui_sounds is False
        assert preferences.dashboard_layout == "grid"
        assert preferences.dashboard_columns == 16
        assert preferences.dashboard_auto_refresh is True
        assert preferences.dashboard_refresh_interval == 600
        assert preferences.notification_email is True
        assert preferences.notification_push is False
        assert preferences.notification_sound is True
