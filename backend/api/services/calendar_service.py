"""
Сервис для единого календаря событий
"""
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, or_, func, desc, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database.models.calendar_model import (
    Calendar, CalendarEvent, EventAttendee, EventReminder,
    CalendarShare, CalendarTemplate, CalendarIntegration,
    EventType, EventPriority, EventStatus, RecurrenceType
)
from core.database.models.main_models import User


class CalendarService:
    """Сервис для управления календарем событий"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_calendar(
        self,
        owner_id: int,
        name: str,
        description: Optional[str] = None,
        color: str = "#007bff",
        is_default: bool = False,
        is_public: bool = False,
        timezone: str = "UTC",
        working_hours_start: Optional[str] = None,
        working_hours_end: Optional[str] = None,
        working_days: Optional[List[int]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Calendar:
        """Создание нового календаря"""
        # Если это календарь по умолчанию, сбрасываем другие
        if is_default:
            await self.session.execute(
                text("UPDATE calendars SET is_default = false WHERE owner_id = :owner_id"),
                {"owner_id": owner_id}
            )
        
        calendar = Calendar(
            calendar_uuid=str(uuid.uuid4()),
            owner_id=owner_id,
            name=name,
            description=description,
            color=color,
            is_default=is_default,
            is_public=is_public,
            timezone=timezone,
            working_hours_start=working_hours_start,
            working_hours_end=working_hours_end,
            working_days=working_days or [0, 1, 2, 3, 4, 5, 6],
            calendar_metadata=metadata or {}
        )
        
        self.session.add(calendar)
        await self.session.commit()
        
        return calendar
    
    async def get_user_calendars(
        self,
        user_id: int,
        include_shared: bool = True,
        include_public: bool = True
    ) -> List[Calendar]:
        """Получение календарей пользователя"""
        query = select(Calendar).where(
            or_(
                Calendar.owner_id == user_id,
                and_(Calendar.is_public == True, include_public),
                and_(Calendar.shares.any(CalendarShare.user_id == user_id), include_shared)
            )
        ).order_by(desc(Calendar.is_default), Calendar.name)
        
        result = await self.session.execute(
            query.options(selectinload(Calendar.shares))
        )
        
        return result.scalars().all()
    
    async def get_calendar_events(
        self,
        calendar_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        event_types: Optional[List[EventType]] = None,
        status: Optional[EventStatus] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Tuple[List[CalendarEvent], int]:
        """Получение событий календаря"""
        query = select(CalendarEvent).where(CalendarEvent.calendar_id == calendar_id)
        
        # Фильтры по дате
        if start_date:
            query = query.where(CalendarEvent.start_time >= start_date)
        if end_date:
            query = query.where(CalendarEvent.end_time <= end_date)
        
        # Фильтры по типу события
        if event_types:
            query = query.where(CalendarEvent.event_type.in_(event_types))
        
        # Фильтр по статусу
        if status:
            query = query.where(CalendarEvent.status == status)
        
        # Подсчитываем общее количество
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await self.session.scalar(count_query)
        
        # Добавляем пагинацию и сортировку
        query = query.order_by(CalendarEvent.start_time).offset(
            (page - 1) * per_page
        ).limit(per_page)
        
        # Выполняем запрос с загрузкой связанных данных
        result = await self.session.execute(
            query.options(
                selectinload(CalendarEvent.attendees),
                selectinload(CalendarEvent.reminders)
            )
        )
        
        events = result.scalars().all()
        return events, total_count
    
    async def create_event(
        self,
        calendar_id: int,
        title: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        event_type: EventType = EventType.CUSTOM,
        priority: EventPriority = EventPriority.NORMAL,
        all_day: bool = False,
        location: Optional[str] = None,
        location_url: Optional[str] = None,
        recurrence_type: RecurrenceType = RecurrenceType.NONE,
        recurrence_rule: Optional[Dict[str, Any]] = None,
        recurrence_end: Optional[datetime] = None,
        reminder_minutes: Optional[int] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[int] = None,
        tags: Optional[List[str]] = None,
        attachments: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> CalendarEvent:
        """Создание нового события"""
        event = CalendarEvent(
            event_uuid=str(uuid.uuid4()),
            calendar_id=calendar_id,
            title=title,
            description=description,
            event_type=event_type,
            priority=priority,
            start_time=start_time,
            end_time=end_time,
            all_day=all_day,
            location=location,
            location_url=location_url,
            recurrence_type=recurrence_type,
            recurrence_rule=recurrence_rule,
            recurrence_end=recurrence_end,
            reminder_minutes=reminder_minutes,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            tags=tags or [],
            attachments=attachments or [],
            event_metadata=metadata or {}
        )
        
        self.session.add(event)
        await self.session.flush()
        
        # Создаем напоминание, если указано
        if reminder_minutes:
            await self.create_event_reminder(
                event_id=event.id,
                user_id=1,  # TODO: Получать из аутентификации
                reminder_minutes=reminder_minutes
            )
        
        await self.session.commit()
        return event
    
    async def update_event(
        self,
        event_id: int,
        title: Optional[str] = None,
        description: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_type: Optional[EventType] = None,
        priority: Optional[EventPriority] = None,
        status: Optional[EventStatus] = None,
        all_day: Optional[bool] = None,
        location: Optional[str] = None,
        location_url: Optional[str] = None,
        tags: Optional[List[str]] = None,
        attachments: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[CalendarEvent]:
        """Обновление события"""
        event = await self.session.execute(
            select(CalendarEvent).where(CalendarEvent.id == event_id)
        )
        event_obj = event.scalar_one_or_none()
        
        if not event_obj:
            return None
        
        # Обновляем поля
        if title is not None:
            event_obj.title = title
        if description is not None:
            event_obj.description = description
        if start_time is not None:
            event_obj.start_time = start_time
        if end_time is not None:
            event_obj.end_time = end_time
        if event_type is not None:
            event_obj.event_type = event_type
        if priority is not None:
            event_obj.priority = priority
        if status is not None:
            event_obj.status = status
        if all_day is not None:
            event_obj.all_day = all_day
        if location is not None:
            event_obj.location = location
        if location_url is not None:
            event_obj.location_url = location_url
        if tags is not None:
            event_obj.tags = tags
        if attachments is not None:
            event_obj.attachments = attachments
        if metadata is not None:
            event_obj.event_metadata = metadata
        
        event_obj.updated_at = datetime.utcnow()
        await self.session.commit()
        
        return event_obj
    
    async def delete_event(self, event_id: int) -> bool:
        """Удаление события"""
        event = await self.session.execute(
            select(CalendarEvent).where(CalendarEvent.id == event_id)
        )
        event_obj = event.scalar_one_or_none()
        
        if not event_obj:
            return False
        
        await self.session.delete(event_obj)
        await self.session.commit()
        
        return True
    
    async def add_event_attendee(
        self,
        event_id: int,
        user_id: int,
        role: str = "attendee",
        response_status: str = "pending",
        send_reminders: bool = True,
        reminder_minutes: Optional[int] = None
    ) -> EventAttendee:
        """Добавление участника к событию"""
        # Проверяем, не является ли пользователь уже участником
        existing = await self.session.execute(
            select(EventAttendee).where(
                and_(
                    EventAttendee.event_id == event_id,
                    EventAttendee.user_id == user_id
                )
            )
        )
        if existing.scalar_one_or_none():
            return existing.scalar_one_or_none()
        
        attendee = EventAttendee(
            event_id=event_id,
            user_id=user_id,
            role=role,
            response_status=response_status,
            send_reminders=send_reminders,
            reminder_minutes=reminder_minutes
        )
        
        self.session.add(attendee)
        await self.session.commit()
        
        return attendee
    
    async def update_attendee_response(
        self,
        event_id: int,
        user_id: int,
        response_status: str
    ) -> bool:
        """Обновление ответа участника"""
        attendee = await self.session.execute(
            select(EventAttendee).where(
                and_(
                    EventAttendee.event_id == event_id,
                    EventAttendee.user_id == user_id
                )
            )
        )
        attendee_obj = attendee.scalar_one_or_none()
        
        if not attendee_obj:
            return False
        
        attendee_obj.response_status = response_status
        attendee_obj.responded_at = datetime.utcnow()
        
        await self.session.commit()
        return True
    
    async def create_event_reminder(
        self,
        event_id: int,
        user_id: int,
        reminder_type: str = "notification",
        reminder_minutes: int = 15
    ) -> EventReminder:
        """Создание напоминания о событии"""
        # Получаем событие для вычисления времени напоминания
        event = await self.session.execute(
            select(CalendarEvent).where(CalendarEvent.id == event_id)
        )
        event_obj = event.scalar_one_or_none()
        
        if not event_obj:
            raise ValueError("Event not found")
        
        reminder_time = event_obj.start_time - timedelta(minutes=reminder_minutes)
        
        reminder = EventReminder(
            event_id=event_id,
            user_id=user_id,
            reminder_type=reminder_type,
            reminder_minutes=reminder_minutes,
            reminder_time=reminder_time
        )
        
        self.session.add(reminder)
        await self.session.commit()
        
        return reminder
    
    async def share_calendar(
        self,
        calendar_id: int,
        user_id: int,
        can_view: bool = True,
        can_edit: bool = False,
        can_share: bool = False,
        can_delete: bool = False,
        expires_at: Optional[datetime] = None
    ) -> CalendarShare:
        """Предоставление доступа к календарю"""
        # Проверяем, не предоставлен ли уже доступ
        existing = await self.session.execute(
            select(CalendarShare).where(
                and_(
                    CalendarShare.calendar_id == calendar_id,
                    CalendarShare.user_id == user_id
                )
            )
        )
        if existing.scalar_one_or_none():
            return existing.scalar_one_or_none()
        
        share = CalendarShare(
            calendar_id=calendar_id,
            user_id=user_id,
            can_view=can_view,
            can_edit=can_edit,
            can_share=can_share,
            can_delete=can_delete,
            expires_at=expires_at
        )
        
        self.session.add(share)
        await self.session.commit()
        
        return share
    
    async def get_user_events(
        self,
        user_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        event_types: Optional[List[EventType]] = None,
        status: Optional[EventStatus] = None,
        include_shared: bool = True,
        page: int = 1,
        per_page: int = 50
    ) -> Tuple[List[CalendarEvent], int]:
        """Получение всех событий пользователя"""
        # Получаем календари пользователя
        calendars = await self.get_user_calendars(user_id, include_shared=include_shared)
        calendar_ids = [cal.id for cal in calendars]
        
        if not calendar_ids:
            return [], 0
        
        query = select(CalendarEvent).where(CalendarEvent.calendar_id.in_(calendar_ids))
        
        # Фильтры по дате
        if start_date:
            query = query.where(CalendarEvent.start_time >= start_date)
        if end_date:
            query = query.where(CalendarEvent.end_time <= end_date)
        
        # Фильтры по типу события
        if event_types:
            query = query.where(CalendarEvent.event_type.in_(event_types))
        
        # Фильтр по статусу
        if status:
            query = query.where(CalendarEvent.status == status)
        
        # Подсчитываем общее количество
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await self.session.scalar(count_query)
        
        # Добавляем пагинацию и сортировку
        query = query.order_by(CalendarEvent.start_time).offset(
            (page - 1) * per_page
        ).limit(per_page)
        
        # Выполняем запрос с загрузкой связанных данных
        result = await self.session.execute(
            query.options(
                selectinload(CalendarEvent.calendar),
                selectinload(CalendarEvent.attendees),
                selectinload(CalendarEvent.reminders)
            )
        )
        
        events = result.scalars().all()
        return events, total_count
    
    async def get_upcoming_events(
        self,
        user_id: int,
        days: int = 7,
        limit: int = 20
    ) -> List[CalendarEvent]:
        """Получение предстоящих событий"""
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(days=days)
        
        events, _ = await self.get_user_events(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            per_page=limit
        )
        
        return events
    
    async def get_today_events(
        self,
        user_id: int
    ) -> List[CalendarEvent]:
        """Получение событий на сегодня"""
        today = datetime.utcnow().date()
        start_date = datetime.combine(today, datetime.min.time())
        end_date = datetime.combine(today, datetime.max.time())
        
        events, _ = await self.get_user_events(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return events
    
    async def create_event_from_template(
        self,
        template_id: int,
        calendar_id: int,
        start_time: datetime,
        title: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        **kwargs
    ) -> CalendarEvent:
        """Создание события из шаблона"""
        template = await self.session.execute(
            select(CalendarTemplate).where(CalendarTemplate.id == template_id)
        )
        template_obj = template.scalar_one_or_none()
        
        if not template_obj:
            raise ValueError("Template not found")
        
        # Вычисляем время окончания
        end_time = start_time + timedelta(minutes=template_obj.default_duration_minutes)
        
        # Используем шаблонные поля, если не указаны
        if not title and template_obj.title_template:
            title = template_obj.title_template
        if not description and template_obj.description_template:
            description = template_obj.description_template
        if not location and template_obj.location_template:
            location = template_obj.location_template
        
        return await self.create_event(
            calendar_id=calendar_id,
            title=title or f"Event from template: {template_obj.name}",
            start_time=start_time,
            end_time=end_time,
            description=description,
            event_type=template_obj.event_type,
            priority=template_obj.default_priority,
            location=location,
            reminder_minutes=template_obj.default_reminder_minutes,
            **kwargs
        )
    
    async def get_calendar_templates(
        self,
        user_id: int,
        include_public: bool = True
    ) -> List[CalendarTemplate]:
        """Получение шаблонов событий"""
        query = select(CalendarTemplate).where(
            or_(
                CalendarTemplate.creator_id == user_id,
                and_(CalendarTemplate.is_public == True, include_public)
            )
        ).where(CalendarTemplate.is_active == True).order_by(CalendarTemplate.name)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def create_calendar_template(
        self,
        creator_id: int,
        name: str,
        event_type: EventType,
        description: Optional[str] = None,
        default_duration_minutes: int = 60,
        default_priority: EventPriority = EventPriority.NORMAL,
        default_reminder_minutes: Optional[int] = 15,
        title_template: Optional[str] = None,
        description_template: Optional[str] = None,
        location_template: Optional[str] = None,
        is_public: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> CalendarTemplate:
        """Создание шаблона события"""
        template = CalendarTemplate(
            template_uuid=str(uuid.uuid4()),
            creator_id=creator_id,
            name=name,
            description=description,
            event_type=event_type,
            default_duration_minutes=default_duration_minutes,
            default_priority=default_priority,
            default_reminder_minutes=default_reminder_minutes,
            title_template=title_template,
            description_template=description_template,
            location_template=location_template,
            is_public=is_public,
            template_metadata=metadata or {}
        )
        
        self.session.add(template)
        await self.session.commit()
        
        return template
    
    async def get_pending_reminders(
        self,
        user_id: int,
        limit: int = 50
    ) -> List[EventReminder]:
        """Получение ожидающих напоминаний"""
        now = datetime.utcnow()
        
        query = select(EventReminder).where(
            and_(
                EventReminder.user_id == user_id,
                EventReminder.reminder_time <= now,
                EventReminder.is_sent == False
            )
        ).order_by(EventReminder.reminder_time).limit(limit)
        
        result = await self.session.execute(
            query.options(selectinload(EventReminder.event))
        )
        
        return result.scalars().all()
    
    async def mark_reminder_sent(
        self,
        reminder_id: int
    ) -> bool:
        """Отметка напоминания как отправленного"""
        reminder = await self.session.execute(
            select(EventReminder).where(EventReminder.id == reminder_id)
        )
        reminder_obj = reminder.scalar_one_or_none()
        
        if not reminder_obj:
            return False
        
        reminder_obj.is_sent = True
        reminder_obj.sent_at = datetime.utcnow()
        
        await self.session.commit()
        return True
