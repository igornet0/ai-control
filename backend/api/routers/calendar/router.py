"""
API роутер для единого календаря событий
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.database import get_session
from core.database.models.calendar_model import (
    EventType, EventPriority, EventStatus, RecurrenceType
)
from backend.api.services.calendar_service import CalendarService


# Pydantic модели для запросов
class CalendarCreateRequest(BaseModel):
    """Запрос на создание календаря"""
    name: str = Field(..., description="Название календаря")
    description: Optional[str] = Field(None, description="Описание календаря")
    color: str = Field("#007bff", description="Цвет календаря")
    is_default: bool = Field(False, description="Календарь по умолчанию")
    is_public: bool = Field(False, description="Публичный календарь")
    timezone: str = Field("UTC", description="Часовой пояс")
    working_hours_start: Optional[str] = Field(None, description="Начало рабочих часов (HH:MM)")
    working_hours_end: Optional[str] = Field(None, description="Конец рабочих часов (HH:MM)")
    working_days: Optional[List[int]] = Field(None, description="Рабочие дни (0=Sunday)")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Метаданные")


class EventCreateRequest(BaseModel):
    """Запрос на создание события"""
    calendar_id: int = Field(..., description="ID календаря")
    title: str = Field(..., description="Название события")
    start_time: datetime = Field(..., description="Время начала")
    end_time: datetime = Field(..., description="Время окончания")
    description: Optional[str] = Field(None, description="Описание события")
    event_type: EventType = Field(EventType.CUSTOM, description="Тип события")
    priority: EventPriority = Field(EventPriority.NORMAL, description="Приоритет")
    all_day: bool = Field(False, description="Весь день")
    location: Optional[str] = Field(None, description="Место проведения")
    location_url: Optional[str] = Field(None, description="URL места проведения")
    recurrence_type: RecurrenceType = Field(RecurrenceType.NONE, description="Тип повторения")
    recurrence_rule: Optional[Dict[str, Any]] = Field(None, description="Правило повторения")
    recurrence_end: Optional[datetime] = Field(None, description="Конец повторения")
    reminder_minutes: Optional[int] = Field(None, description="Напоминание за N минут")
    related_entity_type: Optional[str] = Field(None, description="Тип связанной сущности")
    related_entity_id: Optional[int] = Field(None, description="ID связанной сущности")
    tags: Optional[List[str]] = Field(None, description="Теги")
    attachments: Optional[List[str]] = Field(None, description="Вложения")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Метаданные")


class EventUpdateRequest(BaseModel):
    """Запрос на обновление события"""
    title: Optional[str] = Field(None, description="Название события")
    description: Optional[str] = Field(None, description="Описание события")
    start_time: Optional[datetime] = Field(None, description="Время начала")
    end_time: Optional[datetime] = Field(None, description="Время окончания")
    event_type: Optional[EventType] = Field(None, description="Тип события")
    priority: Optional[EventPriority] = Field(None, description="Приоритет")
    status: Optional[EventStatus] = Field(None, description="Статус")
    all_day: Optional[bool] = Field(None, description="Весь день")
    location: Optional[str] = Field(None, description="Место проведения")
    location_url: Optional[str] = Field(None, description="URL места проведения")
    tags: Optional[List[str]] = Field(None, description="Теги")
    attachments: Optional[List[str]] = Field(None, description="Вложения")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Метаданные")


class AttendeeAddRequest(BaseModel):
    """Запрос на добавление участника"""
    user_id: int = Field(..., description="ID пользователя")
    role: str = Field("attendee", description="Роль участника")
    response_status: str = Field("pending", description="Статус ответа")
    send_reminders: bool = Field(True, description="Отправлять напоминания")
    reminder_minutes: Optional[int] = Field(None, description="Напоминание за N минут")


class CalendarShareRequest(BaseModel):
    """Запрос на предоставление доступа к календарю"""
    user_id: int = Field(..., description="ID пользователя")
    can_view: bool = Field(True, description="Может просматривать")
    can_edit: bool = Field(False, description="Может редактировать")
    can_share: bool = Field(False, description="Может делиться")
    can_delete: bool = Field(False, description="Может удалять")
    expires_at: Optional[datetime] = Field(None, description="Дата истечения доступа")


class TemplateCreateRequest(BaseModel):
    """Запрос на создание шаблона события"""
    name: str = Field(..., description="Название шаблона")
    event_type: EventType = Field(..., description="Тип события")
    description: Optional[str] = Field(None, description="Описание шаблона")
    default_duration_minutes: int = Field(60, description="Длительность по умолчанию")
    default_priority: EventPriority = Field(EventPriority.NORMAL, description="Приоритет по умолчанию")
    default_reminder_minutes: Optional[int] = Field(15, description="Напоминание по умолчанию")
    title_template: Optional[str] = Field(None, description="Шаблон названия")
    description_template: Optional[str] = Field(None, description="Шаблон описания")
    location_template: Optional[str] = Field(None, description="Шаблон места")
    is_public: bool = Field(False, description="Публичный шаблон")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Метаданные")


# Pydantic модели для ответов
class CalendarResponse(BaseModel):
    """Ответ с информацией о календаре"""
    id: int
    calendar_uuid: str
    owner_id: int
    name: str
    description: Optional[str]
    color: str
    is_default: bool
    is_public: bool
    is_active: bool
    timezone: str
    working_hours_start: Optional[str]
    working_hours_end: Optional[str]
    working_days: List[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarEventResponse(BaseModel):
    """Ответ с информацией о событии"""
    id: int
    event_uuid: str
    calendar_id: int
    title: str
    description: Optional[str]
    event_type: EventType
    priority: EventPriority
    status: EventStatus
    start_time: datetime
    end_time: datetime
    all_day: bool
    location: Optional[str]
    location_url: Optional[str]
    recurrence_type: RecurrenceType
    reminder_minutes: Optional[int]
    related_entity_type: Optional[str]
    related_entity_id: Optional[int]
    tags: List[str]
    attachments: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventAttendeeResponse(BaseModel):
    """Ответ с информацией об участнике события"""
    id: int
    event_id: int
    user_id: int
    response_status: str
    role: str
    send_reminders: bool
    reminder_minutes: Optional[int]
    invited_at: datetime
    responded_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class EventReminderResponse(BaseModel):
    """Ответ с информацией о напоминании"""
    id: int
    event_id: int
    user_id: int
    reminder_type: str
    reminder_minutes: int
    reminder_time: datetime
    is_sent: bool
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CalendarShareResponse(BaseModel):
    """Ответ с информацией о доступе к календарю"""
    id: int
    calendar_id: int
    user_id: int
    can_view: bool
    can_edit: bool
    can_share: bool
    can_delete: bool
    is_active: bool
    shared_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class CalendarTemplateResponse(BaseModel):
    """Ответ с информацией о шаблоне события"""
    id: int
    template_uuid: str
    creator_id: int
    name: str
    description: Optional[str]
    event_type: EventType
    default_duration_minutes: int
    default_priority: EventPriority
    default_reminder_minutes: Optional[int]
    title_template: Optional[str]
    description_template: Optional[str]
    location_template: Optional[str]
    is_public: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventStatsResponse(BaseModel):
    """Ответ со статистикой событий"""
    total_events: int
    upcoming_events: int
    today_events: int
    completed_events: int
    cancelled_events: int
    events_by_type: Dict[str, int]
    events_by_priority: Dict[str, int]


# Создаем роутер
router = APIRouter(prefix="/calendar", tags=["Calendar"])


# Зависимости
async def get_calendar_service(session: AsyncSession = Depends(get_session)) -> CalendarService:
    """Получение сервиса календаря"""
    return CalendarService(session)


# Эндпоинты для календарей
@router.post("/calendars", response_model=CalendarResponse)
async def create_calendar(
    request: CalendarCreateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Создание нового календаря"""
    try:
        calendar = await service.create_calendar(
            owner_id=current_user_id,
            name=request.name,
            description=request.description,
            color=request.color,
            is_default=request.is_default,
            is_public=request.is_public,
            timezone=request.timezone,
            working_hours_start=request.working_hours_start,
            working_hours_end=request.working_hours_end,
            working_days=request.working_days,
            metadata=request.metadata
        )
        return calendar
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/calendars", response_model=List[CalendarResponse])
async def get_user_calendars(
    include_shared: bool = Query(True, description="Включать общие календари"),
    include_public: bool = Query(True, description="Включать публичные календари"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Получение календарей пользователя"""
    try:
        calendars = await service.get_user_calendars(
            user_id=current_user_id,
            include_shared=include_shared,
            include_public=include_public
        )
        return calendars
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для событий
@router.post("/events", response_model=CalendarEventResponse)
async def create_event(
    request: EventCreateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Создание нового события"""
    try:
        event = await service.create_event(
            calendar_id=request.calendar_id,
            title=request.title,
            start_time=request.start_time,
            end_time=request.end_time,
            description=request.description,
            event_type=request.event_type,
            priority=request.priority,
            all_day=request.all_day,
            location=request.location,
            location_url=request.location_url,
            recurrence_type=request.recurrence_type,
            recurrence_rule=request.recurrence_rule,
            recurrence_end=request.recurrence_end,
            reminder_minutes=request.reminder_minutes,
            related_entity_type=request.related_entity_type,
            related_entity_id=request.related_entity_id,
            tags=request.tags,
            attachments=request.attachments,
            metadata=request.metadata
        )
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/events", response_model=List[CalendarEventResponse])
async def get_user_events(
    start_date: Optional[datetime] = Query(None, description="Дата начала"),
    end_date: Optional[datetime] = Query(None, description="Дата окончания"),
    event_types: Optional[List[EventType]] = Query(None, description="Типы событий"),
    status: Optional[EventStatus] = Query(None, description="Статус событий"),
    include_shared: bool = Query(True, description="Включать общие календари"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(50, ge=1, le=100, description="Количество на странице"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Получение событий пользователя"""
    try:
        events, total_count = await service.get_user_events(
            user_id=current_user_id,
            start_date=start_date,
            end_date=end_date,
            event_types=event_types,
            status=status,
            include_shared=include_shared,
            page=page,
            per_page=per_page
        )
        return events
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/events/upcoming", response_model=List[CalendarEventResponse])
async def get_upcoming_events(
    days: int = Query(7, ge=1, le=365, description="Количество дней"),
    limit: int = Query(20, ge=1, le=100, description="Количество событий"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Получение предстоящих событий"""
    try:
        events = await service.get_upcoming_events(
            user_id=current_user_id,
            days=days,
            limit=limit
        )
        return events
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/events/today", response_model=List[CalendarEventResponse])
async def get_today_events(
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Получение событий на сегодня"""
    try:
        events = await service.get_today_events(user_id=current_user_id)
        return events
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: int,
    request: EventUpdateRequest,
    service: CalendarService = Depends(get_calendar_service)
):
    """Обновление события"""
    try:
        event = await service.update_event(
            event_id=event_id,
            title=request.title,
            description=request.description,
            start_time=request.start_time,
            end_time=request.end_time,
            event_type=request.event_type,
            priority=request.priority,
            status=request.status,
            all_day=request.all_day,
            location=request.location,
            location_url=request.location_url,
            tags=request.tags,
            attachments=request.attachments,
            metadata=request.metadata
        )
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    service: CalendarService = Depends(get_calendar_service)
):
    """Удаление события"""
    try:
        success = await service.delete_event(event_id=event_id)
        if not success:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"message": "Event deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для участников событий
@router.post("/events/{event_id}/attendees", response_model=EventAttendeeResponse)
async def add_event_attendee(
    event_id: int,
    request: AttendeeAddRequest,
    service: CalendarService = Depends(get_calendar_service)
):
    """Добавление участника к событию"""
    try:
        attendee = await service.add_event_attendee(
            event_id=event_id,
            user_id=request.user_id,
            role=request.role,
            response_status=request.response_status,
            send_reminders=request.send_reminders,
            reminder_minutes=request.reminder_minutes
        )
        return attendee
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/events/{event_id}/attendees/{user_id}/response")
async def update_attendee_response(
    event_id: int,
    user_id: int,
    response_status: str = Query(..., description="Статус ответа"),
    service: CalendarService = Depends(get_calendar_service)
):
    """Обновление ответа участника"""
    try:
        success = await service.update_attendee_response(
            event_id=event_id,
            user_id=user_id,
            response_status=response_status
        )
        if not success:
            raise HTTPException(status_code=404, detail="Attendee not found")
        return {"message": "Response updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для доступа к календарям
@router.post("/calendars/{calendar_id}/share", response_model=CalendarShareResponse)
async def share_calendar(
    calendar_id: int,
    request: CalendarShareRequest,
    service: CalendarService = Depends(get_calendar_service)
):
    """Предоставление доступа к календарю"""
    try:
        share = await service.share_calendar(
            calendar_id=calendar_id,
            user_id=request.user_id,
            can_view=request.can_view,
            can_edit=request.can_edit,
            can_share=request.can_share,
            can_delete=request.can_delete,
            expires_at=request.expires_at
        )
        return share
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для шаблонов событий
@router.post("/templates", response_model=CalendarTemplateResponse)
async def create_calendar_template(
    request: TemplateCreateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Создание шаблона события"""
    try:
        template = await service.create_calendar_template(
            creator_id=current_user_id,
            name=request.name,
            event_type=request.event_type,
            description=request.description,
            default_duration_minutes=request.default_duration_minutes,
            default_priority=request.default_priority,
            default_reminder_minutes=request.default_reminder_minutes,
            title_template=request.title_template,
            description_template=request.description_template,
            location_template=request.location_template,
            is_public=request.is_public,
            metadata=request.metadata
        )
        return template
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/templates", response_model=List[CalendarTemplateResponse])
async def get_calendar_templates(
    include_public: bool = Query(True, description="Включать публичные шаблоны"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Получение шаблонов событий"""
    try:
        templates = await service.get_calendar_templates(
            user_id=current_user_id,
            include_public=include_public
        )
        return templates
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/templates/{template_id}/events", response_model=CalendarEventResponse)
async def create_event_from_template(
    template_id: int,
    calendar_id: int = Query(..., description="ID календаря"),
    start_time: datetime = Query(..., description="Время начала"),
    title: Optional[str] = Query(None, description="Название события"),
    description: Optional[str] = Query(None, description="Описание события"),
    location: Optional[str] = Query(None, description="Место проведения"),
    service: CalendarService = Depends(get_calendar_service)
):
    """Создание события из шаблона"""
    try:
        event = await service.create_event_from_template(
            template_id=template_id,
            calendar_id=calendar_id,
            start_time=start_time,
            title=title,
            description=description,
            location=location
        )
        return event
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для статистики
@router.get("/stats", response_model=EventStatsResponse)
async def get_event_stats(
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: CalendarService = Depends(get_calendar_service)
):
    """Получение статистики событий"""
    try:
        # Получаем события за последний месяц
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        events, total_count = await service.get_user_events(
            user_id=current_user_id,
            start_date=start_date,
            end_date=end_date,
            per_page=1000  # Получаем все события для статистики
        )
        
        # Вычисляем статистику
        upcoming_events = len([e for e in events if e.start_time > datetime.utcnow()])
        today_events = len(await service.get_today_events(user_id=current_user_id))
        completed_events = len([e for e in events if e.status == EventStatus.COMPLETED])
        cancelled_events = len([e for e in events if e.status == EventStatus.CANCELLED])
        
        # Статистика по типам
        events_by_type = {}
        for event in events:
            event_type = event.event_type.value
            events_by_type[event_type] = events_by_type.get(event_type, 0) + 1
        
        # Статистика по приоритетам
        events_by_priority = {}
        for event in events:
            priority = event.priority.value
            events_by_priority[priority] = events_by_priority.get(priority, 0) + 1
        
        return EventStatsResponse(
            total_events=total_count,
            upcoming_events=upcoming_events,
            today_events=today_events,
            completed_events=completed_events,
            cancelled_events=cancelled_events,
            events_by_type=events_by_type,
            events_by_priority=events_by_priority
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# WebSocket эндпоинт для реального времени
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int = 1  # TODO: Получать из аутентификации
):
    """WebSocket эндпоинт для календаря в реальном времени"""
    await websocket.accept()
    try:
        while True:
            # Получаем сообщение от клиента
            data = await websocket.receive_text()
            message = {"user_id": user_id, "data": data}

            # Отправляем ответ обратно (здесь можно добавить логику обработки)
            await websocket.send_text(f"Calendar message received: {data}")
    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected from calendar")
    except Exception as e:
        print(f"Calendar WebSocket error: {e}")
        await websocket.close()
