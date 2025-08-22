"""
Модели данных для системы корпоративных чатов
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


class ChatType(str, Enum):
    """Типы чатов"""
    PRIVATE = "private"
    GROUP = "group"
    CHANNEL = "channel"
    BROADCAST = "broadcast"


class MessageType(str, Enum):
    """Типы сообщений"""
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    FILE = "file"
    LOCATION = "location"
    CONTACT = "contact"
    SYSTEM = "system"
    REPLY = "reply"
    FORWARD = "forward"


class MessageStatus(str, Enum):
    """Статусы сообщений"""
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    EDITED = "edited"
    DELETED = "deleted"


class ChatRole(str, Enum):
    """Роли в чате"""
    OWNER = "owner"
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"
    GUEST = "guest"


class Chat(Base):
    """Модель чата"""
    __tablename__ = "chats"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    
    # Основная информация
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chat_type: Mapped[ChatType] = mapped_column(String(20), nullable=False)
    
    # Настройки чата
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Метаданные
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    background_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # HEX color
    
    # Статистика
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Временные метки
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    members: Mapped[List["ChatMember"]] = relationship("ChatMember", back_populates="chat")
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="chat")
    pinned_messages: Mapped[List["PinnedMessage"]] = relationship("PinnedMessage", back_populates="chat")
    
    __table_args__ = (
        Index("idx_chats_type", "chat_type"),
        Index("idx_chats_private", "is_private"),
        Index("idx_chats_last_message", "last_message_at"),
    )


class ChatMember(Base):
    """Модель участника чата"""
    __tablename__ = "chat_members"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Роль и права
    role: Mapped[ChatRole] = mapped_column(String(20), default=ChatRole.MEMBER)
    permissions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Статус участника
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Настройки уведомлений
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sound_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Временные метки
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    chat: Mapped["Chat"] = relationship("Chat", back_populates="members")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_chat_members_chat_id", "chat_id"),
        Index("idx_chat_members_user_id", "user_id"),
        Index("idx_chat_members_role", "role"),
        UniqueConstraint("chat_id", "user_id", name="uq_chat_member"),
    )


class ChatMessage(Base):
    """Модель сообщения в чате"""
    __tablename__ = "chat_messages"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    message_uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id"), nullable=False)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Содержимое сообщения
    message_type: Mapped[MessageType] = mapped_column(String(20), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Статус сообщения
    status: Mapped[MessageStatus] = mapped_column(String(20), default=MessageStatus.SENT)
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Ссылки на другие сообщения
    reply_to_message_id: Mapped[Optional[int]] = mapped_column(ForeignKey("chat_messages.id"), nullable=True)
    forward_from_message_id: Mapped[Optional[int]] = mapped_column(ForeignKey("chat_messages.id"), nullable=True)
    
    # Временные метки
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    chat: Mapped["Chat"] = relationship("Chat", back_populates="messages")
    sender: Mapped["User"] = relationship("User")
    reply_to_message: Mapped[Optional["ChatMessage"]] = relationship("ChatMessage", remote_side=[id], foreign_keys=[reply_to_message_id])
    forward_from_message: Mapped[Optional["ChatMessage"]] = relationship("ChatMessage", remote_side=[id], foreign_keys=[forward_from_message_id])
    attachments: Mapped[List["MessageAttachment"]] = relationship("MessageAttachment", back_populates="message")
    reactions: Mapped[List["MessageReaction"]] = relationship("MessageReaction", back_populates="message")
    read_by: Mapped[List["MessageRead"]] = relationship("MessageRead", back_populates="message")
    
    __table_args__ = (
        Index("idx_chat_messages_chat_id", "chat_id"),
        Index("idx_chat_messages_sender_id", "sender_id"),
        Index("idx_chat_messages_type", "message_type"),
        Index("idx_chat_messages_sent_at", "sent_at"),
        Index("idx_chat_messages_status", "status"),
    )


class MessageAttachment(Base):
    """Модель вложения сообщения"""
    __tablename__ = "message_attachments"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("chat_messages.id"), nullable=False)
    
    # Информация о файле
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Метаданные файла
    file_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Дополнительные данные для медиа
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # для аудио/видео
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # для изображений/видео
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # для изображений/видео
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    message: Mapped["ChatMessage"] = relationship("ChatMessage", back_populates="attachments")
    
    __table_args__ = (
        Index("idx_message_attachments_message_id", "message_id"),
        Index("idx_message_attachments_mime_type", "mime_type"),
    )


class MessageReaction(Base):
    """Модель реакции на сообщение"""
    __tablename__ = "message_reactions"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("chat_messages.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Реакция
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)  # Unicode emoji
    reaction_type: Mapped[str] = mapped_column(String(20), default="emoji")  # emoji, custom, etc.
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    message: Mapped["ChatMessage"] = relationship("ChatMessage", back_populates="reactions")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_message_reactions_message_id", "message_id"),
        Index("idx_message_reactions_user_id", "user_id"),
        UniqueConstraint("message_id", "user_id", "emoji", name="uq_message_reaction"),
    )


class MessageRead(Base):
    """Модель прочтения сообщения"""
    __tablename__ = "message_reads"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("chat_messages.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    read_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    message: Mapped["ChatMessage"] = relationship("ChatMessage", back_populates="read_by")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_message_reads_message_id", "message_id"),
        Index("idx_message_reads_user_id", "user_id"),
        UniqueConstraint("message_id", "user_id", name="uq_message_read"),
    )


class PinnedMessage(Base):
    """Модель закрепленного сообщения"""
    __tablename__ = "pinned_messages"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id"), nullable=False)
    message_id: Mapped[int] = mapped_column(ForeignKey("chat_messages.id"), nullable=False)
    pinned_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    pinned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    chat: Mapped["Chat"] = relationship("Chat", back_populates="pinned_messages")
    message: Mapped["ChatMessage"] = relationship("ChatMessage")
    pinned_by: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_pinned_messages_chat_id", "chat_id"),
        Index("idx_pinned_messages_message_id", "message_id"),
        UniqueConstraint("chat_id", "message_id", name="uq_pinned_message"),
    )


class ChatInvitation(Base):
    """Модель приглашения в чат"""
    __tablename__ = "chat_invitations"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id"), nullable=False)
    invited_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    invited_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Статус приглашения
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_declined: Mapped[bool] = mapped_column(Boolean, default=False)
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Метаданные
    invitation_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    declined_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    chat: Mapped["Chat"] = relationship("Chat")
    invited_by: Mapped["User"] = relationship("User", foreign_keys=[invited_by_id])
    invited_user: Mapped["User"] = relationship("User", foreign_keys=[invited_user_id])
    
    __table_args__ = (
        Index("idx_chat_invitations_chat_id", "chat_id"),
        Index("idx_chat_invitations_invited_user_id", "invited_user_id"),
        Index("idx_chat_invitations_status", "is_accepted", "is_declined", "is_expired"),
    )


class ChatSettings(Base):
    """Модель настроек чата"""
    __tablename__ = "chat_settings"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id"), nullable=False)
    
    # Настройки чата
    allow_member_invites: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_message_editing: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_message_deletion: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_file_sharing: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_reactions: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Ограничения
    max_file_size: Mapped[int] = mapped_column(Integer, default=10485760)  # 10MB
    max_message_length: Mapped[int] = mapped_column(Integer, default=4096)
    slow_mode_interval: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # секунды
    
    # Автоматические действия
    auto_delete_messages: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_delete_after_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    chat: Mapped["Chat"] = relationship("Chat")
    
    __table_args__ = (
        Index("idx_chat_settings_chat_id", "chat_id"),
        UniqueConstraint("chat_id", name="uq_chat_settings"),
    )


class UserChatPreference(Base):
    """Модель пользовательских настроек чата"""
    __tablename__ = "user_chat_preferences"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id"), nullable=False)
    
    # Настройки уведомлений
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sound_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    vibration_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Настройки отображения
    theme: Mapped[str] = mapped_column(String(20), default="default")
    font_size: Mapped[str] = mapped_column(String(20), default="medium")
    
    # Дополнительные настройки
    auto_download_media: Mapped[bool] = mapped_column(Boolean, default=True)
    show_read_receipts: Mapped[bool] = mapped_column(Boolean, default=True)
    show_typing_indicators: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    user: Mapped["User"] = relationship("User")
    chat: Mapped["Chat"] = relationship("Chat")
    
    __table_args__ = (
        Index("idx_user_chat_preferences_user_id", "user_id"),
        Index("idx_user_chat_preferences_chat_id", "chat_id"),
        UniqueConstraint("user_id", "chat_id", name="uq_user_chat_preference"),
    )
