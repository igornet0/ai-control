"""
Сервис для работы с видеозвонками
"""
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database.models.video_call_model import (
    VideoCall, CallParticipant, CallRecording, ScheduledMeeting, 
    MeetingParticipant, MeetingReminder, CallStatistics, CallTemplate,
    CallType, CallStatus, ParticipantStatus, RecordingStatus
)
from core.database.models.main_models import User


class VideoCallService:
    """Сервис для управления видеозвонками"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_video_call(
        self,
        initiator_id: int,
        call_type: CallType,
        title: Optional[str] = None,
        description: Optional[str] = None,
        max_participants: int = 10,
        is_private: bool = False,
        allow_recording: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> VideoCall:
        """Создание нового видеозвонка"""
        call = VideoCall(
            call_uuid=str(uuid.uuid4()),
            initiator_id=initiator_id,
            call_type=call_type,
            title=title or f"{call_type.value.capitalize()} Call",
            description=description,
            max_participants=max_participants,
            is_private=is_private,
            allow_recording=allow_recording,
            call_metadata=metadata or {},
            status=CallStatus.INITIATED,
            created_at=datetime.utcnow()
        )
        
        self.session.add(call)
        await self.session.flush()
        
        # Добавляем инициатора как участника
        await self.add_participant(
            call_id=call.id,
            user_id=initiator_id,
            role="host"
        )
        
        return call
    
    async def add_participant(
        self,
        call_id: int,
        user_id: int,
        role: str = "participant",
        permissions: Optional[Dict[str, bool]] = None
    ) -> CallParticipant:
        """Добавление участника в звонок"""
        # Проверяем, не является ли пользователь уже участником
        existing = await self.session.execute(
            select(CallParticipant).where(
                and_(
                    CallParticipant.call_id == call_id,
                    CallParticipant.user_id == user_id
                )
            )
        )
        if existing.scalar_one_or_none():
            return existing.scalar_one_or_none()
        
        participant = CallParticipant(
            call_id=call_id,
            user_id=user_id,
            role=role,
            status=ParticipantStatus.INVITED,
            permissions=permissions or {},
            joined_at=None,
            left_at=None,
            created_at=datetime.utcnow()
        )
        
        self.session.add(participant)
        await self.session.flush()
        
        return participant
    
    async def join_call(self, call_id: int, user_id: int) -> bool:
        """Присоединение к звонку"""
        participant = await self.session.execute(
            select(CallParticipant).where(
                and_(
                    CallParticipant.call_id == call_id,
                    CallParticipant.user_id == user_id
                )
            )
        )
        participant_obj = participant.scalar_one_or_none()
        
        if not participant_obj:
            return False
        
        # Обновляем статус участника
        participant_obj.status = ParticipantStatus.JOINED
        participant_obj.joined_at = datetime.utcnow()
        
        # Обновляем статус звонка, если это первый участник
        call = await self.session.execute(
            select(VideoCall).where(VideoCall.id == call_id)
        )
        call_obj = call.scalar_one_or_none()
        
        if call_obj and call_obj.status == CallStatus.INITIATED:
            call_obj.status = CallStatus.CONNECTED
        
        await self.session.commit()
        return True
    
    async def leave_call(self, call_id: int, user_id: int) -> bool:
        """Выход из звонка"""
        participant = await self.session.execute(
            select(CallParticipant).where(
                and_(
                    CallParticipant.call_id == call_id,
                    CallParticipant.user_id == user_id
                )
            )
        )
        participant_obj = participant.scalar_one_or_none()
        
        if not participant_obj:
            return False
        
        # Обновляем статус участника
        participant_obj.status = ParticipantStatus.LEFT
        participant_obj.left_at = datetime.utcnow()
        
        # Проверяем, остались ли участники в звонке
        active_participants = await self.session.execute(
            select(func.count(CallParticipant.id)).where(
                and_(
                    CallParticipant.call_id == call_id,
                    CallParticipant.status == ParticipantStatus.JOINED
                )
            )
        )
        active_count = active_participants.scalar()
        
        # Если не осталось активных участников, завершаем звонок
        if active_count == 0:
            call = await self.session.execute(
                select(VideoCall).where(VideoCall.id == call_id)
            )
            call_obj = call.scalar_one_or_none()
            if call_obj:
                call_obj.status = CallStatus.ENDED
                call_obj.ended_at = datetime.utcnow()
        
        await self.session.commit()
        return True
    
    async def start_recording(self, call_id: int, started_by_id: int) -> CallRecording:
        """Начало записи звонка"""
        # Проверяем права на запись
        participant = await self.session.execute(
            select(CallParticipant).where(
                and_(
                    CallParticipant.call_id == call_id,
                    CallParticipant.user_id == started_by_id
                )
            )
        )
        participant_obj = participant.scalar_one_or_none()
        
        if not participant_obj or not participant_obj.permissions.get("can_record", False):
            raise ValueError("User does not have permission to record")
        
        # Проверяем, разрешена ли запись для этого звонка
        call = await self.session.execute(
            select(VideoCall).where(VideoCall.id == call_id)
        )
        call_obj = call.scalar_one_or_none()
        
        if not call_obj or not call_obj.allow_recording:
            raise ValueError("Recording is not allowed for this call")
        
        # Создаем запись
        recording = CallRecording(
            call_id=call_id,
            recording_uuid=str(uuid.uuid4()),
            started_by_id=started_by_id,
            status=RecordingStatus.RECORDING,
            file_path=None,
            file_size=0,
            duration=0,
            started_at=datetime.utcnow(),
            stopped_at=None,
            metadata={}
        )
        
        self.session.add(recording)
        await self.session.flush()
        
        return recording
    
    async def stop_recording(self, recording_id: int, stopped_by_id: int) -> bool:
        """Остановка записи звонка"""
        recording = await self.session.execute(
            select(CallRecording).where(CallRecording.id == recording_id)
        )
        recording_obj = recording.scalar_one_or_none()
        
        if not recording_obj or recording_obj.status != RecordingStatus.RECORDING:
            return False
        
        # Обновляем статус записи
        recording_obj.status = RecordingStatus.STOPPED
        recording_obj.stopped_at = datetime.utcnow()
        
        # Вычисляем длительность
        if recording_obj.started_at:
            duration = (recording_obj.stopped_at - recording_obj.started_at).total_seconds()
            recording_obj.duration = int(duration)
        
        await self.session.commit()
        return True
    
    async def create_scheduled_meeting(
        self,
        organizer_id: int,
        title: str,
        description: Optional[str] = None,
        scheduled_at: datetime = None,
        duration_minutes: int = 60,
        call_type: CallType = CallType.VIDEO,
        max_participants: int = 10,
        is_private: bool = False,
        allow_recording: bool = False,
        meeting_link: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ScheduledMeeting:
        """Создание запланированной встречи"""
        meeting = ScheduledMeeting(
            meeting_uuid=str(uuid.uuid4()),
            organizer_id=organizer_id,
            title=title,
            description=description,
            scheduled_at=scheduled_at or datetime.utcnow() + timedelta(hours=1),
            duration_minutes=duration_minutes,
            call_type=call_type,
            max_participants=max_participants,
            is_private=is_private,
            allow_recording=allow_recording,
            meeting_link=meeting_link,
            status="scheduled",
            metadata=metadata or {},
            created_at=datetime.utcnow()
        )
        
        self.session.add(meeting)
        await self.session.flush()
        
        # Добавляем организатора как участника
        await self.add_meeting_participant(
            meeting_id=meeting.id,
            user_id=organizer_id,
            role="organizer"
        )
        
        return meeting
    
    async def add_meeting_participant(
        self,
        meeting_id: int,
        user_id: int,
        role: str = "participant",
        send_reminder: bool = True
    ) -> MeetingParticipant:
        """Добавление участника в запланированную встречу"""
        # Проверяем, не является ли пользователь уже участником
        existing = await self.session.execute(
            select(MeetingParticipant).where(
                and_(
                    MeetingParticipant.meeting_id == meeting_id,
                    MeetingParticipant.user_id == user_id
                )
            )
        )
        if existing.scalar_one_or_none():
            return existing.scalar_one_or_none()
        
        participant = MeetingParticipant(
            meeting_id=meeting_id,
            user_id=user_id,
            role=role,
            status="invited",
            response_status="pending",
            joined_at=None,
            left_at=None,
            created_at=datetime.utcnow()
        )
        
        self.session.add(participant)
        await self.session.flush()
        
        # Создаем напоминание, если нужно
        if send_reminder:
            await self.create_meeting_reminder(
                meeting_id=meeting_id,
                user_id=user_id,
                reminder_type="email",
                reminder_time_minutes=15
            )
        
        return participant
    
    async def create_meeting_reminder(
        self,
        meeting_id: int,
        user_id: int,
        reminder_type: str = "email",
        reminder_time_minutes: int = 15
    ) -> MeetingReminder:
        """Создание напоминания о встрече"""
        meeting = await self.session.execute(
            select(ScheduledMeeting).where(ScheduledMeeting.id == meeting_id)
        )
        meeting_obj = meeting.scalar_one_or_none()
        
        if not meeting_obj:
            raise ValueError("Meeting not found")
        
        reminder = MeetingReminder(
            meeting_id=meeting_id,
            user_id=user_id,
            reminder_type=reminder_type,
            reminder_time=meeting_obj.scheduled_at - timedelta(minutes=reminder_time_minutes),
            is_sent=False,
            sent_at=None,
            created_at=datetime.utcnow()
        )
        
        self.session.add(reminder)
        await self.session.flush()
        
        return reminder
    
    async def get_user_calls(
        self,
        user_id: int,
        page: int = 1,
        per_page: int = 20,
        status: Optional[CallStatus] = None
    ) -> Tuple[List[VideoCall], int]:
        """Получение звонков пользователя"""
        # Базовый запрос
        query = select(VideoCall).join(CallParticipant).where(
            CallParticipant.user_id == user_id
        )
        
        # Фильтр по статусу
        if status:
            query = query.where(VideoCall.status == status)
        
        # Подсчитываем общее количество
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await self.session.scalar(count_query)
        
        # Добавляем пагинацию и сортировку
        query = query.order_by(desc(VideoCall.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page)
        
        # Выполняем запрос с загрузкой связанных данных
        result = await self.session.execute(
            query.options(
                selectinload(VideoCall.participants),
                selectinload(VideoCall.recordings)
            )
        )
        
        calls = result.scalars().all()
        return calls, total_count
    
    async def get_call_statistics(
        self,
        call_id: int
    ) -> CallStatistics:
        """Получение статистики звонка"""
        # Получаем информацию о звонке
        call = await self.session.execute(
            select(VideoCall).where(VideoCall.id == call_id)
        )
        call_obj = call.scalar_one_or_none()
        
        if not call_obj:
            raise ValueError("Call not found")
        
        # Подсчитываем участников
        participants_count = await self.session.scalar(
            select(func.count(CallParticipant.id)).where(
                CallParticipant.call_id == call_id
            )
        )
        
        # Подсчитываем активных участников
        active_participants = await self.session.scalar(
            select(func.count(CallParticipant.id)).where(
                and_(
                    CallParticipant.call_id == call_id,
                    CallParticipant.status == ParticipantStatus.JOINED
                )
            )
        )
        
        # Вычисляем длительность
        duration = 0
        if call_obj.started_at and call_obj.ended_at:
            duration = int((call_obj.ended_at - call_obj.started_at).total_seconds())
        elif call_obj.started_at:
            duration = int((datetime.utcnow() - call_obj.started_at).total_seconds())
        
        # Создаем или обновляем статистику
        existing_stats = await self.session.execute(
            select(CallStatistics).where(CallStatistics.call_id == call_id)
        )
        stats_obj = existing_stats.scalar_one_or_none()
        
        if stats_obj:
            stats_obj.participants_count = participants_count
            stats_obj.active_participants_count = active_participants
            stats_obj.duration_seconds = duration
            stats_obj.updated_at = datetime.utcnow()
        else:
            stats_obj = CallStatistics(
                call_id=call_id,
                participants_count=participants_count,
                active_participants_count=active_participants,
                duration_seconds=duration,
                recording_count=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.session.add(stats_obj)
        
        await self.session.commit()
        return stats_obj
    
    async def create_call_template(
        self,
        creator_id: int,
        name: str,
        description: Optional[str] = None,
        call_type: CallType = CallType.VIDEO,
        max_participants: int = 10,
        allow_recording: bool = False,
        settings: Optional[Dict[str, Any]] = None,
        is_active: bool = True
    ) -> CallTemplate:
        """Создание шаблона звонка"""
        template = CallTemplate(
            template_uuid=str(uuid.uuid4()),
            creator_id=creator_id,
            name=name,
            description=description,
            call_type=call_type,
            max_participants=max_participants,
            allow_recording=allow_recording,
            settings=settings or {},
            is_active=is_active,
            created_at=datetime.utcnow()
        )
        
        self.session.add(template)
        await self.session.commit()
        
        return template
    
    async def get_call_templates(self, creator_id: int) -> List[CallTemplate]:
        """Получение шаблонов звонков пользователя"""
        result = await self.session.execute(
            select(CallTemplate).where(
                and_(
                    CallTemplate.creator_id == creator_id,
                    CallTemplate.is_active == True
                )
            ).order_by(desc(CallTemplate.created_at))
        )
        
        return result.scalars().all()
    
    async def delete_call_template(self, template_id: int, creator_id: int) -> bool:
        """Удаление шаблона звонка"""
        template = await self.session.execute(
            select(CallTemplate).where(
                and_(
                    CallTemplate.id == template_id,
                    CallTemplate.creator_id == creator_id
                )
            )
        )
        template_obj = template.scalar_one_or_none()
        
        if not template_obj:
            return False
        
        await self.session.delete(template_obj)
        await self.session.commit()
        
        return True
