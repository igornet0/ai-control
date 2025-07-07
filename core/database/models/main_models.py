# модели для БД
from typing import Literal, List
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database.base import Base

class User(Base):

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[Literal["admin", "manager", "employee"]] = mapped_column(String(50), nullable=False, default="employee")

    dashboards: Mapped[List["Dashboard"]] = relationship("Dashboard", back_populates="user")
    users_groups: Mapped[List["UserGroup"]] = relationship("UserGroup", back_populates="user")


class Task(Base):
    """Модель для хранения информации о задачах."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="created")  # Статусы: created, in_progress, completed, cancelled
    priority: Mapped[str] = mapped_column(String(50), default="low")
    
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    executor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)  # Может быть None, если задача не назначена