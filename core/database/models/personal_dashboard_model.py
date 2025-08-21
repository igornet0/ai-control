"""
Модели для личного кабинета и расширенной системы виджетов
"""

from typing import Optional, List, Dict, Any, Literal
from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, JSON, Integer, func, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from enum import Enum

from core.database.base import Base


class WidgetCategory(str, Enum):
    """Категории виджетов"""
    SYSTEM = "system"  # Системные виджеты
    PERSONAL = "personal"  # Личные виджеты
    DASHBOARD = "dashboard"  # Виджеты из дашбордов
    CUSTOM = "custom"  # Пользовательские виджеты
    COMMUNICATION = "communication"  # Коммуникационные виджеты


class WidgetType(str, Enum):
    """Типы виджетов"""
    # Системные виджеты
    MINI_MAIL = "mini_mail"  # Мини-почта
    TODO_LIST = "todo_list"  # Список дел
    CALENDAR = "calendar"  # Календарь событий
    NOTIFICATIONS = "notifications"  # Уведомления
    QUICK_ACTIONS = "quick_actions"  # Быстрые действия
    
    # Виджеты из дашбордов
    CHART = "chart"  # График
    TABLE = "table"  # Таблица
    KPI = "kpi"  # KPI индикатор
    METRIC = "metric"  # Метрика
    PROGRESS = "progress"  # Прогресс-бар
    
    # Коммуникационные виджеты
    CHAT = "chat"  # Чат
    MESSAGES = "messages"  # Сообщения
    TEAM_STATUS = "team_status"  # Статус команды
    
    # Пользовательские виджеты
    CUSTOM_HTML = "custom_html"  # Пользовательский HTML
    EMBEDDED = "embedded"  # Встроенный контент
    API_DATA = "api_data"  # Данные из API


class PersonalDashboard(Base):
    """Модель личного кабинета пользователя"""
    __tablename__ = "personal_dashboards"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    
    # Конфигурация личного кабинета
    layout_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Конфигурация сетки
    theme: Mapped[str] = mapped_column(String(50), default="default")  # Тема оформления
    sidebar_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Конфигурация боковой панели
    header_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Конфигурация заголовка
    
    # Настройки отображения
    show_sidebar: Mapped[bool] = mapped_column(Boolean, default=True)
    show_header: Mapped[bool] = mapped_column(Boolean, default=True)
    show_footer: Mapped[bool] = mapped_column(Boolean, default=True)
    compact_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    user: Mapped["User"] = relationship("User", back_populates="personal_dashboard")
    widgets: Mapped[List["PersonalWidget"]] = relationship("PersonalWidget", back_populates="dashboard", cascade="all, delete-orphan")
    settings: Mapped["PersonalDashboardSettings"] = relationship("PersonalDashboardSettings", back_populates="dashboard", uselist=False, cascade="all, delete-orphan")


class PersonalWidget(Base):
    """Модель виджета в личном кабинете"""
    __tablename__ = "personal_widgets"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("personal_dashboards.id"), nullable=False)
    widget_template_id: Mapped[Optional[int]] = mapped_column(ForeignKey("widget_templates.id"), nullable=True)
    
    # Основная информация
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    widget_type: Mapped[WidgetType] = mapped_column(String(50), nullable=False)
    category: Mapped[WidgetCategory] = mapped_column(String(50), nullable=False)
    
    # Позиционирование и размеры
    position_x: Mapped[int] = mapped_column(Integer, default=0)
    position_y: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=6)  # В единицах сетки (12-колоночная)
    height: Mapped[int] = mapped_column(Integer, default=4)  # В единицах сетки
    z_index: Mapped[int] = mapped_column(Integer, default=0)  # Слой виджета
    
    # Конфигурация виджета
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Пользовательская конфигурация
    data_source: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Источник данных
    refresh_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Настройки обновления
    
    # Состояние виджета
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_minimized: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_resizable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_draggable: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Обновление данных
    refresh_interval: Mapped[int] = mapped_column(Integer, default=0)  # Интервал обновления в секундах
    last_refresh: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_data_update: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Кэширование
    cache_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    cache_ttl: Mapped[int] = mapped_column(Integer, default=300)  # Время жизни кэша в секундах
    cached_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    dashboard: Mapped["PersonalDashboard"] = relationship("PersonalDashboard", back_populates="widgets")
    template: Mapped[Optional["WidgetTemplate"]] = relationship("WidgetTemplate")
    permissions: Mapped[List["WidgetPermission"]] = relationship("WidgetPermission", back_populates="widget", cascade="all, delete-orphan")


class PersonalDashboardSettings(Base):
    """Модель настроек личного кабинета"""
    __tablename__ = "personal_dashboard_settings"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("personal_dashboards.id"), nullable=False, unique=True)
    
    # Общие настройки
    language: Mapped[str] = mapped_column(String(10), default="ru")
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Moscow")
    date_format: Mapped[str] = mapped_column(String(20), default="DD.MM.YYYY")
    time_format: Mapped[str] = mapped_column(String(10), default="24")
    
    # Настройки уведомлений
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    push_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_sound: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_frequency: Mapped[str] = mapped_column(String(20), default="immediate")  # immediate, hourly, daily
    
    # Настройки приватности
    profile_visibility: Mapped[str] = mapped_column(String(20), default="team")  # public, team, private
    activity_visibility: Mapped[str] = mapped_column(String(20), default="team")  # public, team, private
    status_visibility: Mapped[str] = mapped_column(String(20), default="team")  # public, team, private
    
    # Настройки интерфейса
    auto_refresh: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_save: Mapped[bool] = mapped_column(Boolean, default=True)
    show_help_tooltips: Mapped[bool] = mapped_column(Boolean, default=True)
    show_animations: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Настройки производительности
    max_widgets: Mapped[int] = mapped_column(Integer, default=20)
    max_data_points: Mapped[int] = mapped_column(Integer, default=1000)
    enable_analytics: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    dashboard: Mapped["PersonalDashboard"] = relationship("PersonalDashboard", back_populates="settings")


class WidgetPermission(Base):
    """Модель разрешений для виджетов"""
    __tablename__ = "widget_permissions"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    widget_id: Mapped[int] = mapped_column(ForeignKey("personal_widgets.id"), nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # admin, CEO, manager, employee
    
    # Разрешения
    can_view: Mapped[bool] = mapped_column(Boolean, default=True)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)
    can_share: Mapped[bool] = mapped_column(Boolean, default=False)
    can_configure: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    widget: Mapped["PersonalWidget"] = relationship("PersonalWidget", back_populates="permissions")
    user: Mapped[Optional["User"]] = relationship("User")


class WidgetPlugin(Base):
    """Модель плагина виджета"""
    __tablename__ = "widget_plugins"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Основная информация
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(20), nullable=False, default="1.0.0")
    
    # Тип и категория
    widget_type: Mapped[WidgetType] = mapped_column(String(50), nullable=False)
    category: Mapped[WidgetCategory] = mapped_column(String(50), nullable=False)
    
    # Файлы плагина
    plugin_path: Mapped[str] = mapped_column(String(500), nullable=False)  # Путь к файлам плагина
    entry_point: Mapped[str] = mapped_column(String(255), nullable=False)  # Точка входа
    assets_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Путь к ресурсам
    
    # Конфигурация
    default_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    config_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # JSON Schema для конфигурации
    dependencies: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)  # Зависимости плагина
    
    # Метаданные
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    author_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    license: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Состояние
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)  # Системный плагин
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)  # Проверенный плагин
    
    # Статистика
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class WidgetInstallation(Base):
    """Модель установки виджета пользователем"""
    __tablename__ = "widget_installations"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    plugin_id: Mapped[int] = mapped_column(ForeignKey("widget_plugins.id"), nullable=False)
    
    # Настройки установки
    custom_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_update: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Статистика использования
    last_used: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Оценка пользователя (1-5)
    
    # Метаданные
    installed_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    user: Mapped["User"] = relationship("User")
    plugin: Mapped["WidgetPlugin"] = relationship("WidgetPlugin")


class QuickAction(Base):
    """Модель быстрых действий в личном кабинете"""
    __tablename__ = "quick_actions"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Основная информация
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Действие
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # url, api_call, function, etc.
    action_config: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)  # Конфигурация действия
    
    # Позиционирование
    position: Mapped[int] = mapped_column(Integer, default=0)  # Порядок в списке
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Статистика
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    user: Mapped["User"] = relationship("User")


class UserPreference(Base):
    """Модель пользовательских предпочтений"""
    __tablename__ = "user_preferences"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    
    # Настройки интерфейса
    ui_theme: Mapped[str] = mapped_column(String(50), default="light")
    ui_density: Mapped[str] = mapped_column(String(20), default="normal")  # compact, normal, spacious
    ui_animations: Mapped[bool] = mapped_column(Boolean, default=True)
    ui_sounds: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Настройки дашборда
    dashboard_layout: Mapped[str] = mapped_column(String(20), default="grid")  # grid, list, masonry
    dashboard_columns: Mapped[int] = mapped_column(Integer, default=12)
    dashboard_auto_refresh: Mapped[bool] = mapped_column(Boolean, default=True)
    dashboard_refresh_interval: Mapped[int] = mapped_column(Integer, default=300)  # секунды
    
    # Настройки уведомлений
    notification_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_push: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_sound: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_frequency: Mapped[str] = mapped_column(String(20), default="immediate")
    
    # Настройки приватности
    profile_visibility: Mapped[str] = mapped_column(String(20), default="team")
    activity_visibility: Mapped[str] = mapped_column(String(20), default="team")
    status_visibility: Mapped[str] = mapped_column(String(20), default="team")
    
    # Настройки производительности
    enable_analytics: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_tracking: Mapped[bool] = mapped_column(Boolean, default=True)
    cache_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    cache_ttl: Mapped[int] = mapped_column(Integer, default=300)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    user: Mapped["User"] = relationship("User")
