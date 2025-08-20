"""
Модели базы данных для KPI
"""

from typing import Optional, List, Dict, Any
from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, JSON, Integer, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from enum import Enum

from core.database.base import Base


class KPIType(str, Enum):
    """Типы KPI"""
    NUMERIC = "numeric"
    PERCENTAGE = "percentage"
    CURRENCY = "currency"
    RATIO = "ratio"
    COUNTER = "counter"
    TREND = "trend"


class KPITrend(str, Enum):
    """Тренды KPI"""
    UP = "up"
    DOWN = "down"
    STABLE = "stable"
    UNKNOWN = "unknown"


class KPIStatus(str, Enum):
    """Статусы KPI"""
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    SUCCESS = "success"
    ERROR = "error"


class KPI(Base):
    """Модель KPI"""
    __tablename__ = "kpis"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    formula: Mapped[str] = mapped_column(Text, nullable=False)
    data_source: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    target_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    previous_period_days: Mapped[int] = mapped_column(Integer, default=30)
    refresh_interval: Mapped[int] = mapped_column(Integer, default=3600)  # в секундах
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    category: Mapped[str] = mapped_column(String(100), default="general")
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    kpi_type: Mapped[KPIType] = mapped_column(String(20), default=KPIType.NUMERIC)
    
    # Связи
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    last_calculation: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    created_by_user: Mapped["User"] = relationship("User", back_populates="kpis")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="kpis")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="kpis")
    calculations: Mapped[List["KPICalculation"]] = relationship("KPICalculation", back_populates="kpi", cascade="all, delete-orphan")


class KPICalculation(Base):
    """Модель расчета KPI"""
    __tablename__ = "kpi_calculations"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    calculation_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    
    # Связи
    kpi_id: Mapped[Optional[int]] = mapped_column(ForeignKey("kpis.id"), nullable=True)
    calculated_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Результаты расчета
    value: Mapped[float] = mapped_column(Float, nullable=False)
    target_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    previous_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trend: Mapped[KPITrend] = mapped_column(String(20), default=KPITrend.UNKNOWN)
    change_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[KPIStatus] = mapped_column(String(20), default=KPIStatus.NORMAL)
    
    # Метаданные
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    calculation_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    insights: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Отношения
    kpi: Mapped[Optional["KPI"]] = relationship("KPI", back_populates="calculations")
    calculated_by_user: Mapped["User"] = relationship("User", back_populates="kpi_calculations")


class KPITemplate(Base):
    """Модель шаблона KPI"""
    __tablename__ = "kpi_templates"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    formula: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="general")
    kpi_type: Mapped[KPIType] = mapped_column(String(20), default=KPIType.NUMERIC)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)  # Системный шаблон
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Связи
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    created_by_user: Mapped[Optional["User"]] = relationship("User", back_populates="kpi_templates")


class KPINotification(Base):
    """Модель уведомлений KPI"""
    __tablename__ = "kpi_notifications"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), default="info")  # info, warning, critical, success
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Связи
    kpi_id: Mapped[Optional[int]] = mapped_column(ForeignKey("kpis.id"), nullable=True)
    calculation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("kpi_calculations.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    kpi: Mapped[Optional["KPI"]] = relationship("KPI")
    calculation: Mapped[Optional["KPICalculation"]] = relationship("KPICalculation")
    user: Mapped["User"] = relationship("User", back_populates="kpi_notifications")


class KPISchedule(Base):
    """Модель расписания KPI"""
    __tablename__ = "kpi_schedules"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)  # Cron выражение для расписания
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_run: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Связи
    kpi_id: Mapped[int] = mapped_column(ForeignKey("kpis.id"), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    kpi: Mapped["KPI"] = relationship("KPI")
    created_by_user: Mapped["User"] = relationship("User", back_populates="kpi_schedules")
