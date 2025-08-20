"""
API для управления документами и документооборота
"""

import uuid
import hashlib
import os
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timedelta

from backend.api.configuration.auth import verify_authorization, require_role
from backend.api.configuration.server import Server
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload, joinedload

from core.database.models.document_model import (
    Document, DocumentWorkflowStep, DocumentSignature, DocumentComment, DocumentAttachment, DocumentWatcher, DocumentTemplate,
    DocumentStatus, DocumentType, DocumentPriority, DocumentVisibility
)
from core.database.models.main_models import User, Organization, Department

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Pydantic модели для API

class DocumentCreateRequest(BaseModel):
    """Запрос на создание документа"""
    title: str = Field(..., min_length=1, max_length=255, description="Название документа")
    description: Optional[str] = Field(None, description="Описание документа")
    document_type: DocumentType = Field(default=DocumentType.OTHER, description="Тип документа")
    priority: DocumentPriority = Field(default=DocumentPriority.NORMAL, description="Приоритет")
    visibility: DocumentVisibility = Field(default=DocumentVisibility.TEAM, description="Видимость")
    
    # Версионирование
    parent_document_id: Optional[int] = Field(None, description="ID родительского документа")
    
    # Временные рамки
    expires_at: Optional[datetime] = Field(None, description="Дата истечения срока действия")
    
    # Назначения
    owner_id: Optional[int] = Field(None, description="ID владельца")
    reviewer_id: Optional[int] = Field(None, description="ID рецензента")
    
    # Организация
    organization_id: Optional[int] = Field(None, description="ID организации")
    department_id: Optional[int] = Field(None, description="ID департамента")
    
    # Метаданные
    tags: Optional[List[str]] = Field(None, description="Теги")
    custom_fields: Optional[Dict[str, Any]] = Field(None, description="Пользовательские поля")

class DocumentUpdateRequest(BaseModel):
    """Запрос на обновление документа"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None)
    document_type: Optional[DocumentType] = Field(None)
    priority: Optional[DocumentPriority] = Field(None)
    visibility: Optional[DocumentVisibility] = Field(None)
    status: Optional[DocumentStatus] = Field(None)
    
    # Временные рамки
    expires_at: Optional[datetime] = Field(None)
    
    # Назначения
    owner_id: Optional[int] = Field(None)
    reviewer_id: Optional[int] = Field(None)
    
    # Метаданные
    tags: Optional[List[str]] = Field(None)
    custom_fields: Optional[Dict[str, Any]] = Field(None)

class DocumentResponse(BaseModel):
    """Ответ с данными документа"""
    id: int
    title: str
    description: Optional[str]
    document_type: str
    status: str
    priority: str
    visibility: str
    version: int
    is_latest: bool
    
    # Временные рамки
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime]
    signed_at: Optional[datetime]
    archived_at: Optional[datetime]
    
    # Метаданные
    tags: Optional[List[str]]
    custom_fields: Optional[Dict[str, Any]]
    
    # Файлы
    file_path: Optional[str]
    file_size: Optional[int]
    file_type: Optional[str]
    
    # Связи
    author_id: int
    owner_id: int
    reviewer_id: Optional[int]
    organization_id: Optional[int]
    department_id: Optional[int]
    parent_document_id: Optional[int]
    
    # Статистика
    comments_count: int = 0
    attachments_count: int = 0
    signatures_count: int = 0

class DocumentWorkflowStepRequest(BaseModel):
    """Запрос на создание шага workflow"""
    step_number: int = Field(..., ge=1, description="Порядковый номер шага")
    step_name: str = Field(..., min_length=1, max_length=255, description="Название шага")
    step_type: str = Field(..., description="Тип шага: review, approve, sign")
    assigned_user_id: Optional[int] = Field(None, description="ID назначенного пользователя")
    assigned_role: Optional[str] = Field(None, description="Роль для назначения")
    due_date: Optional[datetime] = Field(None, description="Срок выполнения")

class DocumentSignatureRequest(BaseModel):
    """Запрос на подписание документа"""
    signature_type: str = Field(default="digital", description="Тип подписи: digital, electronic, physical")
    signature_data: Optional[str] = Field(None, description="Данные подписи")
    certificate_info: Optional[Dict[str, Any]] = Field(None, description="Информация о сертификате")
    expires_at: Optional[datetime] = Field(None, description="Дата истечения подписи")

class DocumentCommentRequest(BaseModel):
    """Запрос на создание комментария"""
    content: str = Field(..., min_length=1, description="Содержание комментария")
    is_internal: bool = Field(default=False, description="Внутренний комментарий")
    page_number: Optional[int] = Field(None, ge=1, description="Номер страницы")
    line_number: Optional[int] = Field(None, ge=1, description="Номер строки")
    selection_text: Optional[str] = Field(None, description="Выделенный текст")

# Вспомогательные функции

async def _can_view_document(document: Document, user: User, session: AsyncSession) -> bool:
    """Проверяет права на просмотр документа"""
    # Автор, владелец и рецензент могут просматривать
    if document.author_id == user.id or document.owner_id == user.id or document.reviewer_id == user.id:
        return True
    
    # Проверяем видимость
    if document.visibility == DocumentVisibility.PUBLIC:
        return True
    
    if document.visibility == DocumentVisibility.PRIVATE:
        return False
    
    if document.visibility == DocumentVisibility.TEAM:
        # Логика для команды
        return True
    
    if document.visibility == DocumentVisibility.DEPARTMENT:
        if document.department_id and user.department_id == document.department_id:
            return True
    
    if document.visibility == DocumentVisibility.ORGANIZATION:
        if document.organization_id and user.organization_id == document.organization_id:
            return True
    
    # Администраторы имеют доступ ко всем документам
    if user.role in ["admin", "CEO"]:
        return True
    
    return False

async def _can_edit_document(document: Document, user: User, session: AsyncSession) -> bool:
    """Проверяет права на редактирование документа"""
    # Автор и владелец могут редактировать
    if document.author_id == user.id or document.owner_id == user.id:
        return True
    
    # Администраторы могут редактировать
    if user.role in ["admin", "CEO"]:
        return True
    
    return False

async def _can_delete_document(document: Document, user: User, session: AsyncSession) -> bool:
    """Проверяет права на удаление документа"""
    # Только автор или администраторы могут удалять
    if document.author_id == user.id:
        return True
    
    if user.role in ["admin", "CEO"]:
        return True
    
    return False

def _format_document_response(document: Document, comments_count: int = 0, attachments_count: int = 0, signatures_count: int = 0) -> DocumentResponse:
    """Форматирует ответ с данными документа"""
    return DocumentResponse(
        id=document.id,
        title=document.title,
        description=document.description,
        document_type=document.document_type.value,
        status=document.status.value,
        priority=document.priority.value,
        visibility=document.visibility.value,
        version=document.version,
        is_latest=document.is_latest,
        created_at=document.created_at,
        updated_at=document.updated_at,
        expires_at=document.expires_at,
        signed_at=document.signed_at,
        archived_at=document.archived_at,
        tags=document.tags,
        custom_fields=document.custom_fields,
        file_path=document.file_path,
        file_size=document.file_size,
        file_type=document.file_type,
        author_id=document.author_id,
        owner_id=document.owner_id,
        reviewer_id=document.reviewer_id,
        organization_id=document.organization_id,
        department_id=document.department_id,
        parent_document_id=document.parent_document_id,
        comments_count=comments_count,
        attachments_count=attachments_count,
        signatures_count=signatures_count
    )

# API эндпоинты

@router.post("/", response_model=DocumentResponse)
async def create_document(
    request: DocumentCreateRequest,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Создание нового документа"""
    try:
        # Создаем документ
        document = Document(
            title=request.title,
            description=request.description,
            document_type=request.document_type,
            priority=request.priority,
            visibility=request.visibility,
            parent_document_id=request.parent_document_id,
            expires_at=request.expires_at,
            author_id=user.id,
            owner_id=request.owner_id or user.id,
            reviewer_id=request.reviewer_id,
            organization_id=request.organization_id or user.organization_id,
            department_id=request.department_id or user.department_id,
            tags=request.tags,
            custom_fields=request.custom_fields
        )
        
        session.add(document)
        await session.commit()
        await session.refresh(document)
        
        return _format_document_response(document)
        
    except Exception as e:
        await session.rollback()
        logger.error(f"Error creating document: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[DocumentResponse])
async def get_documents(
    skip: int = Query(0, ge=0, description="Количество записей для пропуска"),
    limit: int = Query(100, ge=1, le=1000, description="Максимальное количество записей"),
    status: Optional[DocumentStatus] = Query(None, description="Фильтр по статусу"),
    document_type: Optional[DocumentType] = Query(None, description="Фильтр по типу"),
    priority: Optional[DocumentPriority] = Query(None, description="Фильтр по приоритету"),
    author_id: Optional[int] = Query(None, description="Фильтр по автору"),
    owner_id: Optional[int] = Query(None, description="Фильтр по владельцу"),
    organization_id: Optional[int] = Query(None, description="Фильтр по организации"),
    department_id: Optional[int] = Query(None, description="Фильтр по департаменту"),
    search: Optional[str] = Query(None, description="Поиск по названию и описанию"),
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение списка документов с фильтрацией"""
    try:
        # Базовый запрос
        query = select(Document).where(Document.is_latest == True)
        
        # Применяем фильтры
        if status:
            query = query.where(Document.status == status)
        if document_type:
            query = query.where(Document.document_type == document_type)
        if priority:
            query = query.where(Document.priority == priority)
        if author_id:
            query = query.where(Document.author_id == author_id)
        if owner_id:
            query = query.where(Document.owner_id == owner_id)
        if organization_id:
            query = query.where(Document.organization_id == organization_id)
        if department_id:
            query = query.where(Document.department_id == department_id)
        
        # Поиск
        if search:
            search_filter = or_(
                Document.title.ilike(f"%{search}%"),
                Document.description.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
        
        # Фильтр по правам доступа
        access_filter = or_(
            Document.author_id == user.id,
            Document.owner_id == user.id,
            Document.reviewer_id == user.id,
            Document.visibility == DocumentVisibility.PUBLIC,
            Document.visibility == DocumentVisibility.ORGANIZATION,
            Document.visibility == DocumentVisibility.DEPARTMENT
        )
        query = query.where(access_filter)
        
        # Сортировка и пагинация
        query = query.order_by(desc(Document.updated_at)).offset(skip).limit(limit)
        
        result = await session.execute(query)
        documents = result.scalars().all()
        
        # Форматируем ответ
        formatted_documents = []
        for doc in documents:
            formatted_documents.append(_format_document_response(doc))
        
        return formatted_documents
        
    except Exception as e:
        logger.error(f"Error getting documents: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение документа по ID"""
    try:
        # Получаем документ с загрузкой связанных данных
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права доступа
        if not await _can_view_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Получаем статистику
        comments_count = len(document.comments) if document.comments else 0
        attachments_count = len(document.attachments) if document.attachments else 0
        signatures_count = len(document.signatures) if document.signatures else 0
        
        return _format_document_response(document, comments_count, attachments_count, signatures_count)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    request: DocumentUpdateRequest,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Обновление документа"""
    try:
        # Получаем документ
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права на редактирование
        if not await _can_edit_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Обновляем поля
        if request.title is not None:
            document.title = request.title
        if request.description is not None:
            document.description = request.description
        if request.document_type is not None:
            document.document_type = request.document_type
        if request.priority is not None:
            document.priority = request.priority
        if request.visibility is not None:
            document.visibility = request.visibility
        if request.status is not None:
            document.status = request.status
        if request.expires_at is not None:
            document.expires_at = request.expires_at
        if request.owner_id is not None:
            document.owner_id = request.owner_id
        if request.reviewer_id is not None:
            document.reviewer_id = request.reviewer_id
        if request.tags is not None:
            document.tags = request.tags
        if request.custom_fields is not None:
            document.custom_fields = request.custom_fields
        
        document.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(document)
        
        return _format_document_response(document)
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.error(f"Error updating document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Удаление документа"""
    try:
        # Получаем документ
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права на удаление
        if not await _can_delete_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Удаляем документ
        await session.delete(document)
        await session.commit()
        
        return {"message": "Document deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.error(f"Error deleting document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{document_id}/workflow", response_model=Dict[str, Any])
async def create_workflow_step(
    document_id: int,
    request: DocumentWorkflowStepRequest,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Создание шага workflow для документа"""
    try:
        # Получаем документ
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права
        if not await _can_edit_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Создаем шаг workflow
        workflow_step = DocumentWorkflowStep(
            document_id=document_id,
            step_number=request.step_number,
            step_name=request.step_name,
            step_type=request.step_type,
            assigned_user_id=request.assigned_user_id,
            assigned_role=request.assigned_role,
            due_date=request.due_date
        )
        
        session.add(workflow_step)
        await session.commit()
        await session.refresh(workflow_step)
        
        return {
            "id": workflow_step.id,
            "step_number": workflow_step.step_number,
            "step_name": workflow_step.step_name,
            "status": workflow_step.status,
            "message": "Workflow step created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.error(f"Error creating workflow step: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{document_id}/sign", response_model=Dict[str, Any])
async def sign_document(
    document_id: int,
    request: DocumentSignatureRequest,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Подписание документа"""
    try:
        # Получаем документ
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права
        if not await _can_edit_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Создаем подпись
        signature = DocumentSignature(
            document_id=document_id,
            signer_id=user.id,
            signature_type=request.signature_type,
            signature_data=request.signature_data,
            certificate_info=request.certificate_info,
            expires_at=request.expires_at
        )
        
        session.add(signature)
        
        # Обновляем статус документа
        document.status = DocumentStatus.SIGNED
        document.signed_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(signature)
        
        return {
            "id": signature.id,
            "signed_at": signature.signed_at,
            "message": "Document signed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.error(f"Error signing document: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{document_id}/comments", response_model=Dict[str, Any])
async def add_comment(
    document_id: int,
    request: DocumentCommentRequest,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Добавление комментария к документу"""
    try:
        # Получаем документ
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права на просмотр
        if not await _can_view_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Создаем комментарий
        comment = DocumentComment(
            document_id=document_id,
            author_id=user.id,
            content=request.content,
            is_internal=request.is_internal,
            page_number=request.page_number,
            line_number=request.line_number,
            selection_text=request.selection_text
        )
        
        session.add(comment)
        await session.commit()
        await session.refresh(comment)
        
        return {
            "id": comment.id,
            "content": comment.content,
            "created_at": comment.created_at,
            "message": "Comment added successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.error(f"Error adding comment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{document_id}/versions", response_model=List[DocumentResponse])
async def get_document_versions(
    document_id: int,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение всех версий документа"""
    try:
        # Получаем документ
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права на просмотр
        if not await _can_view_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Получаем все версии
        versions_query = select(Document).where(
            or_(
                Document.id == document_id,
                Document.parent_document_id == document_id
            )
        ).order_by(desc(Document.version))
        
        result = await session.execute(versions_query)
        versions = result.scalars().all()
        
        formatted_versions = []
        for version in versions:
            formatted_versions.append(_format_document_response(version))
        
        return formatted_versions
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document versions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{document_id}/archive")
async def archive_document(
    document_id: int,
    user: User = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Архивирование документа"""
    try:
        # Получаем документ
        query = select(Document).where(Document.id == document_id)
        result = await session.execute(query)
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Проверяем права
        if not await _can_edit_document(document, user, session):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Архивируем документ
        document.status = DocumentStatus.ARCHIVED
        document.archived_at = datetime.utcnow()
        document.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(document)
        
        return {
            "message": "Document archived successfully",
            "archived_at": document.archived_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.error(f"Error archiving document: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
