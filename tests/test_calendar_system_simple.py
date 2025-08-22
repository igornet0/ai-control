"""
Упрощенные функциональные тесты для системы календаря
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from typing import List, Dict, Any

from core.database.models.calendar_model import (
    EventType, EventPriority, EventStatus, RecurrenceType
)
from backend.api.services.calendar_service import CalendarService


class TestCalendarSystemSimple:
    """Упрощенные функциональные тесты системы календаря"""
    
    @pytest.fixture
    def mock_session(self):
        """Мок сессии базы данных"""
        session = MagicMock()
        
        # Настраиваем execute для возврата результата с scalar_one_or_none
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock()
        session.execute = AsyncMock(return_value=mock_result)
        
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.scalar = AsyncMock()
        session.add = MagicMock()
        session.get = MagicMock()
        session.delete = AsyncMock()
        return session
    
    @pytest.fixture
    def calendar_service(self, mock_session):
        """Сервис календаря с мок сессией"""
        return CalendarService(mock_session)
    
    def test_event_type_enum_values(self):
        """Тест значений enum EventType"""
        assert EventType.TASK == "task"
        assert EventType.MEETING == "meeting"
        assert EventType.DEADLINE == "deadline"
        assert EventType.REMINDER == "reminder"
        assert EventType.HOLIDAY == "holiday"
        assert EventType.BIRTHDAY == "birthday"
        assert EventType.CUSTOM == "custom"
    
    def test_event_priority_enum_values(self):
        """Тест значений enum EventPriority"""
        assert EventPriority.LOW == "low"
        assert EventPriority.NORMAL == "normal"
        assert EventPriority.HIGH == "high"
        assert EventPriority.URGENT == "urgent"
    
    def test_event_status_enum_values(self):
        """Тест значений enum EventStatus"""
        assert EventStatus.SCHEDULED == "scheduled"
        assert EventStatus.IN_PROGRESS == "in_progress"
        assert EventStatus.COMPLETED == "completed"
        assert EventStatus.CANCELLED == "cancelled"
        assert EventStatus.POSTPONED == "postponed"
    
    def test_recurrence_type_enum_values(self):
        """Тест значений enum RecurrenceType"""
        assert RecurrenceType.NONE == "none"
        assert RecurrenceType.DAILY == "daily"
        assert RecurrenceType.WEEKLY == "weekly"
        assert RecurrenceType.MONTHLY == "monthly"
        assert RecurrenceType.YEARLY == "yearly"
        assert RecurrenceType.CUSTOM == "custom"
    
    def test_enum_consistency(self):
        """Тест консистентности enum"""
        # Проверяем, что все значения уникальны
        event_types = [e.value for e in EventType]
        assert len(event_types) == len(set(event_types))
        
        event_priorities = [e.value for e in EventPriority]
        assert len(event_priorities) == len(set(event_priorities))
        
        event_statuses = [e.value for e in EventStatus]
        assert len(event_statuses) == len(set(event_statuses))
        
        recurrence_types = [e.value for e in RecurrenceType]
        assert len(recurrence_types) == len(set(recurrence_types))
    
    @pytest.mark.asyncio
    async def test_create_calendar_success(self, calendar_service, mock_session):
        """Тест успешного создания календаря"""
        # Подготавливаем моки
        mock_calendar = MagicMock()
        mock_calendar.id = 1
        mock_calendar.calendar_uuid = "test-uuid"
        mock_calendar.name = "Test Calendar"
        mock_calendar.owner_id = 1
        
        # Настраиваем add для возврата созданного календаря
        mock_session.add.side_effect = lambda obj: setattr(obj, 'id', 1)
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.create_calendar(
            owner_id=1,
            name="Test Calendar",
            description="Test description",
            color="#007bff",
            is_default=True,
            is_public=False,
            timezone="UTC"
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.name == "Test Calendar"
        assert result.owner_id == 1
        
        # Проверяем, что сессия была вызвана
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_user_calendars_success(self, calendar_service, mock_session):
        """Тест успешного получения календарей пользователя"""
        # Подготавливаем моки
        mock_calendars = [
            MagicMock(id=1, name="Calendar 1", owner_id=1),
            MagicMock(id=2, name="Calendar 2", owner_id=1)
        ]
        
        # Настраиваем execute для возврата календарей
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_calendars
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await calendar_service.get_user_calendars(user_id=1)
        
        # Проверяем результат
        assert result is not None
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_event_success(self, calendar_service, mock_session):
        """Тест успешного создания события"""
        # Подготавливаем моки
        mock_event = MagicMock()
        mock_event.id = 1
        mock_event.event_uuid = "event-uuid"
        mock_event.title = "Test Event"
        mock_event.calendar_id = 1
        mock_event.start_time = datetime.now()
        mock_event.end_time = datetime.now() + timedelta(hours=1)
        
        mock_session.add.return_value = None
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.create_event(
            calendar_id=1,
            title="Test Event",
            description="Test event description",
            event_type=EventType.MEETING,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            priority=EventPriority.NORMAL
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.event_uuid == "event-uuid"
        assert result.title == "Test Event"
        assert result.calendar_id == 1
        
        # Проверяем, что сессия была вызвана
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_event_success(self, calendar_service, mock_session):
        """Тест успешного обновления события"""
        # Подготавливаем моки
        mock_event = MagicMock()
        mock_event.id = 1
        mock_event.title = "Updated Event"
        mock_event.description = "Updated description"
        
        # Настраиваем execute для возврата события
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_event
        mock_session.execute.return_value = mock_result
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.update_event(
            event_id=1,
            title="Updated Event",
            description="Updated description",
            priority=EventPriority.HIGH
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.title == "Updated Event"
        assert result.description == "Updated description"
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_delete_event_success(self, calendar_service, mock_session):
        """Тест успешного удаления события"""
        # Подготавливаем моки
        mock_event = MagicMock()
        mock_event.id = 1
        mock_event.title = "Test Event"
        
        # Настраиваем execute для возврата события
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_event
        mock_session.execute.return_value = mock_result
        mock_session.delete.return_value = None
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.delete_event(event_id=1)
        
        # Проверяем результат
        assert result is True
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
        mock_session.delete.assert_called_once_with(mock_event)
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_add_event_attendee_success(self, calendar_service, mock_session):
        """Тест успешного добавления участника события"""
        # Подготавливаем моки
        mock_attendee = MagicMock()
        mock_attendee.id = 1
        mock_attendee.event_id = 1
        mock_attendee.user_id = 2
        mock_attendee.response_status = "pending"
        mock_attendee.role = "attendee"
        
        # Настраиваем execute для возврата None (участник не существует)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result
        
        # Настраиваем add для возврата созданного участника
        mock_session.add.side_effect = lambda obj: setattr(obj, 'id', 1)
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.add_event_attendee(
            event_id=1,
            user_id=2,
            role="attendee",
            send_reminders=True
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.event_id == 1
        assert result.user_id == 2
        assert result.response_status == "pending"
        assert result.role == "attendee"
        
        # Проверяем, что сессия была вызвана
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_attendee_response_success(self, calendar_service, mock_session):
        """Тест успешного обновления ответа участника"""
        # Подготавливаем моки
        mock_attendee = MagicMock()
        mock_attendee.id = 1
        mock_attendee.response_status = "accepted"
        mock_attendee.responded_at = datetime.now()
        
        # Настраиваем execute для возврата участника
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_attendee
        mock_session.execute.return_value = mock_result
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.update_attendee_response(
            event_id=1,
            user_id=2,
            response_status="accepted"
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.response_status == "accepted"
        assert result.responded_at is not None
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_event_reminder_success(self, calendar_service, mock_session):
        """Тест успешного создания напоминания о событии"""
        # Подготавливаем моки
        mock_event = MagicMock()
        mock_event.start_time = datetime.now() + timedelta(hours=1)
        
        mock_reminder = MagicMock()
        mock_reminder.id = 1
        mock_reminder.event_id = 1
        mock_reminder.user_id = 1
        mock_reminder.reminder_type = "notification"
        mock_reminder.reminder_minutes = 15
        mock_reminder.is_sent = False
        
        # Настраиваем execute для возврата события
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_event
        mock_session.execute.return_value = mock_result
        
        # Настраиваем add для возврата созданного напоминания
        mock_session.add.side_effect = lambda obj: setattr(obj, 'id', 1)
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.create_event_reminder(
            event_id=1,
            user_id=1,
            reminder_type="notification",
            reminder_minutes=15
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.event_id == 1
        assert result.user_id == 1
        assert result.reminder_type == "notification"
        assert result.reminder_minutes == 15
        assert result.is_sent == False
        
        # Проверяем, что сессия была вызвана
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_share_calendar_success(self, calendar_service, mock_session):
        """Тест успешного предоставления доступа к календарю"""
        # Подготавливаем моки
        mock_share = MagicMock()
        mock_share.id = 1
        mock_share.calendar_id = 1
        mock_share.user_id = 2
        mock_share.can_view = True
        mock_share.can_edit = False
        mock_share.can_share = False
        mock_share.can_delete = False
        
        # Настраиваем execute для возврата None (доступ не существует)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result
        
        # Настраиваем add для возврата созданного доступа
        mock_session.add.side_effect = lambda obj: setattr(obj, 'id', 1)
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.share_calendar(
            calendar_id=1,
            user_id=2,
            can_view=True,
            can_edit=False,
            can_share=False,
            can_delete=False
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.calendar_id == 1
        assert result.user_id == 2
        assert result.can_view == True
        assert result.can_edit == False
        assert result.can_share == False
        assert result.can_delete == False
        
        # Проверяем, что сессия была вызвана
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_user_events_success(self, calendar_service, mock_session):
        """Тест успешного получения событий пользователя"""
        # Подготавливаем моки
        mock_calendars = [MagicMock(id=1, name="Calendar 1")]
        mock_events = [
            MagicMock(id=1, title="Event 1", calendar_id=1),
            MagicMock(id=2, title="Event 2", calendar_id=1)
        ]
        
        # Настраиваем execute для возврата календарей и событий
        mock_calendar_result = MagicMock()
        mock_calendar_result.scalars.return_value.all.return_value = mock_calendars
        
        mock_events_result = MagicMock()
        mock_events_result.scalars.return_value.all.return_value = mock_events
        
        # Настраиваем execute для возврата разных результатов в зависимости от вызова
        mock_session.execute.side_effect = [mock_calendar_result, mock_events_result]
        
        # Вызываем метод
        result = await calendar_service.get_user_events(
            user_id=1,
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(days=7)
        )
        
        # Проверяем результат
        assert result is not None
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        
        # Проверяем, что сессия была вызвана
        assert mock_session.execute.call_count == 2
    
    @pytest.mark.asyncio
    async def test_get_upcoming_events_success(self, calendar_service, mock_session):
        """Тест успешного получения предстоящих событий"""
        # Подготавливаем моки
        mock_calendars = [MagicMock(id=1, name="Calendar 1")]
        mock_events = [
            MagicMock(id=1, title="Upcoming Event 1", start_time=datetime.now() + timedelta(hours=1)),
            MagicMock(id=2, title="Upcoming Event 2", start_time=datetime.now() + timedelta(hours=2))
        ]
        
        # Настраиваем execute для возврата календарей и событий
        mock_calendar_result = MagicMock()
        mock_calendar_result.scalars.return_value.all.return_value = mock_calendars
        
        mock_events_result = MagicMock()
        mock_events_result.scalars.return_value.all.return_value = mock_events
        
        # Настраиваем execute для возврата разных результатов в зависимости от вызова
        mock_session.execute.side_effect = [mock_calendar_result, mock_events_result]
        
        # Вызываем метод
        result = await calendar_service.get_upcoming_events(user_id=1, limit=10)
        
        # Проверяем результат
        assert result is not None
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        
        # Проверяем, что сессия была вызвана
        assert mock_session.execute.call_count == 2
    
    @pytest.mark.asyncio
    async def test_get_today_events_success(self, calendar_service, mock_session):
        """Тест успешного получения событий на сегодня"""
        # Подготавливаем моки
        mock_calendars = [MagicMock(id=1, name="Calendar 1")]
        mock_events = [
            MagicMock(id=1, title="Today Event 1", start_time=datetime.now()),
            MagicMock(id=2, title="Today Event 2", start_time=datetime.now() + timedelta(hours=1))
        ]
        
        # Настраиваем execute для возврата календарей и событий
        mock_calendar_result = MagicMock()
        mock_calendar_result.scalars.return_value.all.return_value = mock_calendars
        
        mock_events_result = MagicMock()
        mock_events_result.scalars.return_value.all.return_value = mock_events
        
        # Настраиваем execute для возврата разных результатов в зависимости от вызова
        mock_session.execute.side_effect = [mock_calendar_result, mock_events_result]
        
        # Вызываем метод
        result = await calendar_service.get_today_events(user_id=1)
        
        # Проверяем результат
        assert result is not None
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        
        # Проверяем, что сессия была вызвана
        assert mock_session.execute.call_count == 2
    
    @pytest.mark.asyncio
    async def test_create_event_from_template_success(self, calendar_service, mock_session):
        """Тест успешного создания события из шаблона"""
        # Подготавливаем моки
        mock_template = MagicMock()
        mock_template.id = 1
        mock_template.name = "Meeting Template"
        mock_template.event_type = EventType.MEETING
        mock_template.default_duration_minutes = 60
        mock_template.default_priority = EventPriority.NORMAL
        
        mock_event = MagicMock()
        mock_event.id = 1
        mock_event.title = "Meeting from Template"
        mock_event.event_type = EventType.MEETING
        
        # Настраиваем execute для возврата шаблона
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_template
        mock_session.execute.return_value = mock_result
        
        # Настраиваем add для возврата созданного события
        mock_session.add.side_effect = lambda obj: setattr(obj, 'id', 1)
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.create_event_from_template(
            template_id=1,
            calendar_id=1,
            title="Meeting from Template",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1)
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.title == "Meeting from Template"
        assert result.event_type == EventType.MEETING
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_calendar_templates_success(self, calendar_service, mock_session):
        """Тест успешного получения шаблонов календаря"""
        # Подготавливаем моки
        mock_templates = [
            MagicMock(id=1, name="Template 1", event_type=EventType.MEETING),
            MagicMock(id=2, name="Template 2", event_type=EventType.TASK)
        ]
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_templates
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await calendar_service.get_calendar_templates(
            event_type=EventType.MEETING
        )
        
        # Проверяем результат
        assert result is not None
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_calendar_template_success(self, calendar_service, mock_session):
        """Тест успешного создания шаблона календаря"""
        # Подготавливаем моки
        mock_template = MagicMock()
        mock_template.id = 1
        mock_template.template_uuid = "template-uuid"
        mock_template.name = "Test Template"
        mock_template.creator_id = 1
        mock_template.event_type = EventType.MEETING
        
        # Настраиваем add для возврата созданного шаблона
        mock_session.add.side_effect = lambda obj: setattr(obj, 'id', 1)
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.create_calendar_template(
            creator_id=1,
            name="Test Template",
            description="Test template description",
            event_type=EventType.MEETING,
            default_duration_minutes=60,
            default_priority=EventPriority.NORMAL
        )
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.name == "Test Template"
        assert result.creator_id == 1
        assert result.event_type == EventType.MEETING
        
        # Проверяем, что сессия была вызвана
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_pending_reminders_success(self, calendar_service, mock_session):
        """Тест успешного получения ожидающих напоминаний"""
        # Подготавливаем моки
        mock_reminders = [
            MagicMock(id=1, event_id=1, user_id=1, reminder_time=datetime.now() + timedelta(minutes=5)),
            MagicMock(id=2, event_id=2, user_id=1, reminder_time=datetime.now() + timedelta(minutes=10))
        ]
        
        # Настраиваем execute для возврата напоминаний
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_reminders
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await calendar_service.get_pending_reminders(user_id=1)
        
        # Проверяем результат
        assert result is not None
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_mark_reminder_sent_success(self, calendar_service, mock_session):
        """Тест успешной отметки напоминания как отправленного"""
        # Подготавливаем моки
        mock_reminder = MagicMock()
        mock_reminder.id = 1
        mock_reminder.is_sent = True
        mock_reminder.sent_at = datetime.now()
        
        # Настраиваем execute для возврата напоминания
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_reminder
        mock_session.execute.return_value = mock_result
        mock_session.flush.return_value = None
        
        # Вызываем метод
        result = await calendar_service.mark_reminder_sent(reminder_id=1)
        
        # Проверяем результат
        assert result is not None
        assert result.id == 1
        assert result.is_sent == True
        assert result.sent_at is not None
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
        mock_session.flush.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_calendar_events_success(self, calendar_service, mock_session):
        """Тест успешного получения событий календаря"""
        # Подготавливаем моки
        mock_events = [
            MagicMock(id=1, title="Calendar Event 1", calendar_id=1),
            MagicMock(id=2, title="Calendar Event 2", calendar_id=1)
        ]
        
        # Настраиваем execute для возврата событий
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_events
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await calendar_service.get_calendar_events(
            calendar_id=1,
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(days=7)
        )
        
        # Проверяем результат
        assert result is not None
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        
        # Проверяем, что сессия была вызвана
        mock_session.execute.assert_called_once()
    
    def test_event_type_validation(self):
        """Тест валидации типов событий"""
        # Проверяем, что все типы событий валидны
        valid_types = ["task", "meeting", "deadline", "reminder", "holiday", "birthday", "custom"]
        
        for event_type in EventType:
            assert event_type.value in valid_types
    
    def test_event_priority_validation(self):
        """Тест валидации приоритетов событий"""
        # Проверяем, что все приоритеты валидны
        valid_priorities = ["low", "normal", "high", "urgent"]
        
        for priority in EventPriority:
            assert priority.value in valid_priorities
    
    def test_event_status_validation(self):
        """Тест валидации статусов событий"""
        # Проверяем, что все статусы валидны
        valid_statuses = ["scheduled", "in_progress", "completed", "cancelled", "postponed"]
        
        for status in EventStatus:
            assert status.value in valid_statuses
    
    def test_recurrence_type_validation(self):
        """Тест валидации типов повторения"""
        # Проверяем, что все типы повторения валидны
        valid_recurrence_types = ["none", "daily", "weekly", "monthly", "yearly", "custom"]
        
        for recurrence_type in RecurrenceType:
            assert recurrence_type.value in valid_recurrence_types
    
    def test_enum_inheritance(self):
        """Тест наследования enum"""
        # Проверяем, что все enum наследуются от str
        assert issubclass(EventType, str)
        assert issubclass(EventPriority, str)
        assert issubclass(EventStatus, str)
        assert issubclass(RecurrenceType, str)
    
    def test_enum_immutability(self):
        """Тест неизменяемости enum"""
        # Проверяем, что значения enum нельзя изменить
        original_task_value = EventType.TASK
        
        # Попытка изменить значение должна вызвать ошибку
        with pytest.raises(AttributeError):
            EventType.TASK = "new_task"
        
        # Значение должно остаться неизменным
        assert EventType.TASK == original_task_value
