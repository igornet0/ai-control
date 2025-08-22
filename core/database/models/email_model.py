"""
Модели данных для системы корпоративной почты
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import (
    BigInteger, String, Text, Boolean, DateTime, Integer, 
    ForeignKey, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from core.database.base import Base


class EmailStatus(str, Enum):
    """Статусы email сообщений"""
    DRAFT = "draft"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    SPAM = "spam"
    ARCHIVED = "archived"


class EmailPriority(str, Enum):
    """Приоритеты email сообщений"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class EmailCategory(str, Enum):
    """Категории email сообщений"""
    GENERAL = "general"
    IMPORTANT = "important"
    NOTIFICATION = "notification"
    REPORT = "report"
    MEETING = "meeting"
    TASK = "task"
    JUNK = "junk"
    PERSONAL = "personal"


class EmailFilterType(str, Enum):
    """Типы фильтров для email"""
    SENDER = "sender"
    RECIPIENT = "recipient"
    SUBJECT = "subject"
    CONTENT = "content"
    ATTACHMENT = "attachment"
    SIZE = "size"
    DATE = "date"
    CATEGORY = "category"


class EmailFilterAction(str, Enum):
    """Действия фильтров email"""
    MOVE_TO_FOLDER = "move_to_folder"
    MARK_AS_READ = "mark_as_read"
    MARK_AS_IMPORTANT = "mark_as_important"
    MARK_AS_SPAM = "mark_as_spam"
    DELETE = "delete"
    FORWARD = "forward"
    AUTO_REPLY = "auto_reply"


class EmailAccount(Base):
    """Модель email аккаунтов пользователей"""
    __tablename__ = "email_accounts"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Настройки SMTP
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    smtp_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Настройки IMAP
    imap_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    imap_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    imap_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    imap_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    imap_use_ssl: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Дополнительные настройки
    signature: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auto_reply_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auto_reply_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    user: Mapped["User"] = relationship("User", back_populates="email_accounts")
    sent_emails: Mapped[List["Email"]] = relationship("Email", foreign_keys="Email.sender_id", back_populates="sender")
    received_emails: Mapped[List["EmailRecipient"]] = relationship("EmailRecipient", back_populates="email_account")
    folders: Mapped[List["EmailFolder"]] = relationship("EmailFolder", back_populates="email_account")
    filters: Mapped[List["EmailFilter"]] = relationship("EmailFilter", back_populates="email_account")
    
    __table_args__ = (
        Index("idx_email_accounts_user_id", "user_id"),
        Index("idx_email_accounts_email", "email"),
    )


class EmailFolder(Base):
    """Модель папок для email"""
    __tablename__ = "email_folders"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email_account_id: Mapped[int] = mapped_column(ForeignKey("email_accounts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    parent_folder_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_folders.id"), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # HEX color
    position: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    email_account: Mapped["EmailAccount"] = relationship("EmailAccount", back_populates="folders")
    parent_folder: Mapped[Optional["EmailFolder"]] = relationship("EmailFolder", remote_side=[id])
    sub_folders: Mapped[List["EmailFolder"]] = relationship("EmailFolder", back_populates="parent_folder")
    emails: Mapped[List["EmailFolderMapping"]] = relationship("EmailFolderMapping", back_populates="folder")
    
    __table_args__ = (
        Index("idx_email_folders_account_id", "email_account_id"),
        Index("idx_email_folders_parent_id", "parent_folder_id"),
        UniqueConstraint("email_account_id", "name", name="uq_email_folder_name"),
    )


class Email(Base):
    """Модель email сообщений"""
    __tablename__ = "emails"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("email_accounts.id"), nullable=False)
    
    # Основная информация
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Метаданные
    status: Mapped[EmailStatus] = mapped_column(String(20), default=EmailStatus.DRAFT)
    priority: Mapped[EmailPriority] = mapped_column(String(20), default=EmailPriority.NORMAL)
    category: Mapped[EmailCategory] = mapped_column(String(20), default=EmailCategory.GENERAL)
    
    # Временные метки
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Дополнительные поля
    is_important: Mapped[bool] = mapped_column(Boolean, default=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Внешние заголовки
    external_headers: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    sender: Mapped["EmailAccount"] = relationship("EmailAccount", foreign_keys=[sender_id], back_populates="sent_emails")
    recipients: Mapped[List["EmailRecipient"]] = relationship("EmailRecipient", back_populates="email")
    attachments: Mapped[List["EmailAttachment"]] = relationship("EmailAttachment", back_populates="email")
    folder_mappings: Mapped[List["EmailFolderMapping"]] = relationship("EmailFolderMapping", back_populates="email")
    labels: Mapped[List["EmailLabel"]] = relationship("EmailLabel", back_populates="email")
    auto_replies: Mapped[List["EmailAutoReply"]] = relationship("EmailAutoReply", back_populates="original_email")
    
    __table_args__ = (
        Index("idx_emails_sender_id", "sender_id"),
        Index("idx_emails_status", "status"),
        Index("idx_emails_sent_at", "sent_at"),
        Index("idx_emails_category", "category"),
        Index("idx_emails_priority", "priority"),
    )


class EmailRecipient(Base):
    """Модель получателей email"""
    __tablename__ = "email_recipients"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email_id: Mapped[int] = mapped_column(ForeignKey("emails.id"), nullable=False)
    email_account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_accounts.id"), nullable=True)
    
    # Информация о получателе
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_type: Mapped[str] = mapped_column(String(20), default="to")  # to, cc, bcc
    
    # Статус доставки
    is_delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Ошибки доставки
    delivery_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    email: Mapped["Email"] = relationship("Email", back_populates="recipients")
    email_account: Mapped[Optional["EmailAccount"]] = relationship("EmailAccount", back_populates="received_emails")
    
    __table_args__ = (
        Index("idx_email_recipients_email_id", "email_id"),
        Index("idx_email_recipients_account_id", "email_account_id"),
        Index("idx_email_recipients_address", "email_address"),
    )


class EmailAttachment(Base):
    """Модель вложений email"""
    __tablename__ = "email_attachments"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email_id: Mapped[int] = mapped_column(ForeignKey("emails.id"), nullable=False)
    
    # Информация о файле
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    
    # Путь к файлу
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    # Дополнительные метаданные
    is_inline: Mapped[bool] = mapped_column(Boolean, default=False)
    content_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    email: Mapped["Email"] = relationship("Email", back_populates="attachments")
    
    __table_args__ = (
        Index("idx_email_attachments_email_id", "email_id"),
        Index("idx_email_attachments_filename", "filename"),
    )


class EmailFolderMapping(Base):
    """Модель связи email с папками"""
    __tablename__ = "email_folder_mappings"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email_id: Mapped[int] = mapped_column(ForeignKey("emails.id"), nullable=False)
    folder_id: Mapped[int] = mapped_column(ForeignKey("email_folders.id"), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    email: Mapped["Email"] = relationship("Email", back_populates="folder_mappings")
    folder: Mapped["EmailFolder"] = relationship("EmailFolder", back_populates="emails")
    
    __table_args__ = (
        Index("idx_email_folder_mappings_email_id", "email_id"),
        Index("idx_email_folder_mappings_folder_id", "folder_id"),
        UniqueConstraint("email_id", "folder_id", name="uq_email_folder_mapping"),
    )


class EmailLabel(Base):
    """Модель меток для email"""
    __tablename__ = "email_labels"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email_id: Mapped[int] = mapped_column(ForeignKey("emails.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # HEX color
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    email: Mapped["Email"] = relationship("Email", back_populates="labels")
    
    __table_args__ = (
        Index("idx_email_labels_email_id", "email_id"),
        Index("idx_email_labels_name", "name"),
    )


class EmailFilter(Base):
    """Модель фильтров для email"""
    __tablename__ = "email_filters"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email_account_id: Mapped[int] = mapped_column(ForeignKey("email_accounts.id"), nullable=False)
    
    # Настройки фильтра
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filter_type: Mapped[EmailFilterType] = mapped_column(String(20), nullable=False)
    filter_value: Mapped[str] = mapped_column(String(500), nullable=False)
    filter_condition: Mapped[str] = mapped_column(String(20), default="contains")  # contains, equals, starts_with, etc.
    
    # Действие фильтра
    action: Mapped[EmailFilterAction] = mapped_column(String(20), nullable=False)
    action_value: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Настройки
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    email_account: Mapped["EmailAccount"] = relationship("EmailAccount", back_populates="filters")
    
    __table_args__ = (
        Index("idx_email_filters_account_id", "email_account_id"),
        Index("idx_email_filters_type", "filter_type"),
        Index("idx_email_filters_active", "is_active"),
    )


class EmailAutoReply(Base):
    """Модель автоматических ответов"""
    __tablename__ = "email_auto_replies"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    original_email_id: Mapped[int] = mapped_column(ForeignKey("emails.id"), nullable=False)
    reply_email_id: Mapped[int] = mapped_column(ForeignKey("emails.id"), nullable=False)
    
    # Настройки автоответа
    trigger_type: Mapped[str] = mapped_column(String(20), default="received")  # received, read, etc.
    delay_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Статус
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    original_email: Mapped["Email"] = relationship("Email", foreign_keys=[original_email_id], back_populates="auto_replies")
    reply_email: Mapped["Email"] = relationship("Email", foreign_keys=[reply_email_id])
    
    __table_args__ = (
        Index("idx_email_auto_replies_original_id", "original_email_id"),
        Index("idx_email_auto_replies_reply_id", "reply_email_id"),
    )


class EmailTemplate(Base):
    """Модель шаблонов email"""
    __tablename__ = "email_templates"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Информация о шаблоне
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Настройки
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Переменные шаблона
    variables: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_email_templates_user_id", "user_id"),
        Index("idx_email_templates_category", "category"),
        Index("idx_email_templates_active", "is_active"),
    )
