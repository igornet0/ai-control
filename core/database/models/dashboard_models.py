"""
Модели для системы дашбордов и виджетов
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from core.database.models.main_models import Base


class Dashboard(Base):
    """Модель дашборда"""
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    layout_config = Column(JSON, nullable=True)  # Конфигурация расположения виджетов
    theme = Column(String(50), default="default")  # Тема дашборда
    is_public = Column(Boolean, default=False)  # Публичный или приватный
    is_template = Column(Boolean, default=False)  # Является ли шаблоном
    
    # Связи
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Отношения
    user = relationship("User", back_populates="dashboards")
    organization = relationship("Organization", back_populates="dashboards")
    department = relationship("Department", back_populates="dashboards")
    widgets = relationship("DashboardWidget", back_populates="dashboard", cascade="all, delete-orphan")
    data_sources = relationship("DashboardDataSource", back_populates="dashboard", cascade="all, delete-orphan")


class Widget(Base):
    """Модель виджета (шаблон)"""
    __tablename__ = "widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    widget_type = Column(String(100), nullable=False)  # chart, table, kpi, text, etc.
    category = Column(String(100), nullable=False)  # charts, tables, kpi, custom, etc.
    icon = Column(String(255), nullable=True)  # Иконка виджета
    default_config = Column(JSON, nullable=True)  # Конфигурация по умолчанию
    schema = Column(JSON, nullable=True)  # JSON схема для конфигурации
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # Системный виджет
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Отношения
    dashboard_widgets = relationship("DashboardWidget", back_populates="widget")


class DashboardWidget(Base):
    """Модель виджета на дашборде"""
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    widget_id = Column(Integer, ForeignKey("widgets.id"), nullable=False)
    
    # Конфигурация виджета
    title = Column(String(255), nullable=False)
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=6)  # В единицах сетки (обычно 12-колоночная)
    height = Column(Integer, default=4)  # В единицах сетки
    config = Column(JSON, nullable=True)  # Пользовательская конфигурация
    data_source_id = Column(Integer, ForeignKey("dashboard_data_sources.id"), nullable=True)
    
    # Состояние виджета
    is_visible = Column(Boolean, default=True)
    refresh_interval = Column(Integer, default=0)  # Интервал обновления в секундах (0 = без обновления)
    last_refresh = Column(DateTime(timezone=True), nullable=True)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Отношения
    dashboard = relationship("Dashboard", back_populates="widgets")
    widget = relationship("Widget", back_populates="dashboard_widgets")
    data_source = relationship("DashboardDataSource", back_populates="widgets")


class DashboardDataSource(Base):
    """Модель источника данных для дашборда"""
    __tablename__ = "dashboard_data_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    
    # Информация об источнике
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_type = Column(String(100), nullable=False)  # file, database, api, datacode, etc.
    
    # Конфигурация источника
    config = Column(JSON, nullable=True)  # Конфигурация источника данных
    connection_string = Column(Text, nullable=True)  # Строка подключения (зашифрованная)
    
    # Для файловых источников
    file_path = Column(String(500), nullable=True)
    file_type = Column(String(50), nullable=True)
    
    # Для DataCode источников
    datacode_script = Column(Text, nullable=True)
    script_parameters = Column(JSON, nullable=True)
    
    # Кэширование
    cache_enabled = Column(Boolean, default=True)
    cache_ttl = Column(Integer, default=300)  # Время жизни кэша в секундах
    last_cache_update = Column(DateTime(timezone=True), nullable=True)
    cached_data = Column(JSON, nullable=True)
    
    # Состояние
    is_active = Column(Boolean, default=True)
    last_error = Column(Text, nullable=True)
    last_success = Column(DateTime(timezone=True), nullable=True)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Отношения
    dashboard = relationship("Dashboard", back_populates="data_sources")
    widgets = relationship("DashboardWidget", back_populates="data_source")


class WidgetTemplate(Base):
    """Модель шаблона виджета"""
    __tablename__ = "widget_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    widget_type = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    
    # Конфигурация шаблона
    template_config = Column(JSON, nullable=False)  # Конфигурация шаблона
    preview_image = Column(String(500), nullable=True)  # Путь к изображению предпросмотра
    
    # Метаданные
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Отношения
    creator = relationship("User")


class DashboardShare(Base):
    """Модель для совместного использования дашбордов"""
    __tablename__ = "dashboard_shares"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    shared_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Права доступа
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)
    can_share = Column(Boolean, default=False)
    
    # Метаданные
    shared_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Отношения
    dashboard = relationship("Dashboard")
    sharer = relationship("User", foreign_keys=[shared_by])
    sharee = relationship("User", foreign_keys=[shared_with])


class DashboardVersion(Base):
    """Модель для версионирования дашбордов"""
    __tablename__ = "dashboard_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    
    # Данные версии
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    layout_config = Column(JSON, nullable=True)
    widgets_config = Column(JSON, nullable=True)  # Конфигурация всех виджетов
    
    # Метаданные
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_current = Column(Boolean, default=False)
    
    # Отношения
    dashboard = relationship("Dashboard")
    creator = relationship("User")
