"""
API роутер для корпоративной почты
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.database import get_session
from core.database.models.email_model import (
    EmailStatus, EmailPriority, EmailCategory, EmailFilterType, EmailFilterAction
)
from backend.api.services.email_service import EmailService
from backend.api.middleware.auth import get_current_user
from core.database.models.user_model import User

router = APIRouter(prefix="/email", tags=["Email"])


# Pydantic модели для запросов и ответов

class EmailAccountCreateRequest(BaseModel):
    email: EmailStr = Field(..., description="Email адрес")
    display_name: Optional[str] = Field(None, description="Отображаемое имя")
    smtp_config: Optional[Dict[str, Any]] = Field(None, description="Настройки SMTP")
    imap_config: Optional[Dict[str, Any]] = Field(None, description="Настройки IMAP")


class EmailAccountUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, description="Отображаемое имя")
    signature: Optional[str] = Field(None, description="Подпись")
    auto_reply_message: Optional[str] = Field(None, description="Сообщение автоответа")
    auto_reply_enabled: Optional[bool] = Field(None, description="Включить автоответ")
    smtp_config: Optional[Dict[str, Any]] = Field(None, description="Настройки SMTP")
    imap_config: Optional[Dict[str, Any]] = Field(None, description="Настройки IMAP")


class EmailAccountResponse(BaseModel):
    id: int
    email: str
    display_name: Optional[str]
    is_primary: bool
    is_active: bool
    signature: Optional[str]
    auto_reply_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmailRecipientRequest(BaseModel):
    email: EmailStr = Field(..., description="Email адрес получателя")
    display_name: Optional[str] = Field(None, description="Отображаемое имя")
    type: str = Field("to", description="Тип получателя (to, cc, bcc)")


class EmailCreateRequest(BaseModel):
    subject: str = Field(..., description="Тема письма")
    body_text: Optional[str] = Field(None, description="Текстовое тело письма")
    body_html: Optional[str] = Field(None, description="HTML тело письма")
    recipients: List[EmailRecipientRequest] = Field(..., description="Получатели")
    priority: EmailPriority = Field(EmailPriority.NORMAL, description="Приоритет")
    category: EmailCategory = Field(EmailCategory.GENERAL, description="Категория")


class EmailResponse(BaseModel):
    id: int
    message_id: str
    subject: str
    body_text: Optional[str]
    body_html: Optional[str]
    status: EmailStatus
    priority: EmailPriority
    category: EmailCategory
    is_important: bool
    is_flagged: bool
    sent_at: Optional[datetime]
    created_at: datetime
    sender: EmailAccountResponse
    recipients: List[Dict[str, Any]]
    attachments: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class EmailListResponse(BaseModel):
    emails: List[EmailResponse]
    total_count: int
    page: int
    per_page: int
    total_pages: int


class EmailFolderCreateRequest(BaseModel):
    name: str = Field(..., description="Название папки")
    display_name: Optional[str] = Field(None, description="Отображаемое название")
    parent_folder_id: Optional[int] = Field(None, description="ID родительской папки")
    color: Optional[str] = Field(None, description="Цвет папки (HEX)")


class EmailFolderResponse(BaseModel):
    id: int
    name: str
    display_name: Optional[str]
    is_system: bool
    is_default: bool
    color: Optional[str]
    position: int
    parent_folder_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class EmailFilterCreateRequest(BaseModel):
    name: str = Field(..., description="Название фильтра")
    filter_type: EmailFilterType = Field(..., description="Тип фильтра")
    filter_value: str = Field(..., description="Значение фильтра")
    filter_condition: str = Field("contains", description="Условие фильтра")
    action: EmailFilterAction = Field(..., description="Действие фильтра")
    action_value: Optional[str] = Field(None, description="Значение действия")
    priority: int = Field(0, description="Приоритет фильтра")


class EmailFilterResponse(BaseModel):
    id: int
    name: str
    filter_type: EmailFilterType
    filter_value: str
    filter_condition: str
    action: EmailFilterAction
    action_value: Optional[str]
    is_active: bool
    is_system: bool
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


class EmailTemplateCreateRequest(BaseModel):
    name: str = Field(..., description="Название шаблона")
    description: Optional[str] = Field(None, description="Описание")
    subject: str = Field(..., description="Тема письма")
    body_html: str = Field(..., description="HTML тело письма")
    body_text: Optional[str] = Field(None, description="Текстовое тело письма")
    category: Optional[str] = Field(None, description="Категория")
    is_public: bool = Field(False, description="Публичный шаблон")
    variables: Optional[Dict[str, Any]] = Field(None, description="Переменные шаблона")


class EmailTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    subject: str
    body_html: str
    body_text: Optional[str]
    category: Optional[str]
    is_public: bool
    is_active: bool
    variables: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class EmailSearchRequest(BaseModel):
    search: Optional[str] = Field(None, description="Поисковый запрос")
    status: Optional[EmailStatus] = Field(None, description="Статус")
    priority: Optional[EmailPriority] = Field(None, description="Приоритет")
    category: Optional[EmailCategory] = Field(None, description="Категория")
    is_important: Optional[bool] = Field(None, description="Важное")
    is_flagged: Optional[bool] = Field(None, description="С флагом")
    date_from: Optional[datetime] = Field(None, description="Дата с")
    date_to: Optional[datetime] = Field(None, description="Дата по")


# API эндпоинты

@router.post("/accounts", response_model=EmailAccountResponse)
async def create_email_account(
    request: EmailAccountCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Создание email аккаунта"""
    email_service = EmailService(session)
    
    try:
        account = await email_service.create_email_account(
            user_id=current_user.id,
            email=request.email,
            display_name=request.display_name,
            smtp_config=request.smtp_config,
            imap_config=request.imap_config
        )
        return account
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/accounts", response_model=List[EmailAccountResponse])
async def get_email_accounts(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение email аккаунтов пользователя"""
    email_service = EmailService(session)
    accounts = await email_service.get_user_email_accounts(current_user.id)
    return accounts


@router.get("/accounts/{account_id}", response_model=EmailAccountResponse)
async def get_email_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение email аккаунта по ID"""
    email_service = EmailService(session)
    account = await email_service.get_email_account(account_id)
    
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    return account


@router.put("/accounts/{account_id}", response_model=EmailAccountResponse)
async def update_email_account(
    account_id: int,
    request: EmailAccountUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Обновление email аккаунта"""
    email_service = EmailService(session)
    
    # Проверяем, что аккаунт принадлежит пользователю
    account = await email_service.get_email_account(account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    updates = request.dict(exclude_unset=True)
    updated_account = await email_service.update_email_account(account_id, updates)
    
    if not updated_account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    return updated_account


@router.post("/accounts/{account_id}/emails", response_model=EmailResponse)
async def create_email(
    account_id: int,
    request: EmailCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Создание нового email сообщения"""
    email_service = EmailService(session)
    
    # Проверяем, что аккаунт принадлежит пользователю
    account = await email_service.get_email_account(account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    # Преобразуем получателей
    recipients = [
        {
            "email": r.email,
            "display_name": r.display_name,
            "type": r.type
        }
        for r in request.recipients
    ]
    
    email_obj = await email_service.create_email(
        sender_id=account_id,
        subject=request.subject,
        body_text=request.body_text,
        body_html=request.body_html,
        recipients=recipients,
        priority=request.priority,
        category=request.category
    )
    
    return email_obj


@router.post("/emails/{email_id}/send")
async def send_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Отправка email сообщения"""
    email_service = EmailService(session)
    
    # Проверяем, что email принадлежит пользователю
    email_obj = await email_service.get_email(email_id)
    if not email_obj or email_obj.sender.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email not found")
    
    try:
        success = await email_service.send_email(email_id)
        if success:
            return {"message": "Email sent successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to send email")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


@router.get("/accounts/{account_id}/emails", response_model=EmailListResponse)
async def get_emails(
    account_id: int,
    folder_name: str = Query("INBOX", description="Название папки"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(20, ge=1, le=100, description="Количество на странице"),
    search: Optional[str] = Query(None, description="Поисковый запрос"),
    status: Optional[EmailStatus] = Query(None, description="Статус"),
    priority: Optional[EmailPriority] = Query(None, description="Приоритет"),
    category: Optional[EmailCategory] = Query(None, description="Категория"),
    is_important: Optional[bool] = Query(None, description="Важное"),
    is_flagged: Optional[bool] = Query(None, description="С флагом"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение email сообщений с пагинацией и фильтрацией"""
    email_service = EmailService(session)
    
    # Проверяем, что аккаунт принадлежит пользователю
    account = await email_service.get_email_account(account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    # Формируем фильтры
    filters = {}
    if search:
        filters['search'] = search
    if status:
        filters['status'] = status
    if priority:
        filters['priority'] = priority
    if category:
        filters['category'] = category
    if is_important is not None:
        filters['is_important'] = is_important
    if is_flagged is not None:
        filters['is_flagged'] = is_flagged
    
    emails, total_count = await email_service.get_emails(
        account_id=account_id,
        folder_name=folder_name,
        page=page,
        per_page=per_page,
        filters=filters
    )
    
    total_pages = (total_count + per_page - 1) // per_page
    
    return EmailListResponse(
        emails=emails,
        total_count=total_count,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get("/emails/{email_id}", response_model=EmailResponse)
async def get_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение email по ID"""
    email_service = EmailService(session)
    email_obj = await email_service.get_email(email_id)
    
    if not email_obj or email_obj.sender.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return email_obj


@router.post("/emails/{email_id}/read")
async def mark_email_as_read(
    email_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Отметить email как прочитанный"""
    email_service = EmailService(session)
    
    # Проверяем, что email принадлежит пользователю
    email_obj = await email_service.get_email(email_id)
    if not email_obj or email_obj.sender.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email not found")
    
    success = await email_service.mark_email_as_read(email_id)
    if success:
        return {"message": "Email marked as read"}
    else:
        raise HTTPException(status_code=400, detail="Failed to mark email as read")


@router.post("/emails/{email_id}/important")
async def mark_email_as_important(
    email_id: int,
    is_important: bool = True,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Отметить email как важный"""
    email_service = EmailService(session)
    
    # Проверяем, что email принадлежит пользователю
    email_obj = await email_service.get_email(email_id)
    if not email_obj or email_obj.sender.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email not found")
    
    success = await email_service.mark_email_as_important(email_id, is_important)
    if success:
        return {"message": f"Email marked as {'important' if is_important else 'not important'}"}
    else:
        raise HTTPException(status_code=400, detail="Failed to mark email as important")


@router.post("/emails/{email_id}/move")
async def move_email_to_folder(
    email_id: int,
    folder_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Перемещение email в папку"""
    email_service = EmailService(session)
    
    # Проверяем, что email принадлежит пользователю
    email_obj = await email_service.get_email(email_id)
    if not email_obj or email_obj.sender.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email not found")
    
    success = await email_service.move_email_to_folder(email_id, folder_id)
    if success:
        return {"message": "Email moved successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to move email")


@router.post("/accounts/{account_id}/folders", response_model=EmailFolderResponse)
async def create_email_folder(
    account_id: int,
    request: EmailFolderCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Создание новой папки для email"""
    email_service = EmailService(session)
    
    # Проверяем, что аккаунт принадлежит пользователю
    account = await email_service.get_email_account(account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    folder = await email_service.create_email_folder(
        account_id=account_id,
        name=request.name,
        display_name=request.display_name,
        parent_folder_id=request.parent_folder_id,
        color=request.color
    )
    
    return folder


@router.get("/accounts/{account_id}/folders", response_model=List[EmailFolderResponse])
async def get_email_folders(
    account_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение папок email аккаунта"""
    email_service = EmailService(session)
    
    # Проверяем, что аккаунт принадлежит пользователю
    account = await email_service.get_email_account(account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    folders = await email_service.get_email_folders(account_id)
    return folders


@router.post("/accounts/{account_id}/filters", response_model=EmailFilterResponse)
async def create_email_filter(
    account_id: int,
    request: EmailFilterCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Создание фильтра для email"""
    email_service = EmailService(session)
    
    # Проверяем, что аккаунт принадлежит пользователю
    account = await email_service.get_email_account(account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    filter_obj = await email_service.create_email_filter(
        account_id=account_id,
        name=request.name,
        filter_type=request.filter_type,
        filter_value=request.filter_value,
        action=request.action,
        action_value=request.action_value,
        filter_condition=request.filter_condition,
        priority=request.priority
    )
    
    return filter_obj


@router.post("/templates", response_model=EmailTemplateResponse)
async def create_email_template(
    request: EmailTemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Создание шаблона email"""
    email_service = EmailService(session)
    
    template = await email_service.create_email_template(
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        subject=request.subject,
        body_html=request.body_html,
        body_text=request.body_text,
        category=request.category,
        is_public=request.is_public,
        variables=request.variables
    )
    
    return template


@router.get("/templates", response_model=List[EmailTemplateResponse])
async def get_email_templates(
    include_public: bool = Query(True, description="Включить публичные шаблоны"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение шаблонов email"""
    email_service = EmailService(session)
    templates = await email_service.get_email_templates(
        user_id=current_user.id,
        include_public=include_public
    )
    return templates


@router.post("/templates/{template_id}/render")
async def render_email_template(
    template_id: int,
    variables: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Рендеринг шаблона email с переменными"""
    email_service = EmailService(session)
    
    rendered = await email_service.render_email_template(template_id, variables)
    if not rendered:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return rendered


@router.get("/attachments/{attachment_id}")
async def download_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Скачивание вложения email"""
    # Здесь должна быть логика получения вложения и проверки прав доступа
    # Пока возвращаем заглушку
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/stats/{account_id}")
async def get_email_stats(
    account_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение статистики email аккаунта"""
    email_service = EmailService(session)
    
    # Проверяем, что аккаунт принадлежит пользователю
    account = await email_service.get_email_account(account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    # Здесь должна быть логика подсчета статистики
    # Пока возвращаем заглушку
    return {
        "total_emails": 0,
        "unread_emails": 0,
        "important_emails": 0,
        "spam_emails": 0,
        "folders_count": 0
    }
