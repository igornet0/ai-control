from typing import Literal, List
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database.base import Base

class Dashboard(Base):
    """Модель для хранения информации о дашборде пользователя."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    
    user: Mapped["User"] = relationship("User", back_populates="dashboards")
    widgets: Mapped[List["Widget"]] = relationship("Widget", back_populates="dashboard")

class Widget(Base):
    """Модель для хранения информации о виджете на дашборде."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    widget_type_id: Mapped[str] = mapped_column(ForeignKey("widget_types.id"), nullable=False)
    data: Mapped[str] = mapped_column(String(500), nullable=True)  # JSON или другой формат данных
    
    dashboard: Mapped["Dashboard"] = relationship("Dashboard", back_populates="widgets")

class WidgetType(Base):
    """Модель для хранения информации о типах виджетов."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)  # Название типа виджета
    description: Mapped[str] = mapped_column(String(255), nullable=True)  # Описание типа виджета
    
    # Relationships
    widgets: Mapped[List["Widget"]] = relationship("Widget", back_populates="type")  # Связь с виджетами данного типа


class DashboardData(Base):
    """Модель для хранения данных дашборда."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    
    data: Mapped[str] = mapped_column(String(500), nullable=False)  # JSON или другой формат данных
    
    dashboard: Mapped["Dashboard"] = relationship("Dashboard", back_populates="data")  # Связь с дашбордом