"""
Модели для системы управления командами
"""
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import (
    BigInteger, String, Text, Boolean, DateTime, Integer, 
    ForeignKey, JSON, Index, UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from core.database.base import Base


class TeamRole(str, Enum):
    """Роли участников команды"""
    OWNER = "owner"           # Владелец команды
    LEADER = "leader"          # Лидер команды
    MEMBER = "member"          # Участник команды
    GUEST = "guest"            # Гость (ограниченные права)


class TeamStatus(str, Enum):
    """Статусы команды"""
    ACTIVE = "active"          # Активная команда
    INACTIVE = "inactive"      # Неактивная команда
    ARCHIVED = "archived"      # Архивированная команда
    DISBANDED = "disbanded"    # Расформированная команда


class Team(Base):
    """Модель команды"""
    __tablename__ = "teams"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Основная информация
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Статус и настройки
    status: Mapped[TeamStatus] = mapped_column(String(20), default=TeamStatus.ACTIVE, index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)  # Публичная или приватная команда
    
    # Автоматическое расформирование
    auto_disband_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    disbanded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Связи с организацией
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    
    # Метаданные
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    members: Mapped[List["TeamMember"]] = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", foreign_keys=[organization_id])
    department: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_id])
    
    __table_args__ = (
        Index("idx_teams_status", "status"),
        Index("idx_teams_organization", "organization_id"),
        Index("idx_teams_department", "department_id"),
        Index("idx_teams_auto_disband", "auto_disband_date"),
    )


class TeamMember(Base):
    """Модель участника команды"""
    __tablename__ = "team_members"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Роль и права
    role: Mapped[TeamRole] = mapped_column(String(20), default=TeamRole.MEMBER)
    permissions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Статус участника
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Настройки уведомлений
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Временные метки
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    team: Mapped["Team"] = relationship("Team", back_populates="members")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_team_members_team_id", "team_id"),
        Index("idx_team_members_user_id", "user_id"),
        Index("idx_team_members_role", "role"),
        Index("idx_team_members_active", "is_active"),
        UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )
