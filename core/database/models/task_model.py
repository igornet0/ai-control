# модели для БД
from typing import Literal, List, Optional, Dict, Any
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from enum import Enum

from core.database.base import Base


class TaskStatus(str, Enum):
    """Статусы задач"""
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"
    BLOCKED = "blocked"


class TaskPriority(str, Enum):
    """Приоритеты задач"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    URGENT = "urgent"


class TaskType(str, Enum):
    """Типы задач"""
    TASK = "task"
    BUG = "bug"
    FEATURE = "feature"
    STORY = "story"
    EPIC = "epic"
    SUBTASK = "subtask"


class TaskVisibility(str, Enum):
    """Видимость задач"""
    PUBLIC = "public"
    PRIVATE = "private"
    TEAM = "team"
    DEPARTMENT = "department"
    ORGANIZATION = "organization"


class Task(Base):
    """Модель для хранения информации о задачах."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(String(50), default=TaskStatus.CREATED, index=True)
    priority: Mapped[TaskPriority] = mapped_column(String(50), default=TaskPriority.MEDIUM, index=True)
    task_type: Mapped[TaskType] = mapped_column(String(50), default=TaskType.TASK, index=True)
    visibility: Mapped[TaskVisibility] = mapped_column(String(50), default=TaskVisibility.TEAM)
    
    # Иерархия задач
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    epic_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    
    # Временные рамки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Оценки и прогресс
    estimated_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    
    # Метаданные
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    attachments: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)  # URLs к файлам
    
    # Связи с пользователями
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    executor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    reviewer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    
    # Связи с организацией
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    
    # Отношения
    owner: Mapped["User"] = relationship("User", back_populates="owned_tasks", foreign_keys=[owner_id])
    executor: Mapped[Optional["User"]] = relationship("User", back_populates="executed_tasks", foreign_keys=[executor_id])
    reviewer: Mapped[Optional["User"]] = relationship("User", back_populates="reviewed_tasks", foreign_keys=[reviewer_id])
    
    # Иерархические отношения
    parent: Mapped[Optional["Task"]] = relationship("Task", back_populates="subtasks", foreign_keys=[parent_id], remote_side=[id])
    subtasks: Mapped[List["Task"]] = relationship("Task", back_populates="parent", foreign_keys=[parent_id])
    epic: Mapped[Optional["Task"]] = relationship("Task", back_populates="epic_tasks", foreign_keys=[epic_id], remote_side=[id])
    epic_tasks: Mapped[List["Task"]] = relationship("Task", back_populates="epic", foreign_keys=[epic_id])
    
    # Организационные отношения
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="tasks")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="tasks")
    
    # Дополнительные отношения
    comments: Mapped[List["TaskComment"]] = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    time_logs: Mapped[List["TaskTimeLog"]] = relationship("TaskTimeLog", back_populates="task", cascade="all, delete-orphan")
    dependencies: Mapped[List["TaskDependency"]] = relationship("TaskDependency", back_populates="task", cascade="all, delete-orphan")
    watchers: Mapped[List["TaskWatcher"]] = relationship("TaskWatcher", back_populates="task", cascade="all, delete-orphan")
    labels: Mapped[List["TaskLabel"]] = relationship("TaskLabel", back_populates="task", cascade="all, delete-orphan")


class TaskComment(Base):
    """Модель комментариев к задачам"""
    __tablename__ = "task_comments"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)  # Внутренний комментарий
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    task: Mapped["Task"] = relationship("Task", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="task_comments")


class TaskTimeLog(Base):
    """Модель учета времени по задачам"""
    __tablename__ = "task_time_logs"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Отношения
    task: Mapped["Task"] = relationship("Task", back_populates="time_logs")
    user: Mapped["User"] = relationship("User", back_populates="task_time_logs")


class TaskDependency(Base):
    """Модель зависимостей между задачами"""
    __tablename__ = "task_dependencies"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    depends_on_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    dependency_type: Mapped[str] = mapped_column(String(50), default="blocks")  # blocks, requires, relates
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Отношения
    task: Mapped["Task"] = relationship("Task", back_populates="dependencies")
    depends_on_task: Mapped["Task"] = relationship("Task", foreign_keys=[depends_on_task_id])


class TaskWatcher(Base):
    """Модель наблюдателей за задачами"""
    __tablename__ = "task_watchers"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    notification_preferences: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Отношения
    task: Mapped["Task"] = relationship("Task", back_populates="watchers")
    user: Mapped["User"] = relationship("User", back_populates="task_watchers")


class TaskLabel(Base):
    """Модель меток для задач"""
    __tablename__ = "task_labels"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#007bff")  # HEX цвет
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Отношения
    task: Mapped["Task"] = relationship("Task", back_populates="labels")


class TaskTemplate(Base):
    """Модель шаблонов задач"""
    __tablename__ = "task_templates"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    task_type: Mapped[TaskType] = mapped_column(String(50), default=TaskType.TASK)
    priority: Mapped[TaskPriority] = mapped_column(String(50), default=TaskPriority.MEDIUM)
    
    # Шаблонные поля
    template_fields: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    estimated_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Связи
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    created_by_user: Mapped["User"] = relationship("User", back_populates="task_templates")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="task_templates")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="task_templates")


# Устаревшие модели (оставляем для обратной совместимости)
class TaskStatusOld(Base):
    """Модель для хранения статусов задач."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)  # Название статуса
    description: Mapped[str] = mapped_column(String(255), nullable=True)  # Описание статуса

class TaskPriorityOld(Base):
    """Модель для хранения приоритетов задач."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)  # Название приоритета
    description: Mapped[str] = mapped_column(String(255), nullable=True)  # Описание приоритета

class TaskTypeOld(Base):
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