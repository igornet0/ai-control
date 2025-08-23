"""
Модели для единой системы уведомлений
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, JSON, 
    ForeignKey, Index, UniqueConstraint, BigInteger
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.declarative import declarative_base

from core.database.base import Base


class NotificationType(str, Enum):
    """Типы уведомлений"""
    TASK = "task"
    EMAIL = "email"
    CHAT = "chat"
    VIDEO_CALL = "video_call"
    KPI = "kpi"
    DOCUMENT = "document"
    SYSTEM = "system"
    REMINDER = "reminder"
    ALERT = "alert"


class NotificationPriority(str, Enum):
    """Приоритеты уведомлений"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationStatus(str, Enum):
    """Статусы уведомлений"""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    EXPIRED = "expired"


class NotificationChannel(str, Enum):
    """Каналы доставки уведомлений"""
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"


class NotificationTemplate(Base):
    """Шаблоны уведомлений"""
    __tablename__ = "notification_templates"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    template_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    
    # Основная информация
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notification_type: Mapped[NotificationType] = mapped_column(String(50), nullable=False)
    
    # Шаблоны для разных каналов
    subject_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    email_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sms_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    push_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Настройки
    default_priority: Mapped[NotificationPriority] = mapped_column(String(20), default=NotificationPriority.NORMAL)
    default_channels: Mapped[List[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Метаданные
    variables: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="template", lazy="dynamic")
    
    __table_args__ = (
        Index("idx_notification_templates_type", "notification_type"),
        Index("idx_notification_templates_active", "is_active"),
        Index("idx_notification_templates_uuid", "template_uuid"),
    )


class Notification(Base):
    """Уведомления"""
    __tablename__ = "notifications"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    notification_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    
    # Получатель
    recipient_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    
    # Шаблон
    template_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("notification_templates.id"), nullable=True)
    
    # Основная информация
    notification_type: Mapped[NotificationType] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[NotificationPriority] = mapped_column(String(20), default=NotificationPriority.NORMAL)
    status: Mapped[NotificationStatus] = mapped_column(String(20), default=NotificationStatus.PENDING)
    
    # Каналы доставки
    channels: Mapped[List[str]] = mapped_column(JSON, default=list)
    delivered_channels: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Связанные данные
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    
    # Метаданные
    notification_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    variables: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    # Временные метки
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    recipient: Mapped["User"] = relationship("User", back_populates="notifications", lazy="joined")
    template: Mapped[Optional[NotificationTemplate]] = relationship("NotificationTemplate", back_populates="notifications", lazy="joined")
    deliveries: Mapped[List["NotificationDelivery"]] = relationship("NotificationDelivery", back_populates="notification", lazy="dynamic")
    
    __table_args__ = (
        Index("idx_notifications_recipient", "recipient_id"),
        Index("idx_notifications_type", "notification_type"),
        Index("idx_notifications_status", "status"),
        Index("idx_notifications_priority", "priority"),
        Index("idx_notifications_scheduled", "scheduled_at"),
        Index("idx_notifications_expires", "expires_at"),
        Index("idx_notifications_related", "related_entity_type", "related_entity_id"),
        Index("idx_notifications_uuid", "notification_uuid"),
    )


class NotificationDelivery(Base):
    """Доставка уведомлений по каналам"""
    __tablename__ = "notification_deliveries"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Связь с уведомлением
    notification_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("notifications.id"), nullable=False)
    
    # Канал доставки
    channel: Mapped[NotificationChannel] = mapped_column(String(20), nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(String(20), default=NotificationStatus.PENDING)
    
    # Детали доставки
    recipient_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # email, phone, etc.
    delivery_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Временные метки
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    notification: Mapped[Notification] = relationship("Notification", back_populates="deliveries")
    
    __table_args__ = (
        Index("idx_notification_deliveries_notification", "notification_id"),
        Index("idx_notification_deliveries_channel", "channel"),
        Index("idx_notification_deliveries_status", "status"),
        UniqueConstraint("notification_id", "channel", name="uq_notification_delivery"),
    )


class UserNotificationPreference(Base):
    """Настройки уведомлений пользователя"""
    __tablename__ = "user_notification_preferences"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Пользователь
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    
    # Тип уведомлений
    notification_type: Mapped[NotificationType] = mapped_column(String(50), nullable=False)
    
    # Настройки каналов
    enabled_channels: Mapped[List[str]] = mapped_column(JSON, default=list)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Настройки приоритетов
    min_priority: Mapped[NotificationPriority] = mapped_column(String(20), default=NotificationPriority.LOW)
    
    # Временные настройки
    quiet_hours_start: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)  # HH:MM
    quiet_hours_end: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)    # HH:MM
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    
    # Дополнительные настройки
    batch_notifications: Mapped[bool] = mapped_column(Boolean, default=False)
    batch_interval_minutes: Mapped[int] = mapped_column(Integer, default=15)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_user_notification_preferences_user", "user_id"),
        Index("idx_user_notification_preferences_type", "notification_type"),
        UniqueConstraint("user_id", "notification_type", name="uq_user_notification_preference"),
    )


class NotificationBatch(Base):
    """Пакетные уведомления"""
    __tablename__ = "notification_batches"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    batch_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    
    # Пользователь
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    
    # Настройки пакета
    notification_type: Mapped[NotificationType] = mapped_column(String(50), nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(String(20), nullable=False)
    
    # Статус
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, processing, sent, failed
    
    # Содержимое
    notifications_count: Mapped[int] = mapped_column(Integer, default=0)
    summary_title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary_message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Временные метки
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_notification_batches_user", "user_id"),
        Index("idx_notification_batches_scheduled", "scheduled_at"),
        Index("idx_notification_batches_status", "status"),
        Index("idx_notification_batches_uuid", "batch_uuid"),
    )


class NotificationWebhook(Base):
    """Webhook'и для уведомлений"""
    __tablename__ = "notification_webhooks"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    webhook_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    
    # Настройки webhook'а
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    method: Mapped[str] = mapped_column(String(10), default="POST")
    
    # Фильтры
    notification_types: Mapped[List[str]] = mapped_column(JSON, default=list)
    notification_priorities: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Аутентификация
    headers: Mapped[Dict[str, str]] = mapped_column(JSON, default=dict)
    auth_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # basic, bearer, none
    auth_credentials: Mapped[Optional[Dict[str, str]]] = mapped_column(JSON, nullable=True)
    
    # Настройки
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=3)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=30)
    
    # Статистика
    total_calls: Mapped[int] = mapped_column(Integer, default=0)
    successful_calls: Mapped[int] = mapped_column(Integer, default=0)
    failed_calls: Mapped[int] = mapped_column(Integer, default=0)
    last_called_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_notification_webhooks_active", "is_active"),
        Index("idx_notification_webhooks_uuid", "webhook_uuid"),
    )
