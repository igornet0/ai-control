"""
API роутер для системы уведомлений
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
from core.database.models.notification_model import (
    NotificationType, NotificationPriority, NotificationStatus, NotificationChannel
)
from backend.api.services.notification_service import NotificationService


# Pydantic модели для запросов
class NotificationCreateRequest(BaseModel):
    """Запрос на создание уведомления"""
    notification_type: NotificationType = Field(..., description="Тип уведомления")
    title: str = Field(..., description="Заголовок уведомления")
    message: str = Field(..., description="Текст уведомления")
    priority: NotificationPriority = Field(NotificationPriority.NORMAL, description="Приоритет")
    channels: Optional[List[str]] = Field(None, description="Каналы доставки")
    template_id: Optional[int] = Field(None, description="ID шаблона")
    related_entity_type: Optional[str] = Field(None, description="Тип связанной сущности")
    related_entity_id: Optional[int] = Field(None, description="ID связанной сущности")
    scheduled_at: Optional[datetime] = Field(None, description="Время отправки")
    expires_at: Optional[datetime] = Field(None, description="Время истечения")
    variables: Optional[Dict[str, Any]] = Field(None, description="Переменные для шаблона")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Дополнительные данные")


class NotificationTemplateCreateRequest(BaseModel):
    """Запрос на создание шаблона уведомлений"""
    name: str = Field(..., description="Название шаблона")
    notification_type: NotificationType = Field(..., description="Тип уведомления")
    body_template: str = Field(..., description="Шаблон тела сообщения")
    subject_template: Optional[str] = Field(None, description="Шаблон заголовка")
    email_template: Optional[str] = Field(None, description="Email шаблон")
    sms_template: Optional[str] = Field(None, description="SMS шаблон")
    push_template: Optional[str] = Field(None, description="Push шаблон")
    default_priority: NotificationPriority = Field(NotificationPriority.NORMAL, description="Приоритет по умолчанию")
    default_channels: Optional[List[str]] = Field(None, description="Каналы по умолчанию")
    variables: Optional[Dict[str, Any]] = Field(None, description="Переменные шаблона")


class NotificationFromTemplateRequest(BaseModel):
    """Запрос на отправку уведомления по шаблону"""
    template_id: int = Field(..., description="ID шаблона")
    variables: Dict[str, Any] = Field(..., description="Переменные для шаблона")
    channels: Optional[List[str]] = Field(None, description="Каналы доставки")
    priority: Optional[NotificationPriority] = Field(None, description="Приоритет")
    related_entity_type: Optional[str] = Field(None, description="Тип связанной сущности")
    related_entity_id: Optional[int] = Field(None, description="ID связанной сущности")


class UserPreferenceUpdateRequest(BaseModel):
    """Запрос на обновление настроек пользователя"""
    notification_type: NotificationType = Field(..., description="Тип уведомлений")
    enabled_channels: Optional[List[str]] = Field(None, description="Включенные каналы")
    email_enabled: Optional[bool] = Field(None, description="Включить email")
    sms_enabled: Optional[bool] = Field(None, description="Включить SMS")
    push_enabled: Optional[bool] = Field(None, description="Включить push")
    in_app_enabled: Optional[bool] = Field(None, description="Включить в приложении")
    min_priority: Optional[NotificationPriority] = Field(None, description="Минимальный приоритет")
    quiet_hours_start: Optional[str] = Field(None, description="Начало тихих часов (HH:MM)")
    quiet_hours_end: Optional[str] = Field(None, description="Конец тихих часов (HH:MM)")
    timezone: Optional[str] = Field(None, description="Часовой пояс")
    batch_notifications: Optional[bool] = Field(None, description="Пакетные уведомления")
    batch_interval_minutes: Optional[int] = Field(None, description="Интервал пакетов (минуты)")


class WebhookCreateRequest(BaseModel):
    """Запрос на создание webhook'а"""
    name: str = Field(..., description="Название webhook'а")
    url: str = Field(..., description="URL webhook'а")
    method: str = Field("POST", description="HTTP метод")
    notification_types: Optional[List[str]] = Field(None, description="Типы уведомлений")
    notification_priorities: Optional[List[str]] = Field(None, description="Приоритеты уведомлений")
    headers: Optional[Dict[str, str]] = Field(None, description="HTTP заголовки")
    auth_type: Optional[str] = Field(None, description="Тип аутентификации")
    auth_credentials: Optional[Dict[str, str]] = Field(None, description="Учетные данные")
    retry_count: int = Field(3, description="Количество повторов")
    timeout_seconds: int = Field(30, description="Таймаут в секундах")


# Pydantic модели для ответов
class NotificationResponse(BaseModel):
    """Ответ с информацией об уведомлении"""
    id: int
    notification_uuid: str
    recipient_id: int
    template_id: Optional[int]
    notification_type: NotificationType
    title: str
    message: str
    priority: NotificationPriority
    status: NotificationStatus
    channels: List[str]
    delivered_channels: List[str]
    related_entity_type: Optional[str]
    related_entity_id: Optional[int]
    scheduled_at: Optional[datetime]
    expires_at: Optional[datetime]
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    created_at: datetime
    metadata: Dict[str, Any]
    
    class Config:
        from_attributes = True


class NotificationTemplateResponse(BaseModel):
    """Ответ с информацией о шаблоне уведомлений"""
    id: int
    template_uuid: str
    name: str
    description: Optional[str]
    notification_type: NotificationType
    subject_template: Optional[str]
    body_template: str
    email_template: Optional[str]
    sms_template: Optional[str]
    push_template: Optional[str]
    default_priority: NotificationPriority
    default_channels: List[str]
    is_active: bool
    variables: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserNotificationPreferenceResponse(BaseModel):
    """Ответ с настройками уведомлений пользователя"""
    id: int
    user_id: int
    notification_type: NotificationType
    enabled_channels: List[str]
    email_enabled: bool
    sms_enabled: bool
    push_enabled: bool
    in_app_enabled: bool
    min_priority: NotificationPriority
    quiet_hours_start: Optional[str]
    quiet_hours_end: Optional[str]
    timezone: str
    batch_notifications: bool
    batch_interval_minutes: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class NotificationStatsResponse(BaseModel):
    """Ответ со статистикой уведомлений"""
    total_count: int
    unread_count: int
    type_counts: Dict[str, int]
    priority_counts: Dict[str, int]


class WebhookResponse(BaseModel):
    """Ответ с информацией о webhook'е"""
    id: int
    webhook_uuid: str
    name: str
    url: str
    method: str
    notification_types: List[str]
    notification_priorities: List[str]
    headers: Dict[str, str]
    auth_type: Optional[str]
    is_active: bool
    retry_count: int
    timeout_seconds: int
    total_calls: int
    successful_calls: int
    failed_calls: int
    last_called_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Создаем роутер
router = APIRouter(prefix="/notifications", tags=["Notifications"])


# Зависимости
async def get_notification_service(session: AsyncSession = Depends(get_session)) -> NotificationService:
    """Получение сервиса уведомлений"""
    return NotificationService(session)


# Эндпоинты для уведомлений
@router.post("/", response_model=NotificationResponse)
async def create_notification(
    request: NotificationCreateRequest,
    recipient_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Создание нового уведомления"""
    try:
        notification = await service.create_notification(
            recipient_id=recipient_id,
            notification_type=request.notification_type,
            title=request.title,
            message=request.message,
            priority=request.priority,
            channels=request.channels,
            template_id=request.template_id,
            related_entity_type=request.related_entity_type,
            related_entity_id=request.related_entity_id,
            scheduled_at=request.scheduled_at,
            expires_at=request.expires_at,
            variables=request.variables,
            metadata=request.metadata
        )
        
        if notification is None:
            raise HTTPException(status_code=400, detail="Notification was filtered by user preferences")
        
        return notification
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[NotificationResponse])
async def get_user_notifications(
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(20, ge=1, le=100, description="Количество на странице"),
    status: Optional[NotificationStatus] = Query(None, description="Статус уведомления"),
    notification_type: Optional[NotificationType] = Query(None, description="Тип уведомления"),
    unread_only: bool = Query(False, description="Только непрочитанные"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Получение уведомлений пользователя"""
    try:
        notifications, total_count = await service.get_user_notifications(
            user_id=current_user_id,
            page=page,
            per_page=per_page,
            status=status,
            notification_type=notification_type,
            unread_only=unread_only
        )
        return notifications
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Отметить уведомление как прочитанное"""
    try:
        success = await service.mark_notification_as_read(
            notification_id=notification_id,
            user_id=current_user_id
        )
        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"message": "Notification marked as read"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mark-all-read")
async def mark_all_notifications_as_read(
    notification_type: Optional[NotificationType] = Query(None, description="Тип уведомлений"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Отметить все уведомления как прочитанные"""
    try:
        count = await service.mark_all_notifications_as_read(
            user_id=current_user_id,
            notification_type=notification_type
        )
        return {"message": f"Marked {count} notifications as read"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Удаление уведомления"""
    try:
        success = await service.delete_notification(
            notification_id=notification_id,
            user_id=current_user_id
        )
        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"message": "Notification deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats", response_model=NotificationStatsResponse)
async def get_notification_stats(
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Получение статистики уведомлений"""
    try:
        stats = await service.get_notification_stats(user_id=current_user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для шаблонов
@router.post("/templates", response_model=NotificationTemplateResponse)
async def create_notification_template(
    request: NotificationTemplateCreateRequest,
    service: NotificationService = Depends(get_notification_service)
):
    """Создание шаблона уведомлений"""
    try:
        template = await service.create_notification_template(
            name=request.name,
            notification_type=request.notification_type,
            body_template=request.body_template,
            subject_template=request.subject_template,
            email_template=request.email_template,
            sms_template=request.sms_template,
            push_template=request.push_template,
            default_priority=request.default_priority,
            default_channels=request.default_channels,
            variables=request.variables
        )
        return template
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/templates/{template_id}/send", response_model=NotificationResponse)
async def send_notification_from_template(
    template_id: int,
    request: NotificationFromTemplateRequest,
    recipient_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Отправка уведомления по шаблону"""
    try:
        notification = await service.send_notification_from_template(
            template_id=template_id,
            recipient_id=recipient_id,
            variables=request.variables,
            channels=request.channels,
            priority=request.priority,
            related_entity_type=request.related_entity_type,
            related_entity_id=request.related_entity_id
        )
        return notification
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для настроек пользователя
@router.put("/preferences", response_model=UserNotificationPreferenceResponse)
async def update_user_preferences(
    request: UserPreferenceUpdateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: NotificationService = Depends(get_notification_service)
):
    """Обновление настроек уведомлений пользователя"""
    try:
        preferences = await service.update_user_preferences(
            user_id=current_user_id,
            notification_type=request.notification_type,
            enabled_channels=request.enabled_channels,
            email_enabled=request.email_enabled,
            sms_enabled=request.sms_enabled,
            push_enabled=request.push_enabled,
            in_app_enabled=request.in_app_enabled,
            min_priority=request.min_priority,
            quiet_hours_start=request.quiet_hours_start,
            quiet_hours_end=request.quiet_hours_end,
            timezone=request.timezone,
            batch_notifications=request.batch_notifications,
            batch_interval_minutes=request.batch_interval_minutes
        )
        return preferences
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для webhook'ов
@router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(
    request: WebhookCreateRequest,
    service: NotificationService = Depends(get_notification_service)
):
    """Создание webhook'а для уведомлений"""
    try:
        webhook = await service.create_webhook(
            name=request.name,
            url=request.url,
            method=request.method,
            notification_types=request.notification_types,
            notification_priorities=request.notification_priorities,
            headers=request.headers,
            auth_type=request.auth_type,
            auth_credentials=request.auth_credentials,
            retry_count=request.retry_count,
            timeout_seconds=request.timeout_seconds
        )
        return webhook
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# WebSocket эндпоинт для реального времени
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int = 1  # TODO: Получать из аутентификации
):
    """WebSocket эндпоинт для уведомлений в реальном времени"""
    await websocket.accept()
    try:
        while True:
            # Получаем сообщение от клиента
            data = await websocket.receive_text()
            message = {"user_id": user_id, "data": data}
            
            # Отправляем ответ обратно (здесь можно добавить логику обработки)
            await websocket.send_text(f"Notification message received: {data}")
    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected from notifications")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()
