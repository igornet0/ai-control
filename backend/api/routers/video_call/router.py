"""
API роутер для видеозвонков
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
from core.database.models.video_call_model import (
    CallType, CallStatus, ParticipantStatus, RecordingStatus
)
from backend.api.services.video_call_service import VideoCallService


# Pydantic модели для запросов
class VideoCallCreateRequest(BaseModel):
    """Запрос на создание видеозвонка"""
    call_type: CallType = Field(..., description="Тип звонка")
    title: Optional[str] = Field(None, description="Название звонка")
    description: Optional[str] = Field(None, description="Описание звонка")
    max_participants: int = Field(10, ge=1, le=100, description="Максимальное количество участников")
    is_private: bool = Field(False, description="Приватный звонок")
    allow_recording: bool = Field(False, description="Разрешить запись")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Дополнительные данные")


class ParticipantAddRequest(BaseModel):
    """Запрос на добавление участника"""
    user_id: int = Field(..., description="ID пользователя")
    role: str = Field("participant", description="Роль участника")
    permissions: Optional[Dict[str, bool]] = Field(None, description="Права участника")


class ScheduledMeetingCreateRequest(BaseModel):
    """Запрос на создание запланированной встречи"""
    title: str = Field(..., description="Название встречи")
    description: Optional[str] = Field(None, description="Описание встречи")
    scheduled_at: datetime = Field(..., description="Время встречи")
    duration_minutes: int = Field(60, ge=15, le=480, description="Длительность в минутах")
    call_type: CallType = Field(CallType.VIDEO, description="Тип звонка")
    max_participants: int = Field(10, ge=1, le=100, description="Максимальное количество участников")
    is_private: bool = Field(False, description="Приватная встреча")
    allow_recording: bool = Field(False, description="Разрешить запись")
    meeting_link: Optional[str] = Field(None, description="Ссылка на встречу")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Дополнительные данные")


class MeetingParticipantAddRequest(BaseModel):
    """Запрос на добавление участника встречи"""
    user_id: int = Field(..., description="ID пользователя")
    role: str = Field("participant", description="Роль участника")
    send_reminder: bool = Field(True, description="Отправить напоминание")


class CallTemplateCreateRequest(BaseModel):
    """Запрос на создание шаблона звонка"""
    name: str = Field(..., description="Название шаблона")
    description: Optional[str] = Field(None, description="Описание шаблона")
    call_type: CallType = Field(CallType.VIDEO, description="Тип звонка")
    max_participants: int = Field(10, ge=1, le=100, description="Максимальное количество участников")
    allow_recording: bool = Field(False, description="Разрешить запись")
    settings: Optional[Dict[str, Any]] = Field(None, description="Настройки шаблона")
    is_active: bool = Field(True, description="Активный шаблон")


# Pydantic модели для ответов
class VideoCallResponse(BaseModel):
    """Ответ с информацией о видеозвонке"""
    id: int
    call_uuid: str
    initiator_id: int
    call_type: CallType
    title: str
    description: Optional[str]
    max_participants: int
    is_private: bool
    allow_recording: bool
    status: CallStatus
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime
    metadata: Dict[str, Any]
    
    class Config:
        from_attributes = True


class CallParticipantResponse(BaseModel):
    """Ответ с информацией об участнике звонка"""
    id: int
    call_id: int
    user_id: int
    role: str
    status: ParticipantStatus
    permissions: Dict[str, bool]
    joined_at: Optional[datetime]
    left_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class CallRecordingResponse(BaseModel):
    """Ответ с информацией о записи звонка"""
    id: int
    call_id: int
    recording_uuid: str
    started_by_id: int
    status: RecordingStatus
    file_path: Optional[str]
    file_size: int
    duration: int
    started_at: datetime
    stopped_at: Optional[datetime]
    metadata: Dict[str, Any]
    
    class Config:
        from_attributes = True


class ScheduledMeetingResponse(BaseModel):
    """Ответ с информацией о запланированной встрече"""
    id: int
    meeting_uuid: str
    organizer_id: int
    title: str
    description: Optional[str]
    scheduled_at: datetime
    duration_minutes: int
    call_type: CallType
    max_participants: int
    is_private: bool
    allow_recording: bool
    meeting_link: Optional[str]
    status: str
    created_at: datetime
    metadata: Dict[str, Any]
    
    class Config:
        from_attributes = True


class CallStatisticsResponse(BaseModel):
    """Ответ со статистикой звонка"""
    id: int
    call_id: int
    participants_count: int
    active_participants_count: int
    duration_seconds: int
    recording_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CallTemplateResponse(BaseModel):
    """Ответ с информацией о шаблоне звонка"""
    id: int
    template_uuid: str
    creator_id: int
    name: str
    description: Optional[str]
    call_type: CallType
    max_participants: int
    allow_recording: bool
    settings: Dict[str, Any]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Создаем роутер
router = APIRouter(prefix="/video-calls", tags=["Video Calls"])


# Зависимости
async def get_video_call_service(session: AsyncSession = Depends(get_session)) -> VideoCallService:
    """Получение сервиса видеозвонков"""
    return VideoCallService(session)


# Эндпоинты для видеозвонков
@router.post("/", response_model=VideoCallResponse)
async def create_video_call(
    request: VideoCallCreateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Создание нового видеозвонка"""
    try:
        call = await service.create_video_call(
            initiator_id=current_user_id,
            call_type=request.call_type,
            title=request.title,
            description=request.description,
            max_participants=request.max_participants,
            is_private=request.is_private,
            allow_recording=request.allow_recording,
            metadata=request.metadata
        )
        return call
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[VideoCallResponse])
async def get_user_calls(
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(20, ge=1, le=100, description="Количество на странице"),
    status: Optional[CallStatus] = Query(None, description="Статус звонка"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Получение звонков пользователя"""
    try:
        calls, total_count = await service.get_user_calls(
            user_id=current_user_id,
            page=page,
            per_page=per_page,
            status=status
        )
        return calls
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{call_id}/participants", response_model=CallParticipantResponse)
async def add_participant(
    call_id: int,
    request: ParticipantAddRequest,
    service: VideoCallService = Depends(get_video_call_service)
):
    """Добавление участника в звонок"""
    try:
        participant = await service.add_participant(
            call_id=call_id,
            user_id=request.user_id,
            role=request.role,
            permissions=request.permissions
        )
        return participant
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{call_id}/join")
async def join_call(
    call_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Присоединение к звонку"""
    try:
        success = await service.join_call(call_id=call_id, user_id=current_user_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to join call")
        return {"message": "Successfully joined the call"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{call_id}/leave")
async def leave_call(
    call_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Выход из звонка"""
    try:
        success = await service.leave_call(call_id=call_id, user_id=current_user_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to leave call")
        return {"message": "Successfully left the call"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{call_id}/recordings/start")
async def start_recording(
    call_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Начало записи звонка"""
    try:
        recording = await service.start_recording(call_id=call_id, started_by_id=current_user_id)
        return {"message": "Recording started", "recording_id": recording.id}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/recordings/{recording_id}/stop")
async def stop_recording(
    recording_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Остановка записи звонка"""
    try:
        success = await service.stop_recording(recording_id=recording_id, stopped_by_id=current_user_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to stop recording")
        return {"message": "Recording stopped"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для запланированных встреч
@router.post("/meetings", response_model=ScheduledMeetingResponse)
async def create_scheduled_meeting(
    request: ScheduledMeetingCreateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Создание запланированной встречи"""
    try:
        meeting = await service.create_scheduled_meeting(
            organizer_id=current_user_id,
            title=request.title,
            description=request.description,
            scheduled_at=request.scheduled_at,
            duration_minutes=request.duration_minutes,
            call_type=request.call_type,
            max_participants=request.max_participants,
            is_private=request.is_private,
            allow_recording=request.allow_recording,
            meeting_link=request.meeting_link,
            metadata=request.metadata
        )
        return meeting
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/meetings/{meeting_id}/participants")
async def add_meeting_participant(
    meeting_id: int,
    request: MeetingParticipantAddRequest,
    service: VideoCallService = Depends(get_video_call_service)
):
    """Добавление участника в запланированную встречу"""
    try:
        participant = await service.add_meeting_participant(
            meeting_id=meeting_id,
            user_id=request.user_id,
            role=request.role,
            send_reminder=request.send_reminder
        )
        return {"message": "Participant added to meeting", "participant_id": participant.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для статистики
@router.get("/{call_id}/statistics", response_model=CallStatisticsResponse)
async def get_call_statistics(
    call_id: int,
    service: VideoCallService = Depends(get_video_call_service)
):
    """Получение статистики звонка"""
    try:
        stats = await service.get_call_statistics(call_id=call_id)
        return stats
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для шаблонов звонков
@router.post("/templates", response_model=CallTemplateResponse)
async def create_call_template(
    request: CallTemplateCreateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Создание шаблона звонка"""
    try:
        template = await service.create_call_template(
            creator_id=current_user_id,
            name=request.name,
            description=request.description,
            call_type=request.call_type,
            max_participants=request.max_participants,
            allow_recording=request.allow_recording,
            settings=request.settings,
            is_active=request.is_active
        )
        return template
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/templates", response_model=List[CallTemplateResponse])
async def get_call_templates(
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Получение шаблонов звонков пользователя"""
    try:
        templates = await service.get_call_templates(creator_id=current_user_id)
        return templates
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_call_template(
    template_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: VideoCallService = Depends(get_video_call_service)
):
    """Удаление шаблона звонка"""
    try:
        success = await service.delete_call_template(template_id=template_id, creator_id=current_user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Template not found")
        return {"message": "Template deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# WebSocket эндпоинт для реального времени
@router.websocket("/{call_id}/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    call_id: int,
    user_id: int = 1  # TODO: Получать из аутентификации
):
    """WebSocket эндпоинт для реального времени в видеозвонках"""
    await websocket.accept()
    try:
        while True:
            # Получаем сообщение от клиента
            data = await websocket.receive_text()
            message = {"call_id": call_id, "user_id": user_id, "data": data}
            
            # Отправляем ответ обратно (здесь можно добавить логику обработки)
            await websocket.send_text(f"Message received: {data}")
    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected from call {call_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()
