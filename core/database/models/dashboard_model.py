"""
Модели для системы дашбордов и виджетов
"""

from typing import Optional, List, Literal
from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, JSON, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from core.database.base import Base


class Dashboard(Base):
    """Модель дашборда"""
    __tablename__ = "dashboards"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    layout_config: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # Конфигурация расположения виджетов
    theme: Mapped[str] = mapped_column(String(50), default="default")  # Тема дашборда
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)  # Публичный или приватный
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)  # Является ли шаблоном
    
    # Связи
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    user: Mapped["User"] = relationship("User", back_populates="dashboards")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="dashboards")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="dashboards")
    widgets: Mapped[List["DashboardWidget"]] = relationship("DashboardWidget", back_populates="dashboard", cascade="all, delete-orphan")
    data_sources: Mapped[List["DashboardDataSource"]] = relationship("DashboardDataSource", back_populates="dashboard", cascade="all, delete-orphan")


class Widget(Base):
    """Модель виджета (шаблон)"""
    __tablename__ = "widgets"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    widget_type: Mapped[str] = mapped_column(String(100), nullable=False)  # chart, table, kpi, text, etc.
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # charts, tables, kpi, custom, etc.
    icon: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Иконка виджета
    default_config: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # Конфигурация по умолчанию
    schema: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # JSON схема для конфигурации
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)  # Системный виджет
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    dashboard_widgets: Mapped[List["DashboardWidget"]] = relationship("DashboardWidget", back_populates="widget")


class DashboardWidget(Base):
    """Модель виджета на дашборде"""
    __tablename__ = "dashboard_widgets"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    widget_id: Mapped[int] = mapped_column(ForeignKey("widgets.id"), nullable=False)
    
    # Конфигурация виджета
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    position_x: Mapped[int] = mapped_column(Integer, default=0)
    position_y: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=6)  # В единицах сетки (обычно 12-колоночная)
    height: Mapped[int] = mapped_column(Integer, default=4)  # В единицах сетки
    config: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # Пользовательская конфигурация
    data_source_id: Mapped[Optional[int]] = mapped_column(ForeignKey("dashboard_data_sources.id"), nullable=True)
    
    # Состояние виджета
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    refresh_interval: Mapped[int] = mapped_column(Integer, default=0)  # Интервал обновления в секундах (0 = без обновления)
    last_refresh: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    dashboard: Mapped["Dashboard"] = relationship("Dashboard", back_populates="widgets")
    widget: Mapped["Widget"] = relationship("Widget", back_populates="dashboard_widgets")
    data_source: Mapped[Optional["DashboardDataSource"]] = relationship("DashboardDataSource", back_populates="widgets")


class DashboardDataSource(Base):
    """Модель источника данных для дашборда"""
    __tablename__ = "dashboard_data_sources"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    
    # Информация об источнике
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(100), nullable=False)  # file, database, api, datacode, etc.
    
    # Конфигурация источника
    config: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # Конфигурация источника данных
    connection_string: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Строка подключения (зашифрованная)
    
    # Для файловых источников
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Для DataCode источников
    datacode_script: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    script_parameters: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)
    
    # Кэширование
    cache_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    cache_ttl: Mapped[int] = mapped_column(Integer, default=300)  # Время жизни кэша в секундах
    last_cache_update: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cached_data: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)
    
    # Состояние
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_success: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    dashboard: Mapped["Dashboard"] = relationship("Dashboard", back_populates="data_sources")
    widgets: Mapped[List["DashboardWidget"]] = relationship("DashboardWidget", back_populates="data_source")


class WidgetTemplate(Base):
    """Модель шаблона виджета"""
    __tablename__ = "widget_templates"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    widget_type: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Конфигурация шаблона
    template_config: Mapped[str] = mapped_column(JSON, nullable=False)  # Конфигурация шаблона
    preview_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Путь к изображению предпросмотра
    
    # Метаданные
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    creator: Mapped["User"] = relationship("User")


class DashboardShare(Base):
    """Модель для совместного использования дашбордов"""
    __tablename__ = "dashboard_shares"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    shared_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    shared_with: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Права доступа
    can_view: Mapped[bool] = mapped_column(Boolean, default=True)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)
    can_share: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Метаданные
    shared_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    dashboard: Mapped["Dashboard"] = relationship("Dashboard")
    sharer: Mapped["User"] = relationship("User", foreign_keys=[shared_by])
    sharee: Mapped["User"] = relationship("User", foreign_keys=[shared_with])


class DashboardVersion(Base):
    """Модель для версионирования дашбордов"""
    __tablename__ = "dashboard_versions"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Данные версии
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    layout_config: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)
    widgets_config: Mapped[Optional[str]] = mapped_column(JSON, nullable=True)  # Конфигурация всех виджетов
    
    # Метаданные
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Отношения
    dashboard: Mapped["Dashboard"] = relationship("Dashboard")
    creator: Mapped["User"] = relationship("User")
