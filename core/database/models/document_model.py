# модели для документооборота
from typing import List, Optional, Dict, Any
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean, Text, JSON, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from enum import Enum

from core.database.base import Base


class DocumentStatus(str, Enum):
    """Статусы документов"""
    DRAFT = "draft"  # Черновик
    PENDING_REVIEW = "pending_review"  # Ожидает проверки
    IN_REVIEW = "in_review"  # На проверке
    APPROVED = "approved"  # Одобрен
    REJECTED = "rejected"  # Отклонен
    SIGNED = "signed"  # Подписан
    ARCHIVED = "archived"  # В архиве
    EXPIRED = "expired"  # Истек срок действия


class DocumentType(str, Enum):
    """Типы документов"""
    CONTRACT = "contract"  # Договор
    AGREEMENT = "agreement"  # Соглашение
    POLICY = "policy"  # Политика
    PROCEDURE = "procedure"  # Процедура
    REPORT = "report"  # Отчет
    MEMO = "memo"  # Меморандум
    LETTER = "letter"  # Письмо
    FORM = "form"  # Форма
    TEMPLATE = "template"  # Шаблон
    OTHER = "other"  # Другое


class DocumentPriority(str, Enum):
    """Приоритеты документов"""
    LOW = "low"  # Низкий
    NORMAL = "normal"  # Обычный
    HIGH = "high"  # Высокий
    URGENT = "urgent"  # Срочный
    CRITICAL = "critical"  # Критический


class DocumentVisibility(str, Enum):
    """Видимость документов"""
    PUBLIC = "public"  # Публичный
    PRIVATE = "private"  # Приватный
    TEAM = "team"  # Команда
    DEPARTMENT = "department"  # Департамент
    ORGANIZATION = "organization"  # Организация
    CONFIDENTIAL = "confidential"  # Конфиденциальный


class Document(Base):
    """Модель для хранения информации о документах."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    document_type: Mapped[DocumentType] = mapped_column(SQLEnum(DocumentType), default=DocumentType.OTHER, index=True)
    status: Mapped[DocumentStatus] = mapped_column(SQLEnum(DocumentStatus), default=DocumentStatus.DRAFT, index=True)
    priority: Mapped[DocumentPriority] = mapped_column(SQLEnum(DocumentPriority), default=DocumentPriority.NORMAL, index=True)
    visibility: Mapped[DocumentVisibility] = mapped_column(SQLEnum(DocumentVisibility), default=DocumentVisibility.TEAM)
    
    # Версионирование
    version: Mapped[int] = mapped_column(Integer, default=1, index=True)
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    parent_document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    
    # Временные рамки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Метаданные
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    document_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Дополнительные метаданные
    
    # Файлы
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Путь к файлу
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)  # Размер файла в байтах
    file_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # MIME тип файла
    checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # SHA256 хеш файла
    
    # Связи с пользователями
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    reviewer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    
    # Связи с организацией
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    
    # Отношения
    author: Mapped["User"] = relationship("User", back_populates="authored_documents", foreign_keys=[author_id])
    owner: Mapped["User"] = relationship("User", back_populates="owned_documents", foreign_keys=[owner_id])
    reviewer: Mapped[Optional["User"]] = relationship("User", back_populates="reviewed_documents", foreign_keys=[reviewer_id])
    
    # Иерархические отношения
    parent_document: Mapped[Optional["Document"]] = relationship("Document", back_populates="versions", foreign_keys=[parent_document_id], remote_side=[id])
    versions: Mapped[List["Document"]] = relationship("Document", back_populates="parent_document", foreign_keys=[parent_document_id])
    
    # Организационные отношения
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="documents")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="documents")
    
    # Дополнительные отношения
    workflow_steps: Mapped[List["DocumentWorkflowStep"]] = relationship("DocumentWorkflowStep", back_populates="document", cascade="all, delete-orphan")
    signatures: Mapped[List["DocumentSignature"]] = relationship("DocumentSignature", back_populates="document", cascade="all, delete-orphan")
    comments: Mapped[List["DocumentComment"]] = relationship("DocumentComment", back_populates="document", cascade="all, delete-orphan")
    attachments: Mapped[List["DocumentAttachment"]] = relationship("DocumentAttachment", back_populates="document", cascade="all, delete-orphan")
    watchers: Mapped[List["DocumentWatcher"]] = relationship("DocumentWatcher", back_populates="document", cascade="all, delete-orphan")


class DocumentWorkflowStep(Base):
    """Модель для хранения шагов workflow документа"""
    __tablename__ = "document_workflow_steps"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)  # Порядковый номер шага
    step_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Название шага
    step_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Тип шага: review, approve, sign
    
    # Участники
    assigned_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Роль для назначения
    
    # Статус шага
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, in_progress, completed, skipped
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Комментарии и решения
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decision: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # approve, reject, request_changes
    
    # Временные рамки
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    document: Mapped["Document"] = relationship("Document", back_populates="workflow_steps")
    assigned_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_user_id])
    completed_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[completed_by])


class DocumentSignature(Base):
    """Модель для хранения подписей документов"""
    __tablename__ = "document_signatures"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    signer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Информация о подписи
    signature_type: Mapped[str] = mapped_column(String(50), default="digital")  # digital, electronic, physical
    signature_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Данные подписи
    signature_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # Хеш подписи
    
    # Сертификат
    certificate_info: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Информация о сертификате
    
    # Временные рамки
    signed_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # IP и устройство
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)  # IPv4 или IPv6
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Отношения
    document: Mapped["Document"] = relationship("Document", back_populates="signatures")
    signer: Mapped["User"] = relationship("User", back_populates="document_signatures")


class DocumentComment(Base):
    """Модель для комментариев к документам"""
    __tablename__ = "document_comments"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Содержание комментария
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)  # Внутренний комментарий
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)  # Решен ли комментарий
    
    # Привязка к части документа
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    line_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    selection_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Выделенный текст
    
    # Временные рамки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Отношения
    document: Mapped["Document"] = relationship("Document", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="document_comments")


class DocumentAttachment(Base):
    """Модель для вложений к документам"""
    __tablename__ = "document_attachments"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Информация о файле
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)  # MIME тип
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA256 хеш
    
    # Метаданные
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    
    # Временные рамки
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Отношения
    document: Mapped["Document"] = relationship("Document", back_populates="attachments")
    user: Mapped["User"] = relationship("User", back_populates="document_attachments")


class DocumentWatcher(Base):
    """Модель для наблюдателей за документами"""
    __tablename__ = "document_watchers"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Настройки уведомлений
    notification_preferences: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Временные рамки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Отношения
    document: Mapped["Document"] = relationship("Document", back_populates="watchers")
    user: Mapped["User"] = relationship("User", back_populates="document_watchers")


class DocumentTemplate(Base):
    """Модель для шаблонов документов"""
    __tablename__ = "document_templates"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    document_type: Mapped[DocumentType] = mapped_column(SQLEnum(DocumentType), default=DocumentType.TEMPLATE)
    
    # Шаблонные поля
    template_fields: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)  # Поля шаблона
    template_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Путь к файлу шаблона
    
    # Workflow шаблона
    workflow_template: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Шаблон workflow
    
    # Связи
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    
    # Статус
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Отношения
    created_by_user: Mapped["User"] = relationship("User", back_populates="document_templates")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="document_templates")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="document_templates")
