# модели для БД
from typing import Literal, List, Optional
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database.base import Base

class Task(Base):
    """Модель для хранения информации о задачах."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="created")  # Статусы: created, in_progress, completed, cancelled
    priority: Mapped[str] = mapped_column(String(50), default="low")
    
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    executor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)  # Может быть None, если задача не назначена
    
    # Отношения
    owner: Mapped["User"] = relationship("User", back_populates="owned_tasks", foreign_keys=[owner_id])
    executor: Mapped[Optional["User"]] = relationship("User", back_populates="executed_tasks", foreign_keys=[executor_id])

class TaskStatus(Base):
    """Модель для хранения статусов задач."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)  # Название статуса
    description: Mapped[str] = mapped_column(String(255), nullable=True)  # Описание статуса

class TaskPriority(Base):
    """Модель для хранения приоритетов задач."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)  # Название приоритета
    description: Mapped[str] = mapped_column(String(255), nullable=True)  # Описание приоритета

class TaskType(Base):
    """Модель для хранения типов задач."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)  # Название типа задачи
    description: Mapped[str] = mapped_column(String(255), nullable=True)  # Описание типа задачи

class TaskColumn(Base):
    """Модель для хранения информации о колонках."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="str")  # Типы: str, int, float, date, datetime, boolean

class TaskColumnValue(Base):
    """Модель для хранения значений колонок задач."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    column_id: Mapped[int] = mapped_column(ForeignKey("task_columns.id"), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=True)  # Значение колонки