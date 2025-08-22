"""
Модели данных для системы видеозвонков
"""
from datetime import datetime, timedelta
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


class CallType(str, Enum):
    """Типы звонков"""
    AUDIO = "audio"
    VIDEO = "video"
    SCREEN_SHARE = "screen_share"
    CONFERENCE = "conference"


class CallStatus(str, Enum):
    """Статусы звонков"""
    INITIATED = "initiated"
    RINGING = "ringing"
    CONNECTED = "connected"
    IN_PROGRESS = "in_progress"
    ENDED = "ended"
    MISSED = "missed"
    REJECTED = "rejected"
    BUSY = "busy"
    FAILED = "failed"


class ParticipantStatus(str, Enum):
    """Статусы участников"""
    INVITED = "invited"
    JOINED = "joined"
    LEFT = "left"
    REJECTED = "rejected"
    BUSY = "busy"
    NOT_AVAILABLE = "not_available"


class RecordingStatus(str, Enum):
    """Статусы записи"""
    NOT_STARTED = "not_started"
    RECORDING = "recording"
    PAUSED = "paused"
    STOPPED = "stopped"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class VideoCall(Base):
    """Модель видеозвонка"""
    __tablename__ = "video_calls"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    call_uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    
    # Основная информация
    call_type: Mapped[CallType] = mapped_column(String(20), nullable=False)
    status: Mapped[CallStatus] = mapped_column(String(20), default=CallStatus.INITIATED)
    
    # Инициатор звонка
    initiator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Настройки звонка
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    is_recorded: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # WebRTC настройки
    room_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Временные метки
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Метаданные
    call_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    initiator: Mapped["User"] = relationship("User")
    participants: Mapped[List["CallParticipant"]] = relationship("CallParticipant", back_populates="call")
    recordings: Mapped[List["CallRecording"]] = relationship("CallRecording", back_populates="call")
    scheduled_meeting: Mapped[Optional["ScheduledMeeting"]] = relationship("ScheduledMeeting", back_populates="video_call")
    
    __table_args__ = (
        Index("idx_video_calls_initiator_id", "initiator_id"),
        Index("idx_video_calls_status", "status"),
        Index("idx_video_calls_started_at", "started_at"),
        Index("idx_video_calls_room_id", "room_id"),
    )


class CallParticipant(Base):
    """Модель участника звонка"""
    __tablename__ = "call_participants"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    call_id: Mapped[int] = mapped_column(ForeignKey("video_calls.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Статус участника
    status: Mapped[ParticipantStatus] = mapped_column(String(20), default=ParticipantStatus.INVITED)
    
    # WebRTC информация
    peer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stream_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Настройки участника
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_video_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_screen_sharing: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Временные метки
    invited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    joined_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Статистика
    connection_quality: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # good, poor, excellent
    bandwidth_usage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # bytes per second
    
    # Отношения
    call: Mapped["VideoCall"] = relationship("VideoCall", back_populates="participants")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_call_participants_call_id", "call_id"),
        Index("idx_call_participants_user_id", "user_id"),
        Index("idx_call_participants_status", "status"),
        UniqueConstraint("call_id", "user_id", name="uq_call_participant"),
    )


class CallRecording(Base):
    """Модель записи звонка"""
    __tablename__ = "call_recordings"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    call_id: Mapped[int] = mapped_column(ForeignKey("video_calls.id"), nullable=False)
    
    # Информация о записи
    recording_uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    status: Mapped[RecordingStatus] = mapped_column(String(20), default=RecordingStatus.NOT_STARTED)
    
    # Файлы записи
    video_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    audio_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Метаданные записи
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resolution: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # 720p, 1080p, etc.
    format: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # mp4, webm, etc.
    
    # Настройки записи
    record_video: Mapped[bool] = mapped_column(Boolean, default=True)
    record_audio: Mapped[bool] = mapped_column(Boolean, default=True)
    record_screen: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Временные метки
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    stopped_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Обработка ошибок
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    call: Mapped["VideoCall"] = relationship("VideoCall", back_populates="recordings")
    
    __table_args__ = (
        Index("idx_call_recordings_call_id", "call_id"),
        Index("idx_call_recordings_status", "status"),
        Index("idx_call_recordings_started_at", "started_at"),
    )


class ScheduledMeeting(Base):
    """Модель запланированной встречи"""
    __tablename__ = "scheduled_meetings"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    meeting_uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    
    # Основная информация
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Организатор
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Время встречи
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    
    # Настройки встречи
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_pattern: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # daily, weekly, monthly
    max_participants: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Настройки видеозвонка
    auto_start_video: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_start_audio: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_join_before_host: Mapped[bool] = mapped_column(Boolean, default=True)
    mute_participants_on_entry: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Статус встречи
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Ссылка на видеозвонок
    video_call_id: Mapped[Optional[int]] = mapped_column(ForeignKey("video_calls.id"), nullable=True)
    
    # Метаданные
    meeting_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    password: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    organizer: Mapped["User"] = relationship("User")
    video_call: Mapped[Optional["VideoCall"]] = relationship("VideoCall", back_populates="scheduled_meeting")
    participants: Mapped[List["MeetingParticipant"]] = relationship("MeetingParticipant", back_populates="meeting")
    reminders: Mapped[List["MeetingReminder"]] = relationship("MeetingReminder", back_populates="meeting")
    
    __table_args__ = (
        Index("idx_scheduled_meetings_organizer_id", "organizer_id"),
        Index("idx_scheduled_meetings_start_time", "start_time"),
        Index("idx_scheduled_meetings_is_active", "is_active"),
        Index("idx_scheduled_meetings_video_call_id", "video_call_id"),
    )


class MeetingParticipant(Base):
    """Модель участника запланированной встречи"""
    __tablename__ = "meeting_participants"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("scheduled_meetings.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Статус участия
    response_status: Mapped[str] = mapped_column(String(20), default="pending")  # accepted, declined, pending, tentative
    
    # Роль участника
    role: Mapped[str] = mapped_column(String(20), default="attendee")  # organizer, co-organizer, attendee
    
    # Настройки уведомлений
    send_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder_minutes: Mapped[int] = mapped_column(Integer, default=15)
    
    # Временные метки
    invited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    joined_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    meeting: Mapped["ScheduledMeeting"] = relationship("ScheduledMeeting", back_populates="participants")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_meeting_participants_meeting_id", "meeting_id"),
        Index("idx_meeting_participants_user_id", "user_id"),
        Index("idx_meeting_participants_response_status", "response_status"),
        UniqueConstraint("meeting_id", "user_id", name="uq_meeting_participant"),
    )


class MeetingReminder(Base):
    """Модель напоминания о встрече"""
    __tablename__ = "meeting_reminders"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("scheduled_meetings.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Настройки напоминания
    reminder_type: Mapped[str] = mapped_column(String(20), default="email")  # email, push, sms
    reminder_minutes: Mapped[int] = mapped_column(Integer, default=15)
    
    # Статус напоминания
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Время отправки
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    meeting: Mapped["ScheduledMeeting"] = relationship("ScheduledMeeting", back_populates="reminders")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_meeting_reminders_meeting_id", "meeting_id"),
        Index("idx_meeting_reminders_user_id", "user_id"),
        Index("idx_meeting_reminders_scheduled_at", "scheduled_at"),
        Index("idx_meeting_reminders_is_sent", "is_sent"),
    )


class CallStatistics(Base):
    """Модель статистики звонков"""
    __tablename__ = "call_statistics"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    call_id: Mapped[int] = mapped_column(ForeignKey("video_calls.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Статистика соединения
    connection_quality: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    packet_loss: Mapped[Optional[float]] = mapped_column(Integer, nullable=True)  # percentage
    latency: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # milliseconds
    jitter: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # milliseconds
    
    # Статистика медиа
    video_bitrate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # kbps
    audio_bitrate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # kbps
    frame_rate: Mapped[Optional[float]] = mapped_column(Integer, nullable=True)  # fps
    resolution: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Временные метки
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    call: Mapped["VideoCall"] = relationship("VideoCall")
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_call_statistics_call_id", "call_id"),
        Index("idx_call_statistics_user_id", "user_id"),
        Index("idx_call_statistics_recorded_at", "recorded_at"),
    )


class CallTemplate(Base):
    """Модель шаблона звонка"""
    __tablename__ = "call_templates"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Информация о шаблоне
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Настройки звонка
    call_type: Mapped[CallType] = mapped_column(String(20), nullable=False)
    auto_start_video: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_start_audio: Mapped[bool] = mapped_column(Boolean, default=False)
    mute_participants_on_entry: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_join_before_host: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Настройки записи
    auto_record: Mapped[bool] = mapped_column(Boolean, default=False)
    record_video: Mapped[bool] = mapped_column(Boolean, default=True)
    record_audio: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Ограничения
    max_participants: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Настройки
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    user: Mapped["User"] = relationship("User")
    
    __table_args__ = (
        Index("idx_call_templates_user_id", "user_id"),
        Index("idx_call_templates_is_active", "is_active"),
    )
