"""
Сервис для управления виджетами и личным кабинетом
"""

import uuid
import json
import os
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload, joinedload
import logging
import importlib.util
from pathlib import Path

from core.database.models.personal_dashboard_model import (
    PersonalDashboard, PersonalWidget, PersonalDashboardSettings, WidgetPermission,
    WidgetPlugin, WidgetInstallation, QuickAction, UserPreference,
    WidgetCategory, WidgetType
)
from core.database.models.main_models import User

logger = logging.getLogger(__name__)


class WidgetPluginManager:
    """Менеджер плагинов виджетов"""
    
    def __init__(self, plugins_directory: str = "plugins/widgets"):
        self.plugins_directory = Path(plugins_directory)
        self.plugins_directory.mkdir(parents=True, exist_ok=True)
        self.loaded_plugins: Dict[str, Any] = {}
    
    async def load_plugin(self, plugin_path: str) -> Optional[Dict[str, Any]]:
        """Загрузка плагина из файла"""
        try:
            plugin_file = Path(plugin_path)
            if not plugin_file.exists():
                logger.error(f"Plugin file not found: {plugin_path}")
                return None
            
            # Загружаем модуль плагина
            spec = importlib.util.spec_from_file_location("widget_plugin", plugin_file)
            if spec is None or spec.loader is None:
                logger.error(f"Could not load plugin spec: {plugin_path}")
                return None
            
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Проверяем наличие необходимых атрибутов
            if not hasattr(module, 'PLUGIN_INFO'):
                logger.error(f"Plugin missing PLUGIN_INFO: {plugin_path}")
                return None
            
            plugin_info = module.PLUGIN_INFO
            plugin_info['module'] = module
            plugin_info['path'] = plugin_path
            
            self.loaded_plugins[plugin_info['name']] = plugin_info
            logger.info(f"Loaded plugin: {plugin_info['name']}")
            
            return plugin_info
            
        except Exception as e:
            logger.error(f"Error loading plugin {plugin_path}: {str(e)}")
            return None
    
    async def get_plugin(self, plugin_name: str) -> Optional[Dict[str, Any]]:
        """Получение загруженного плагина"""
        return self.loaded_plugins.get(plugin_name)
    
    async def list_plugins(self) -> List[Dict[str, Any]]:
        """Список всех загруженных плагинов"""
        return list(self.loaded_plugins.values())
    
    async def execute_plugin_method(self, plugin_name: str, method_name: str, *args, **kwargs) -> Any:
        """Выполнение метода плагина"""
        plugin = await self.get_plugin(plugin_name)
        if not plugin:
            raise ValueError(f"Plugin not found: {plugin_name}")
        
        module = plugin['module']
        if not hasattr(module, method_name):
            raise ValueError(f"Method {method_name} not found in plugin {plugin_name}")
        
        method = getattr(module, method_name)
        return method(*args, **kwargs)


class WidgetService:
    """Сервис для работы с виджетами"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.plugin_manager = WidgetPluginManager()
    
    async def create_personal_dashboard(self, user_id: int) -> PersonalDashboard:
        """Создание личного кабинета для пользователя"""
        
        # Проверяем, существует ли уже личный кабинет
        existing_dashboard = await self.session.execute(
            select(PersonalDashboard).where(PersonalDashboard.user_id == user_id)
        )
        if existing_dashboard.scalar_one_or_none():
            raise ValueError("Personal dashboard already exists for this user")
        
        # Создаем личный кабинет
        dashboard = PersonalDashboard(
            user_id=user_id,
            layout_config={
                "grid": {
                    "columns": 12,
                    "rows": 20,
                    "cellSize": {"width": 100, "height": 100}
                }
            },
            theme="default",
            sidebar_config={"visible": True, "width": 250},
            header_config={"visible": True, "height": 60}
        )
        
        self.session.add(dashboard)
        await self.session.flush()
        
        # Создаем настройки по умолчанию
        settings = PersonalDashboardSettings(
            dashboard_id=dashboard.id,
            language="ru",
            timezone="Europe/Moscow",
            date_format="DD.MM.YYYY",
            time_format="24"
        )
        
        self.session.add(settings)
        await self.session.commit()
        
        return dashboard
    
    async def get_personal_dashboard(self, user_id: int) -> Optional[PersonalDashboard]:
        """Получение личного кабинета пользователя"""
        result = await self.session.execute(
            select(PersonalDashboard)
            .options(
                selectinload(PersonalDashboard.widgets),
                selectinload(PersonalDashboard.settings)
            )
            .where(PersonalDashboard.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def create_widget(
        self,
        dashboard_id: int,
        name: str,
        widget_type: WidgetType,
        category: WidgetCategory,
        config: Optional[Dict[str, Any]] = None,
        position_x: int = 0,
        position_y: int = 0,
        width: int = 6,
        height: int = 4
    ) -> PersonalWidget:
        """Создание виджета в личном кабинете"""
        
        widget = PersonalWidget(
            dashboard_id=dashboard_id,
            name=name,
            widget_type=widget_type,
            category=category,
            config=config or {},
            position_x=position_x,
            position_y=position_y,
            width=width,
            height=height,
            data_source={},
            refresh_config={"enabled": False, "interval": 0}
        )
        
        self.session.add(widget)
        await self.session.commit()
        
        return widget
    
    async def update_widget_position(
        self,
        widget_id: int,
        position_x: int,
        position_y: int,
        width: Optional[int] = None,
        height: Optional[int] = None
    ) -> PersonalWidget:
        """Обновление позиции и размеров виджета"""
        
        result = await self.session.execute(
            select(PersonalWidget).where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise ValueError(f"Widget not found: {widget_id}")
        
        widget.position_x = position_x
        widget.position_y = position_y
        if width is not None:
            widget.width = width
        if height is not None:
            widget.height = height
        widget.updated_at = datetime.now()
        
        await self.session.commit()
        return widget
    
    async def update_widget_config(self, widget_id: int, config: Dict[str, Any]) -> PersonalWidget:
        """Обновление конфигурации виджета"""
        
        result = await self.session.execute(
            select(PersonalWidget).where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise ValueError(f"Widget not found: {widget_id}")
        
        widget.config = config
        widget.updated_at = datetime.now()
        
        await self.session.commit()
        return widget
    
    async def delete_widget(self, widget_id: int) -> bool:
        """Удаление виджета"""
        
        result = await self.session.execute(
            select(PersonalWidget).where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            return False
        
        await self.session.delete(widget)
        await self.session.commit()
        return True
    
    async def get_widget_data(self, widget_id: int) -> Optional[Dict[str, Any]]:
        """Получение данных виджета"""
        
        result = await self.session.execute(
            select(PersonalWidget).where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            return None
        
        # Проверяем кэш
        if widget.cache_enabled and widget.cached_data:
            cache_age = datetime.now() - widget.last_data_update
            if cache_age.total_seconds() < widget.cache_ttl:
                return widget.cached_data
        
        # Получаем данные в зависимости от типа виджета
        data = await self._fetch_widget_data(widget)
        
        # Обновляем кэш
        if widget.cache_enabled:
            widget.cached_data = data
            widget.last_data_update = datetime.now()
            await self.session.commit()
        
        return data
    
    async def _fetch_widget_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для виджета в зависимости от его типа"""
        
        if widget.widget_type == WidgetType.MINI_MAIL:
            return await self._get_mail_data(widget)
        elif widget.widget_type == WidgetType.TODO_LIST:
            return await self._get_todo_data(widget)
        elif widget.widget_type == WidgetType.CALENDAR:
            return await self._get_calendar_data(widget)
        elif widget.widget_type == WidgetType.NOTIFICATIONS:
            return await self._get_notifications_data(widget)
        elif widget.widget_type == WidgetType.QUICK_ACTIONS:
            return await self._get_quick_actions_data(widget)
        elif widget.widget_type == WidgetType.CHART:
            return await self._get_chart_data(widget)
        elif widget.widget_type == WidgetType.TABLE:
            return await self._get_table_data(widget)
        elif widget.widget_type == WidgetType.KPI:
            return await self._get_kpi_data(widget)
        else:
            return {"error": f"Unknown widget type: {widget.widget_type}"}
    
    async def _get_mail_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для мини-почты"""
        # Здесь будет интеграция с почтовой системой
        return {
            "unread_count": 5,
            "recent_messages": [
                {"id": 1, "subject": "Важное сообщение", "from": "admin@company.com", "date": "2024-01-15"},
                {"id": 2, "subject": "Отчет готов", "from": "reports@company.com", "date": "2024-01-14"}
            ]
        }
    
    async def _get_todo_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для списка дел"""
        # Здесь будет интеграция с системой задач
        return {
            "total_tasks": 12,
            "completed_tasks": 8,
            "pending_tasks": 4,
            "tasks": [
                {"id": 1, "title": "Подготовить отчет", "completed": True},
                {"id": 2, "title": "Встреча с клиентом", "completed": False},
                {"id": 3, "title": "Обновить документацию", "completed": False}
            ]
        }
    
    async def _get_calendar_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для календаря"""
        return {
            "today_events": [
                {"id": 1, "title": "Встреча команды", "time": "10:00", "duration": 60},
                {"id": 2, "title": "Презентация", "time": "14:00", "duration": 90}
            ],
            "upcoming_events": [
                {"id": 3, "title": "Дедлайн проекта", "date": "2024-01-20"},
                {"id": 4, "title": "Совещание", "date": "2024-01-22"}
            ]
        }
    
    async def _get_notifications_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для уведомлений"""
        return {
            "unread_count": 3,
            "notifications": [
                {"id": 1, "type": "info", "message": "Новая задача назначена", "time": "2 минуты назад"},
                {"id": 2, "type": "warning", "message": "Дедлайн приближается", "time": "1 час назад"},
                {"id": 3, "type": "success", "message": "Отчет сохранен", "time": "3 часа назад"}
            ]
        }
    
    async def _get_quick_actions_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для быстрых действий"""
        return {
            "actions": [
                {"id": 1, "name": "Создать задачу", "icon": "plus", "action": "create_task"},
                {"id": 2, "name": "Отправить сообщение", "icon": "message", "action": "send_message"},
                {"id": 3, "name": "Создать отчет", "icon": "chart", "action": "create_report"}
            ]
        }
    
    async def _get_chart_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для графика"""
        config = widget.config or {}
        chart_type = config.get("chart_type", "line")
        
        return {
            "type": chart_type,
            "data": {
                "labels": ["Янв", "Фев", "Мар", "Апр", "Май"],
                "datasets": [{
                    "label": "Продажи",
                    "data": [12, 19, 3, 5, 2]
                }]
            }
        }
    
    async def _get_table_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для таблицы"""
        return {
            "columns": ["ID", "Название", "Статус", "Дата"],
            "data": [
                [1, "Проект А", "В работе", "2024-01-15"],
                [2, "Проект Б", "Завершен", "2024-01-10"],
                [3, "Проект В", "Планируется", "2024-01-20"]
            ]
        }
    
    async def _get_kpi_data(self, widget: PersonalWidget) -> Dict[str, Any]:
        """Получение данных для KPI"""
        return {
            "value": 85,
            "target": 100,
            "unit": "%",
            "trend": "up",
            "change": "+5%",
            "period": "месяц"
        }
    
    async def create_quick_action(
        self,
        user_id: int,
        name: str,
        action_type: str,
        action_config: Dict[str, Any],
        description: Optional[str] = None,
        icon: Optional[str] = None
    ) -> QuickAction:
        """Создание быстрого действия"""
        
        action = QuickAction(
            user_id=user_id,
            name=name,
            description=description,
            icon=icon,
            action_type=action_type,
            action_config=action_config
        )
        
        self.session.add(action)
        await self.session.commit()
        
        return action
    
    async def get_user_quick_actions(self, user_id: int) -> List[QuickAction]:
        """Получение быстрых действий пользователя"""
        result = await self.session.execute(
            select(QuickAction)
            .where(QuickAction.user_id == user_id)
            .order_by(QuickAction.position, QuickAction.created_at)
        )
        return result.scalars().all()
    
    async def update_user_preferences(
        self,
        user_id: int,
        preferences: Dict[str, Any]
    ) -> UserPreference:
        """Обновление пользовательских предпочтений"""
        
        result = await self.session.execute(
            select(UserPreference).where(UserPreference.user_id == user_id)
        )
        user_pref = result.scalar_one_or_none()
        
        if not user_pref:
            # Создаем новые предпочтения
            user_pref = UserPreference(user_id=user_id)
            self.session.add(user_pref)
        
        # Обновляем предпочтения
        for key, value in preferences.items():
            if hasattr(user_pref, key):
                setattr(user_pref, key, value)
        
        user_pref.updated_at = datetime.now()
        await self.session.commit()
        
        return user_pref
    
    async def get_user_preferences(self, user_id: int) -> Optional[UserPreference]:
        """Получение пользовательских предпочтений"""
        result = await self.session.execute(
            select(UserPreference).where(UserPreference.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def install_widget_plugin(
        self,
        user_id: int,
        plugin_id: int,
        custom_config: Optional[Dict[str, Any]] = None
    ) -> WidgetInstallation:
        """Установка плагина виджета пользователем"""
        
        # Проверяем, не установлен ли уже плагин
        existing = await self.session.execute(
            select(WidgetInstallation)
            .where(
                and_(
                    WidgetInstallation.user_id == user_id,
                    WidgetInstallation.plugin_id == plugin_id
                )
            )
        )
        
        if existing.scalar_one_or_none():
            raise ValueError("Plugin already installed")
        
        # Создаем установку
        installation = WidgetInstallation(
            user_id=user_id,
            plugin_id=plugin_id,
            custom_config=custom_config or {}
        )
        
        self.session.add(installation)
        
        # Увеличиваем счетчик установок
        plugin_result = await self.session.execute(
            select(WidgetPlugin).where(WidgetPlugin.id == plugin_id)
        )
        plugin = plugin_result.scalar_one_or_none()
        if plugin:
            plugin.install_count += 1
        
        await self.session.commit()
        return installation
    
    async def get_available_plugins(self, user_id: int) -> List[Dict[str, Any]]:
        """Получение доступных плагинов для пользователя"""
        
        # Получаем все активные плагины
        result = await self.session.execute(
            select(WidgetPlugin).where(WidgetPlugin.is_active == True)
        )
        plugins = result.scalars().all()
        
        # Получаем установленные плагины пользователя
        installed_result = await self.session.execute(
            select(WidgetInstallation.plugin_id).where(WidgetInstallation.user_id == user_id)
        )
        installed_ids = {row[0] for row in installed_result.fetchall()}
        
        # Формируем список доступных плагинов
        available_plugins = []
        for plugin in plugins:
            plugin_data = {
                "id": plugin.id,
                "name": plugin.name,
                "display_name": plugin.display_name,
                "description": plugin.description,
                "version": plugin.version,
                "widget_type": plugin.widget_type,
                "category": plugin.category,
                "author": plugin.author,
                "rating": plugin.rating,
                "install_count": plugin.install_count,
                "is_installed": plugin.id in installed_ids
            }
            available_plugins.append(plugin_data)
        
        return available_plugins


class PersonalDashboardService:
    """Сервис для работы с личным кабинетом"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.widget_service = WidgetService(session)
    
    async def initialize_user_dashboard(self, user_id: int) -> PersonalDashboard:
        """Инициализация личного кабинета пользователя"""
        
        # Создаем личный кабинет
        dashboard = await self.widget_service.create_personal_dashboard(user_id)
        
        # Создаем базовые виджеты
        await self._create_default_widgets(dashboard.id)
        
        # Создаем базовые быстрые действия
        await self._create_default_quick_actions(user_id)
        
        return dashboard
    
    async def _create_default_widgets(self, dashboard_id: int):
        """Создание виджетов по умолчанию"""
        
        default_widgets = [
            {
                "name": "Уведомления",
                "widget_type": WidgetType.NOTIFICATIONS,
                "category": WidgetCategory.SYSTEM,
                "position_x": 0,
                "position_y": 0,
                "width": 4,
                "height": 3
            },
            {
                "name": "Быстрые действия",
                "widget_type": WidgetType.QUICK_ACTIONS,
                "category": WidgetCategory.SYSTEM,
                "position_x": 4,
                "position_y": 0,
                "width": 4,
                "height": 3
            },
            {
                "name": "Мои задачи",
                "widget_type": WidgetType.TODO_LIST,
                "category": WidgetCategory.PERSONAL,
                "position_x": 8,
                "position_y": 0,
                "width": 4,
                "height": 3
            },
            {
                "name": "Календарь",
                "widget_type": WidgetType.CALENDAR,
                "category": WidgetCategory.PERSONAL,
                "position_x": 0,
                "position_y": 3,
                "width": 6,
                "height": 4
            },
            {
                "name": "Мини-почта",
                "widget_type": WidgetType.MINI_MAIL,
                "category": WidgetCategory.COMMUNICATION,
                "position_x": 6,
                "position_y": 3,
                "width": 6,
                "height": 4
            }
        ]
        
        for widget_config in default_widgets:
            await self.widget_service.create_widget(
                dashboard_id=dashboard_id,
                **widget_config
            )
    
    async def _create_default_quick_actions(self, user_id: int):
        """Создание быстрых действий по умолчанию"""
        
        default_actions = [
            {
                "name": "Создать задачу",
                "action_type": "url",
                "action_config": {"url": "/tasks/create"},
                "icon": "plus-circle"
            },
            {
                "name": "Отправить сообщение",
                "action_type": "url",
                "action_config": {"url": "/messages/compose"},
                "icon": "message-circle"
            },
            {
                "name": "Создать отчет",
                "action_type": "url",
                "action_config": {"url": "/reports/create"},
                "icon": "bar-chart"
            }
        ]
        
        for action_config in default_actions:
            await self.widget_service.create_quick_action(
                user_id=user_id,
                **action_config
            )
    
    async def get_dashboard_layout(self, user_id: int) -> Dict[str, Any]:
        """Получение макета личного кабинета"""
        
        dashboard = await self.widget_service.get_personal_dashboard(user_id)
        if not dashboard:
            dashboard = await self.initialize_user_dashboard(user_id)
        
        # Получаем виджеты с данными
        widgets_data = []
        for widget in dashboard.widgets:
            if widget.is_visible:
                widget_data = {
                    "id": widget.id,
                    "name": widget.name,
                    "type": widget.widget_type,
                    "category": widget.category,
                    "position": {
                        "x": widget.position_x,
                        "y": widget.position_y,
                        "width": widget.width,
                        "height": widget.height
                    },
                    "config": widget.config,
                    "is_minimized": widget.is_minimized,
                    "is_pinned": widget.is_pinned
                }
                
                # Получаем данные виджета
                try:
                    widget_data["data"] = await self.widget_service.get_widget_data(widget.id)
                except Exception as e:
                    logger.error(f"Error getting widget data: {e}")
                    widget_data["data"] = {"error": "Failed to load data"}
                
                widgets_data.append(widget_data)
        
        # Получаем быстрые действия
        quick_actions = await self.widget_service.get_user_quick_actions(user_id)
        actions_data = [
            {
                "id": action.id,
                "name": action.name,
                "description": action.description,
                "icon": action.icon,
                "action_type": action.action_type,
                "action_config": action.action_config,
                "is_pinned": action.is_pinned
            }
            for action in quick_actions if action.is_visible
        ]
        
        # Получаем настройки пользователя
        preferences = await self.widget_service.get_user_preferences(user_id)
        
        return {
            "dashboard": {
                "id": dashboard.id,
                "theme": dashboard.theme,
                "layout_config": dashboard.layout_config,
                "sidebar_config": dashboard.sidebar_config,
                "header_config": dashboard.header_config,
                "show_sidebar": dashboard.show_sidebar,
                "show_header": dashboard.show_header,
                "show_footer": dashboard.show_footer,
                "compact_mode": dashboard.compact_mode
            },
            "widgets": widgets_data,
            "quick_actions": actions_data,
            "preferences": {
                "ui_theme": preferences.ui_theme if preferences else "light",
                "ui_density": preferences.ui_density if preferences else "normal",
                "ui_animations": preferences.ui_animations if preferences else True,
                "dashboard_layout": preferences.dashboard_layout if preferences else "grid",
                "dashboard_columns": preferences.dashboard_columns if preferences else 12
            } if preferences else {}
        }
