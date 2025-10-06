"""
User database model.
SQLAlchemy model for User entity.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import String, Boolean, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.database.base import Base


class UserModel(Base):
    """SQLAlchemy model for User entity."""
    
    __tablename__ = "users"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True)
    
    # Basic information
    login: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Status and role
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="employee")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Organizational information
    manager_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    department_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    organization_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Contact information
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    manager: Mapped[Optional["UserModel"]] = relationship(
        "UserModel",
        back_populates="subordinates",
        foreign_keys=[manager_id],
        remote_side=[id]
    )
    subordinates: Mapped[list["UserModel"]] = relationship(
        "UserModel",
        back_populates="manager",
        foreign_keys=[manager_id]
    )
    
    # Organization relationships
    organization: Mapped[Optional["OrganizationModel"]] = relationship("OrganizationModel", back_populates="users")
    department: Mapped[Optional["DepartmentModel"]] = relationship("DepartmentModel", back_populates="users")
    managed_departments: Mapped[list["DepartmentModel"]] = relationship("DepartmentModel", back_populates="manager", foreign_keys="DepartmentModel.manager_id")
    
    # Task relationships
    assigned_tasks: Mapped[list["TaskModel"]] = relationship("TaskModel", back_populates="assignee", foreign_keys="TaskModel.assignee_id")
    created_tasks: Mapped[list["TaskModel"]] = relationship("TaskModel", back_populates="creator", foreign_keys="TaskModel.creator_id")
    
    # Dashboard relationships
    dashboards: Mapped[list["DashboardModel"]] = relationship("DashboardModel", back_populates="user")
    
    # KPI relationships
    kpis: Mapped[list["KPIModel"]] = relationship("KPIModel", back_populates="user")
    
    # Task comment relationships
    task_comments: Mapped[list["TaskCommentModel"]] = relationship("TaskCommentModel", back_populates="user")
    
    # Task time log relationships
    task_time_logs: Mapped[list["TaskTimeLogModel"]] = relationship("TaskTimeLogModel", back_populates="user")
