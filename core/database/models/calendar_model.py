"""
Модели для единого календаря событий
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, JSON,
    ForeignKey, Index, UniqueConstraint, BigInteger
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.declarative import declarative_base

from core.database.engine import Base


class EventType(str, Enum):
    """Типы событий"""
    TASK = "task"
    MEETING = "meeting"
    DEADLINE = "deadline"
    REMINDER = "reminder"
    HOLIDAY = "holiday"
    BIRTHDAY = "birthday"
    CUSTOM = "custom"


class EventPriority(str, Enum):
    """Приоритеты событий"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class EventStatus(str, Enum):
    """Статусы событий"""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class RecurrenceType(str, Enum):
    """Типы повторения событий"""
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class Calendar(Base):
    """Календари пользователей"""
    __tablename__ = "calendars"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    calendar_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)

    # Владелец календаря
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)

    # Основная информация
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#007bff")  # HEX цвет

    # Настройки
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Настройки отображения
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    working_hours_start: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)  # HH:MM
    working_hours_end: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)    # HH:MM
    working_days: Mapped[List[int]] = mapped_column(JSON, default=[0, 1, 2, 3, 4, 5, 6])  # 0=Sunday

    # Метаданные
    calendar_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Отношения
    owner: Mapped["User"] = relationship("User", back_populates="calendars")
    events: Mapped[List["CalendarEvent"]] = relationship("CalendarEvent", back_populates="calendar")
    shares: Mapped[List["CalendarShare"]] = relationship("CalendarShare", back_populates="calendar")

    __table_args__ = (
        Index("idx_calendars_owner", "owner_id"),
        Index("idx_calendars_default", "is_default"),
        Index("idx_calendars_public", "is_public"),
        Index("idx_calendars_active", "is_active"),
        Index("idx_calendars_uuid", "calendar_uuid"),
    )


class CalendarEvent(Base):
    """События календаря"""
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)

    # Календарь
    calendar_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("calendars.id"), nullable=False)

    # Основная информация
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_type: Mapped[EventType] = mapped_column(String(50), nullable=False)
    priority: Mapped[EventPriority] = mapped_column(String(20), default=EventPriority.NORMAL)
    status: Mapped[EventStatus] = mapped_column(String(20), default=EventStatus.SCHEDULED)

    # Время события
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)

    # Место проведения
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    location_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Повторение
    recurrence_type: Mapped[RecurrenceType] = mapped_column(String(20), default=RecurrenceType.NONE)
    recurrence_rule: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    recurrence_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Напоминания
    reminder_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    # Связанные сущности
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Метаданные
    event_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    attachments: Mapped[List[str]] = mapped_column(JSON, default=list)  # URLs к файлам

    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Отношения
    calendar: Mapped[Calendar] = relationship("Calendar", back_populates="events")
    attendees: Mapped[List["EventAttendee"]] = relationship("EventAttendee", back_populates="event")
    reminders: Mapped[List["EventReminder"]] = relationship("EventReminder", back_populates="event")

    __table_args__ = (
        Index("idx_calendar_events_calendar", "calendar_id"),
        Index("idx_calendar_events_type", "event_type"),
        Index("idx_calendar_events_status", "status"),
        Index("idx_calendar_events_priority", "priority"),
        Index("idx_calendar_events_start", "start_time"),
        Index("idx_calendar_events_end", "end_time"),
        Index("idx_calendar_events_related", "related_entity_type", "related_entity_id"),
        Index("idx_calendar_events_uuid", "event_uuid"),
    )


class EventAttendee(Base):
    """Участники событий"""
    __tablename__ = "event_attendees"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Событие
    event_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("calendar_events.id"), nullable=False)

    # Участник
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)

    # Статус участия
    response_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, accepted, declined, tentative

    # Роль
    role: Mapped[str] = mapped_column(String(50), default="attendee")  # organizer, attendee, optional

    # Настройки
    send_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Временные метки
    invited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Отношения
    event: Mapped[CalendarEvent] = relationship("CalendarEvent", back_populates="attendees")
    user: Mapped["User"] = relationship("User", back_populates="event_attendances")

    __table_args__ = (
        Index("idx_event_attendees_event", "event_id"),
        Index("idx_event_attendees_user", "user_id"),
        Index("idx_event_attendees_status", "response_status"),
        UniqueConstraint("event_id", "user_id", name="uq_event_attendee"),
    )


class EventReminder(Base):
    """Напоминания о событиях"""
    __tablename__ = "event_reminders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Событие
    event_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("calendar_events.id"), nullable=False)

    # Пользователь
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)

    # Настройки напоминания
    reminder_type: Mapped[str] = mapped_column(String(20), default="notification")  # notification, email, sms
    reminder_minutes: Mapped[int] = mapped_column(Integer, nullable=False)  # минуты до события
    reminder_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Статус
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Отношения
    event: Mapped[CalendarEvent] = relationship("CalendarEvent", back_populates="reminders")
    user: Mapped["User"] = relationship("User", back_populates="event_reminders")

    __table_args__ = (
        Index("idx_event_reminders_event", "event_id"),
        Index("idx_event_reminders_user", "user_id"),
        Index("idx_event_reminders_time", "reminder_time"),
        Index("idx_event_reminders_sent", "is_sent"),
        UniqueConstraint("event_id", "user_id", "reminder_type", "reminder_minutes", name="uq_event_reminder"),
    )


class CalendarShare(Base):
    """Доступ к календарям"""
    __tablename__ = "calendar_shares"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Календарь
    calendar_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("calendars.id"), nullable=False)

    # Пользователь с доступом
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)

    # Права доступа
    can_view: Mapped[bool] = mapped_column(Boolean, default=True)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)
    can_share: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)

    # Настройки
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Временные метки
    shared_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Отношения
    calendar: Mapped[Calendar] = relationship("Calendar", back_populates="shares")
    user: Mapped["User"] = relationship("User", back_populates="shared_calendars")

    __table_args__ = (
        Index("idx_calendar_shares_calendar", "calendar_id"),
        Index("idx_calendar_shares_user", "user_id"),
        Index("idx_calendar_shares_active", "is_active"),
        Index("idx_calendar_shares_expires", "expires_at"),
        UniqueConstraint("calendar_id", "user_id", name="uq_calendar_share"),
    )


class CalendarTemplate(Base):
    """Шаблоны событий"""
    __tablename__ = "calendar_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    template_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)

    # Создатель шаблона
    creator_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)

    # Основная информация
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_type: Mapped[EventType] = mapped_column(String(50), nullable=False)

    # Настройки события
    default_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    default_priority: Mapped[EventPriority] = mapped_column(String(20), default=EventPriority.NORMAL)
    default_reminder_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Шаблонные поля
    title_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Настройки
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Метаданные
    template_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_calendar_templates_creator", "creator_id"),
        Index("idx_calendar_templates_type", "event_type"),
        Index("idx_calendar_templates_public", "is_public"),
        Index("idx_calendar_templates_active", "is_active"),
        Index("idx_calendar_templates_uuid", "template_uuid"),
    )


class CalendarIntegration(Base):
    """Интеграции с внешними календарями"""
    __tablename__ = "calendar_integrations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    integration_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)

    # Пользователь
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)

    # Тип интеграции
    integration_type: Mapped[str] = mapped_column(String(50), nullable=False)  # google, outlook, ical, etc.

    # Настройки подключения
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_email: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Настройки синхронизации
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sync_direction: Mapped[str] = mapped_column(String(20), default="bidirectional")  # import, export, bidirectional
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Статистика
    events_imported: Mapped[int] = mapped_column(Integer, default=0)
    events_exported: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_calendar_integrations_user", "user_id"),
        Index("idx_calendar_integrations_type", "integration_type"),
        Index("idx_calendar_integrations_sync", "sync_enabled"),
        Index("idx_calendar_integrations_uuid", "integration_uuid"),
    )
