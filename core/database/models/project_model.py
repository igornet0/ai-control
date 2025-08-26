"""
Модели для управления проектами
"""
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import (
    BigInteger, String, Text, Boolean, DateTime, Integer,
    ForeignKey, Index, JSON, func, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database.base import Base


class ProjectStatus(str, Enum):
    """Статусы проекта"""
    PLANNING = "planning"           # Планирование
    ACTIVE = "active"               # Активный
    ON_HOLD = "on_hold"            # На паузе
    COMPLETED = "completed"         # Завершен
    CANCELLED = "cancelled"         # Отменен
    ARCHIVED = "archived"           # Архивирован


class ProjectPriority(str, Enum):
    """Приоритеты проекта"""
    LOW = "low"                     # Низкий
    MEDIUM = "medium"               # Средний
    HIGH = "high"                   # Высокий
    CRITICAL = "critical"           # Критический
    URGENT = "urgent"               # Срочный


class Project(Base):
    """Модель проекта"""
    __tablename__ = "projects"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(String(20), default=ProjectStatus.PLANNING, index=True)
    priority: Mapped[ProjectPriority] = mapped_column(String(20), default=ProjectPriority.MEDIUM, index=True)
    
    # Даты проекта
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Связи с организацией
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    
    # Менеджер проекта
    manager_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    
    # Дополнительные поля
    budget: Mapped[Optional[float]] = mapped_column(BigInteger, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)  # Прогресс в процентах (0-100)
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Связи
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    teams: Mapped[List["ProjectTeam"]] = relationship("ProjectTeam", back_populates="project", cascade="all, delete-orphan")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", foreign_keys=[organization_id])
    department: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_id])
    manager: Mapped[Optional["User"]] = relationship("User", foreign_keys=[manager_id])
    
    __table_args__ = (
        Index("idx_projects_status", "status"),
        Index("idx_projects_priority", "priority"),
        Index("idx_projects_organization", "organization_id"),
        Index("idx_projects_department", "department_id"),
        Index("idx_projects_manager", "manager_id"),
        Index("idx_projects_dates", "start_date", "due_date"),
    )


class ProjectTeam(Base):
    """Связь проектов с командами"""
    __tablename__ = "project_teams"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    
    # Роль команды в проекте
    role: Mapped[str] = mapped_column(String(100), nullable=False, default="development")
    
    # Дополнительные поля
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    disbanded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # Связи
    project: Mapped["Project"] = relationship("Project", back_populates="teams")
    team: Mapped["Team"] = relationship("Team")
    
    __table_args__ = (
        Index("idx_project_teams_project", "project_id"),
        Index("idx_project_teams_team", "team_id"),
        Index("idx_project_teams_active", "is_active"),
        Index("idx_project_teams_disbanded", "disbanded_at"),
    )


class ProjectAttachmentFavorite(Base):
    """Избранные вложения проектов пользователем"""
    __tablename__ = "project_attachment_favorites"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "project_id", "filename", name="uq_project_attachment_fav"),
        Index("idx_project_attachment_fav_user", "user_id"),
        Index("idx_project_attachment_fav_project", "project_id"),
    )
