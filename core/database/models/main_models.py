# модели для БД
from typing import Literal, List, Optional
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from core.database.base import Base

class User(Base):
    """Модель пользователя с иерархией ролей"""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    login: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[Literal["admin", "CEO", "manager", "employee"]] = mapped_column(String(50), nullable=False, default="employee")
    
    # Новые поля для иерархии
    manager_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    dashboards: Mapped[List["Dashboard"]] = relationship("Dashboard", back_populates="user")
    users_groups: Mapped[List["UserGroup"]] = relationship("UserGroup", back_populates="users")
    kpis: Mapped[List["KPI"]] = relationship("KPI", back_populates="created_by_user")
    kpi_calculations: Mapped[List["KPICalculation"]] = relationship("KPICalculation", back_populates="calculated_by_user")
    kpi_templates: Mapped[List["KPITemplate"]] = relationship("KPITemplate", back_populates="created_by_user")
    kpi_notifications: Mapped[List["KPINotification"]] = relationship("KPINotification", back_populates="user")
    kpi_schedules: Mapped[List["KPISchedule"]] = relationship("KPISchedule", back_populates="created_by_user")
    
    # Иерархические отношения
    subordinates: Mapped[List["User"]] = relationship("User", back_populates="manager", foreign_keys=[manager_id])
    manager: Mapped[Optional["User"]] = relationship("User", back_populates="subordinates", foreign_keys=[manager_id], remote_side=[id])
    
    # Организационные отношения
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="users", foreign_keys=[organization_id])
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="users", foreign_keys=[department_id])
    
    # Задачи
    owned_tasks: Mapped[List["Task"]] = relationship("Task", back_populates="owner", foreign_keys="Task.owner_id")
    executed_tasks: Mapped[List["Task"]] = relationship("Task", back_populates="executor", foreign_keys="Task.executor_id")
    reviewed_tasks: Mapped[List["Task"]] = relationship("Task", back_populates="reviewer", foreign_keys="Task.reviewer_id")
    task_comments: Mapped[List["TaskComment"]] = relationship("TaskComment", back_populates="author")
    task_time_logs: Mapped[List["TaskTimeLog"]] = relationship("TaskTimeLog", back_populates="user")
    task_watchers: Mapped[List["TaskWatcher"]] = relationship("TaskWatcher", back_populates="user")
    task_templates: Mapped[List["TaskTemplate"]] = relationship("TaskTemplate", back_populates="created_by_user")
    
    # Документы
    authored_documents: Mapped[List["Document"]] = relationship("Document", back_populates="author", foreign_keys="Document.author_id")
    owned_documents: Mapped[List["Document"]] = relationship("Document", back_populates="owner", foreign_keys="Document.owner_id")
    reviewed_documents: Mapped[List["Document"]] = relationship("Document", back_populates="reviewer", foreign_keys="Document.reviewer_id")
    document_signatures: Mapped[List["DocumentSignature"]] = relationship("DocumentSignature", back_populates="signer")
    document_comments: Mapped[List["DocumentComment"]] = relationship("DocumentComment", back_populates="author")
    document_attachments: Mapped[List["DocumentAttachment"]] = relationship("DocumentAttachment", back_populates="user")
    document_watchers: Mapped[List["DocumentWatcher"]] = relationship("DocumentWatcher", back_populates="user")
    document_templates: Mapped[List["DocumentTemplate"]] = relationship("DocumentTemplate", back_populates="created_by_user")

class Organization(Base):
    """Модель организации"""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Настройки организации
    settings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON настройки
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    users: Mapped[List["User"]] = relationship("User", back_populates="organization")
    departments: Mapped[List["Department"]] = relationship("Department", back_populates="organization")
    dashboards: Mapped[List["Dashboard"]] = relationship("Dashboard", back_populates="organization")
    kpis: Mapped[List["KPI"]] = relationship("KPI", back_populates="organization")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="organization")
    task_templates: Mapped[List["TaskTemplate"]] = relationship("TaskTemplate", back_populates="organization")
    
    # Документы
    documents: Mapped[List["Document"]] = relationship("Document", back_populates="organization")
    document_templates: Mapped[List["DocumentTemplate"]] = relationship("DocumentTemplate", back_populates="organization")

class Department(Base):
    """Модель департамента"""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    manager_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    organization: Mapped["Organization"] = relationship("Organization", back_populates="departments")
    manager: Mapped[Optional["User"]] = relationship("User", foreign_keys=[manager_id])
    users: Mapped[List["User"]] = relationship("User", back_populates="department", foreign_keys="User.department_id")
    dashboards: Mapped[List["Dashboard"]] = relationship("Dashboard", back_populates="department")
    kpis: Mapped[List["KPI"]] = relationship("KPI", back_populates="department")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="department")
    task_templates: Mapped[List["TaskTemplate"]] = relationship("TaskTemplate", back_populates="department")
    
    # Документы
    documents: Mapped[List["Document"]] = relationship("Document", back_populates="department")
    document_templates: Mapped[List["DocumentTemplate"]] = relationship("DocumentTemplate", back_populates="department")

class Permission(Base):
    """Модель разрешений"""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resource: Mapped[str] = mapped_column(String(255), nullable=False)  # Ресурс (dashboard, task, user, etc.)
    action: Mapped[str] = mapped_column(String(255), nullable=False)    # Действие (create, read, update, delete)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

class RolePermission(Base):
    """Связь ролей и разрешений"""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id"), nullable=False)
    
    # Отношения
    permission: Mapped["Permission"] = relationship("Permission")
