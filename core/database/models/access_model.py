from typing import Literal, List
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database.base import Base

class AccessDashboard(Base):
    """Модель для хранения информации о доступе к дашборду."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # dashboard: Mapped["Dashboard"] = relationship("Dashboard", back_populates="accesses")
    # user: Mapped["User"] = relationship("User", back_populates="access_dashboards")

class Flow(Base):
    """Модель для хранения информации о потоке дашбордax."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    dashboards: Mapped[List["FlowDashboard"]] = relationship("FlowDashboard", back_populates="flow")

class FlowDashboard(Base):
    """Модель для хранения информации о связи потока и дашборда."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    flow_id: Mapped[int] = mapped_column(ForeignKey("flows.id"), nullable=False)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"), nullable=False)
    
    flow: Mapped["Flow"] = relationship("Flow", back_populates="dashboards")
    # dashboard: Mapped["Dashboard"] = relationship("Dashboard", back_populates="flows")