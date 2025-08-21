"""
Структурные тесты для системы личного кабинета и виджетов
"""
import pytest
import os
import ast
from pathlib import Path

class TestPersonalDashboardStructure:
    """Тесты структуры системы личного кабинета и виджетов"""
    
    def test_personal_dashboard_model_file_exists(self):
        """Тест существования файла моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        assert os.path.exists(model_path), f"Model file not found: {model_path}"
    
    def test_widget_service_file_exists(self):
        """Тест существования файла сервиса виджетов"""
        service_path = "backend/api/services/widget_service.py"
        assert os.path.exists(service_path), f"Service file not found: {service_path}"
    
    def test_personal_dashboard_router_file_exists(self):
        """Тест существования файла роутера личного кабинета"""
        router_path = "backend/api/routers/personal_dashboard/router.py"
        assert os.path.exists(router_path), f"Router file not found: {router_path}"
    
    def test_personal_dashboard_model_structure(self):
        """Тест структуры моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные енумы
        assert 'class WidgetCategory(str, Enum):' in content
        assert 'class WidgetType(str, Enum):' in content
        
        # Проверяем основные модели
        assert 'class PersonalDashboard(Base):' in content
        assert 'class PersonalWidget(Base):' in content
        assert 'class PersonalDashboardSettings(Base):' in content
        assert 'class WidgetPermission(Base):' in content
        assert 'class WidgetPlugin(Base):' in content
        assert 'class WidgetInstallation(Base):' in content
        assert 'class QuickAction(Base):' in content
        assert 'class UserPreference(Base):' in content
    
    def test_widget_service_structure(self):
        """Тест структуры сервиса виджетов"""
        service_path = "backend/api/services/widget_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные классы
        assert 'class WidgetPluginManager:' in content
        assert 'class WidgetService:' in content
        assert 'class PersonalDashboardService:' in content
        
        # Проверяем основные методы
        assert 'async def load_plugin(' in content
        assert 'async def create_personal_dashboard(' in content
        assert 'async def create_widget(' in content
        assert 'async def get_widget_data(' in content
        assert 'async def initialize_user_dashboard(' in content
    
    def test_personal_dashboard_router_structure(self):
        """Тест структуры роутера личного кабинета"""
        router_path = "backend/api/routers/personal_dashboard/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные компоненты
        assert 'router = APIRouter(prefix="/api/personal-dashboard", tags=["personal-dashboard"])' in content
        
        # Проверяем Pydantic модели
        assert 'class WidgetCreateRequest(BaseModel):' in content
        assert 'class WidgetUpdateRequest(BaseModel):' in content
        assert 'class QuickActionCreateRequest(BaseModel):' in content
        assert 'class UserPreferencesUpdateRequest(BaseModel):' in content
        assert 'class DashboardLayoutResponse(BaseModel):' in content
    
    def test_personal_dashboard_endpoints_defined(self):
        """Тест определения эндпоинтов личного кабинета"""
        router_path = "backend/api/routers/personal_dashboard/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных эндпоинтов
        endpoints = [
            '@router.get("/layout", response_model=DashboardLayoutResponse)',
            '@router.put("/layout", response_model=DashboardLayoutResponse)',
            '@router.post("/widgets", response_model=WidgetResponse)',
            '@router.get("/widgets/{widget_id}", response_model=WidgetResponse)',
            '@router.put("/widgets/{widget_id}", response_model=WidgetResponse)',
            '@router.delete("/widgets/{widget_id}")',
            '@router.get("/widgets/{widget_id}/data")',
            '@router.post("/quick-actions", response_model=QuickActionResponse)',
            '@router.get("/quick-actions", response_model=List[QuickActionResponse])',
            '@router.put("/quick-actions/{action_id}", response_model=QuickActionResponse)',
            '@router.delete("/quick-actions/{action_id}")',
            '@router.put("/preferences")',
            '@router.get("/preferences")',
            '@router.get("/widget-types")',
            '@router.post("/initialize")'
        ]
        
        for endpoint in endpoints:
            assert endpoint in content, f"Endpoint not found: {endpoint}"
    
    def test_widget_enums_defined(self):
        """Тест определения енумов виджетов"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения WidgetCategory
        widget_categories = [
            'SYSTEM = "system"',
            'PERSONAL = "personal"',
            'DASHBOARD = "dashboard"',
            'CUSTOM = "custom"',
            'COMMUNICATION = "communication"'
        ]
        
        for category in widget_categories:
            assert category in content, f"Widget category not found: {category}"
        
        # Проверяем значения WidgetType
        widget_types = [
            'MINI_MAIL = "mini_mail"',
            'TODO_LIST = "todo_list"',
            'CALENDAR = "calendar"',
            'NOTIFICATIONS = "notifications"',
            'QUICK_ACTIONS = "quick_actions"',
            'CHART = "chart"',
            'TABLE = "table"',
            'KPI = "kpi"'
        ]
        
        for widget_type in widget_types:
            assert widget_type in content, f"Widget type not found: {widget_type}"
    
    def test_personal_dashboard_models_defined(self):
        """Тест определения моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные модели
        models = [
            'class PersonalDashboard(Base):',
            'class PersonalWidget(Base):',
            'class PersonalDashboardSettings(Base):',
            'class WidgetPermission(Base):',
            'class WidgetPlugin(Base):',
            'class WidgetInstallation(Base):',
            'class QuickAction(Base):',
            'class UserPreference(Base):'
        ]
        
        for model in models:
            assert model in content, f"Model not found: {model}"
    
    def test_personal_dashboard_model_fields(self):
        """Тест полей моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные поля PersonalDashboard
        dashboard_fields = [
            'user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)',
            'layout_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)',
            'theme: Mapped[str] = mapped_column(String(50), default="default")',
            'show_sidebar: Mapped[bool] = mapped_column(Boolean, default=True)',
            'show_header: Mapped[bool] = mapped_column(Boolean, default=True)'
        ]
        
        for field in dashboard_fields:
            assert field in content, f"Dashboard field not found: {field}"
        
        # Проверяем основные поля PersonalWidget
        widget_fields = [
            'dashboard_id: Mapped[int] = mapped_column(ForeignKey("personal_dashboards.id"), nullable=False)',
            'name: Mapped[str] = mapped_column(String(255), nullable=False)',
            'widget_type: Mapped[WidgetType] = mapped_column(String(50), nullable=False)',
            'category: Mapped[WidgetCategory] = mapped_column(String(50), nullable=False)',
            'position_x: Mapped[int] = mapped_column(Integer, default=0)',
            'position_y: Mapped[int] = mapped_column(Integer, default=0)',
            'width: Mapped[int] = mapped_column(Integer, default=6)',
            'height: Mapped[int] = mapped_column(Integer, default=4)'
        ]
        
        for field in widget_fields:
            assert field in content, f"Widget field not found: {field}"
    
    def test_personal_dashboard_relationships(self):
        """Тест связей моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные связи
        relationships = [
            'user: Mapped["User"] = relationship("User", back_populates="personal_dashboard")',
            'widgets: Mapped[List["PersonalWidget"]] = relationship("PersonalWidget", back_populates="dashboard", cascade="all, delete-orphan")',
            'settings: Mapped["PersonalDashboardSettings"] = relationship("PersonalDashboardSettings", back_populates="dashboard", uselist=False, cascade="all, delete-orphan")',
            'dashboard: Mapped["PersonalDashboard"] = relationship("PersonalDashboard", back_populates="widgets")',
            'permissions: Mapped[List["WidgetPermission"]] = relationship("WidgetPermission", back_populates="widget", cascade="all, delete-orphan")'
        ]
        
        for relationship in relationships:
            assert relationship in content, f"Relationship not found: {relationship}"
    
    def test_personal_dashboard_table_names(self):
        """Тест имен таблиц личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем имена таблиц
        table_names = [
            '__tablename__ = "personal_dashboards"',
            '__tablename__ = "personal_widgets"',
            '__tablename__ = "personal_dashboard_settings"',
            '__tablename__ = "widget_permissions"',
            '__tablename__ = "widget_plugins"',
            '__tablename__ = "widget_installations"',
            '__tablename__ = "quick_actions"',
            '__tablename__ = "user_preferences"'
        ]
        
        for table_name in table_names:
            assert table_name in content, f"Table name not found: {table_name}"
    
    def test_personal_dashboard_foreign_keys(self):
        """Тест внешних ключей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем внешние ключи
        foreign_keys = [
            'ForeignKey("users.id")',
            'ForeignKey("personal_dashboards.id")',
            'ForeignKey("personal_widgets.id")',
            'ForeignKey("widget_plugins.id")'
        ]
        
        for foreign_key in foreign_keys:
            assert foreign_key in content, f"Foreign key not found: {foreign_key}"
    
    def test_personal_dashboard_indexes(self):
        """Тест индексов личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем индексы
        indexes = [
            'unique=True',  # Для уникальных полей
            'default=True',  # Для полей с значениями по умолчанию
            'nullable=False',  # Для обязательных полей
            'nullable=True'  # Для необязательных полей
        ]
        
        for index in indexes:
            assert index in content, f"Index/default not found: {index}"
    
    def test_personal_dashboard_imports_correct(self):
        """Тест корректности импортов моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные импорты
        imports = [
            'from typing import Optional, List, Dict, Any, Literal',
            'from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, JSON, Integer, func, Float',
            'from sqlalchemy.orm import Mapped, mapped_column, relationship',
            'from datetime import datetime',
            'from enum import Enum',
            'from core.database.base import Base'
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_widget_service_imports_correct(self):
        """Тест корректности импортов сервиса виджетов"""
        service_path = "backend/api/services/widget_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные импорты
        imports = [
            'from core.database.models.personal_dashboard_model import',
            'from core.database.models.main_models import User',
            'from sqlalchemy.ext.asyncio import AsyncSession',
            'from sqlalchemy import select, func, and_, or_, desc, asc',
            'from sqlalchemy.orm import selectinload, joinedload'
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_personal_dashboard_router_imports_correct(self):
        """Тест корректности импортов роутера личного кабинета"""
        router_path = "backend/api/routers/personal_dashboard/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные импорты
        imports = [
            'from backend.api.configuration.auth import verify_authorization, require_role',
            'from backend.api.configuration.server import Server',
            'from backend.api.services.widget_service import PersonalDashboardService, WidgetService',
            'from core.database.models.personal_dashboard_model import'
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_personal_dashboard_router_syntax_valid(self):
        """Тест валидности синтаксиса роутера личного кабинета"""
        router_path = "backend/api/routers/personal_dashboard/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        try:
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in personal dashboard router: {e}")
    
    def test_personal_dashboard_model_syntax_valid(self):
        """Тест валидности синтаксиса моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        try:
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in personal dashboard model: {e}")
    
    def test_widget_service_syntax_valid(self):
        """Тест валидности синтаксиса сервиса виджетов"""
        service_path = "backend/api/services/widget_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        try:
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in widget service: {e}")
    
    def test_personal_dashboard_directory_structure(self):
        """Тест структуры директорий личного кабинета"""
        
        # Проверяем, что директории существуют
        assert os.path.exists("backend/api/routers/personal_dashboard"), "Personal dashboard router directory not found"
        assert os.path.exists("backend/api/services"), "Services directory not found"
        assert os.path.exists("core/database/models"), "Models directory not found"
        
        # Проверяем файлы
        router_file = "backend/api/routers/personal_dashboard/router.py"
        service_file = "backend/api/services/widget_service.py"
        model_file = "core/database/models/personal_dashboard_model.py"
        
        assert os.path.isfile(router_file), f"Router file not found: {router_file}"
        assert os.path.isfile(service_file), f"Service file not found: {service_file}"
        assert os.path.isfile(model_file), f"Model file not found: {model_file}"
    
    def test_personal_dashboard_files_readable(self):
        """Тест читаемости файлов личного кабинета"""
        
        files_to_check = [
            "backend/api/routers/personal_dashboard/router.py",
            "backend/api/services/widget_service.py",
            "core/database/models/personal_dashboard_model.py"
        ]
        
        for file_path in files_to_check:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    assert len(content) > 0, f"File is empty: {file_path}"
            except Exception as e:
                pytest.fail(f"Cannot read file {file_path}: {e}")
    
    def test_personal_dashboard_router_has_docstrings(self):
        """Тест наличия докстрингов в роутере личного кабинета"""
        router_path = "backend/api/routers/personal_dashboard/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем докстринги для основных функций
        function_docstrings = [
            '"""Получение макета личного кабинета"""',
            '"""Обновление макета личного кабинета"""',
            '"""Создание нового виджета"""',
            '"""Получение виджета по ID"""',
            '"""Обновление виджета"""',
            '"""Удаление виджета"""',
            '"""Получение данных виджета"""',
            '"""Создание быстрого действия"""',
            '"""Получение быстрых действий пользователя"""',
            '"""Обновление быстрого действия"""',
            '"""Удаление быстрого действия"""',
            '"""Обновление пользовательских предпочтений"""',
            '"""Получение пользовательских предпочтений"""',
            '"""Получение доступных типов виджетов"""',
            '"""Инициализация личного кабинета пользователя"""'
        ]
        
        for expected_docstring in function_docstrings:
            # Либо точное совпадение, либо без тройных кавычек
            assert (expected_docstring in content or 
                    expected_docstring.strip('"""') in content), f"Docstring not found: {expected_docstring}"
    
    def test_widget_service_has_docstrings(self):
        """Тест наличия докстрингов в сервисе виджетов"""
        service_path = "backend/api/services/widget_service.py"
        
        with open(service_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем докстринги для основных классов и методов
        docstrings = [
            '"""Менеджер плагинов виджетов"""',
            '"""Сервис для работы с виджетами"""',
            '"""Сервис для работы с личным кабинетом"""',
            '"""Создание личного кабинета для пользователя"""',
            '"""Создание виджета в личном кабинете"""',
            '"""Получение данных виджета"""',
            '"""Инициализация личного кабинета пользователя"""'
        ]
        
        for docstring in docstrings:
            # Либо точное совпадение, либо без тройных кавычек
            assert (docstring in content or 
                    docstring.strip('"""') in content), f"Docstring not found: {docstring}"
    
    def test_personal_dashboard_model_has_docstrings(self):
        """Тест наличия докстрингов в моделях личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем докстринги для основных классов
        docstrings = [
            '"""Категории виджетов"""',
            '"""Типы виджетов"""',
            '"""Модель личного кабинета пользователя"""',
            '"""Модель виджета в личном кабинете"""',
            '"""Модель настроек личного кабинета"""',
            '"""Модель разрешений для виджетов"""',
            '"""Модель плагина виджета"""',
            '"""Модель установки виджета пользователем"""',
            '"""Модель быстрых действий в личном кабинете"""',
            '"""Модель пользовательских предпочтений"""'
        ]
        
        for docstring in docstrings:
            # Либо точное совпадение, либо без тройных кавычек
            assert (docstring in content or 
                    docstring.strip('"""') in content), f"Docstring not found: {docstring}"
    
    def test_personal_dashboard_model_completeness(self):
        """Тест полноты моделей личного кабинета"""
        model_path = "core/database/models/personal_dashboard_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие всех необходимых компонентов
        required_components = [
            'from core.database.base import Base',
            'class WidgetCategory(str, Enum):',
            'class WidgetType(str, Enum):',
            'class PersonalDashboard(Base):',
            'class PersonalWidget(Base):',
            'class PersonalDashboardSettings(Base):',
            'class WidgetPermission(Base):',
            'class WidgetPlugin(Base):',
            'class WidgetInstallation(Base):',
            'class QuickAction(Base):',
            'class UserPreference(Base):',
            '__tablename__ = "personal_dashboards"',
            '__tablename__ = "personal_widgets"',
            '__tablename__ = "personal_dashboard_settings"',
            '__tablename__ = "widget_permissions"',
            '__tablename__ = "widget_plugins"',
            '__tablename__ = "widget_installations"',
            '__tablename__ = "quick_actions"',
            '__tablename__ = "user_preferences"'
        ]
        
        for component in required_components:
            assert component in content, f"Required component not found: {component}"
