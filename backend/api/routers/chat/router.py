"""
API роутер для корпоративных чатов
"""
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_session
from core.database.models.chat_model import (
    ChatType, MessageType, MessageStatus, ChatRole, ChatSettings
)
from backend.api.services.chat_service import ChatService, websocket_manager
from backend.api.middleware.auth import get_current_user
from core.database.models.user_model import User

router = APIRouter(prefix="/chat", tags=["Chat"])


# Pydantic модели для запросов и ответов

class ChatCreateRequest(BaseModel):
    chat_type: ChatType = Field(..., description="Тип чата")
    name: Optional[str] = Field(None, description="Название чата")
    description: Optional[str] = Field(None, description="Описание чата")
    member_ids: Optional[List[int]] = Field(None, description="ID участников")
    is_private: bool = Field(False, description="Приватный чат")


class ChatResponse(BaseModel):
    id: int
    chat_uuid: str
    name: Optional[str]
    description: Optional[str]
    chat_type: ChatType
    is_private: bool
    is_archived: bool
    is_muted: bool
    avatar_url: Optional[str]
    background_color: Optional[str]
    member_count: int
    message_count: int
    last_message_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatMemberResponse(BaseModel):
    id: int
    user_id: int
    role: ChatRole
    is_active: bool
    is_muted: bool
    is_banned: bool
    notifications_enabled: bool
    sound_enabled: bool
    joined_at: datetime
    last_seen_at: Optional[datetime]
    last_read_at: Optional[datetime]
    user: Dict[str, Any]  # Базовая информация о пользователе

    class Config:
        from_attributes = True


class MessageCreateRequest(BaseModel):
    message_type: MessageType = Field(..., description="Тип сообщения")
    content: Optional[str] = Field(None, description="Содержимое сообщения")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Метаданные сообщения")
    reply_to_message_id: Optional[int] = Field(None, description="ID сообщения для ответа")


class MessageResponse(BaseModel):
    id: int
    message_uuid: str
    sender_id: int
    message_type: MessageType
    content: Optional[str]
    metadata: Optional[Dict[str, Any]]
    status: MessageStatus
    is_edited: bool
    is_deleted: bool
    reply_to_message_id: Optional[int]
    forward_from_message_id: Optional[int]
    sent_at: datetime
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    edited_at: Optional[datetime]
    sender: Dict[str, Any]  # Базовая информация об отправителе
    attachments: List[Dict[str, Any]]
    reactions: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    messages: List[MessageResponse]
    total_count: int
    page: int
    per_page: int
    total_pages: int


class ChatSettingsUpdateRequest(BaseModel):
    allow_member_invites: Optional[bool] = Field(None, description="Разрешить приглашения участников")
    allow_message_editing: Optional[bool] = Field(None, description="Разрешить редактирование сообщений")
    allow_message_deletion: Optional[bool] = Field(None, description="Разрешить удаление сообщений")
    allow_file_sharing: Optional[bool] = Field(None, description="Разрешить обмен файлами")
    allow_reactions: Optional[bool] = Field(None, description="Разрешить реакции")
    max_file_size: Optional[int] = Field(None, description="Максимальный размер файла")
    max_message_length: Optional[int] = Field(None, description="Максимальная длина сообщения")
    slow_mode_interval: Optional[int] = Field(None, description="Интервал медленного режима")


class ReactionRequest(BaseModel):
    emoji: str = Field(..., description="Эмодзи реакции")


class MessageEditRequest(BaseModel):
    content: str = Field(..., description="Новое содержимое сообщения")


# API эндпоинты

@router.post("/", response_model=ChatResponse)
async def create_chat(
    request: ChatCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Создание нового чата"""
    chat_service = ChatService(session)
    
    try:
        chat = await chat_service.create_chat(
            creator_id=current_user.id,
            chat_type=request.chat_type,
            name=request.name,
            description=request.description,
            member_ids=request.member_ids,
            is_private=request.is_private
        )
        return chat
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[ChatResponse])
async def get_user_chats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение чатов пользователя"""
    chat_service = ChatService(session)
    chats = await chat_service.get_user_chats(current_user.id)
    return chats


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение информации о чате"""
    chat_service = ChatService(session)
    chat = await chat_service.get_chat(chat_id, current_user.id)
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return chat


@router.post("/{chat_id}/members")
async def add_chat_member(
    chat_id: int,
    user_id: int,
    role: ChatRole = ChatRole.MEMBER,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Добавление участника в чат"""
    chat_service = ChatService(session)
    
    success = await chat_service.add_chat_member(
        chat_id=chat_id,
        user_id=user_id,
        added_by_id=current_user.id,
        role=role
    )
    
    if success:
        return {"message": "Member added successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to add member")


@router.delete("/{chat_id}/members/{user_id}")
async def remove_chat_member(
    chat_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Удаление участника из чата"""
    chat_service = ChatService(session)
    
    success = await chat_service.remove_chat_member(
        chat_id=chat_id,
        user_id=user_id,
        removed_by_id=current_user.id
    )
    
    if success:
        return {"message": "Member removed successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to remove member")


@router.get("/{chat_id}/members", response_model=List[ChatMemberResponse])
async def get_chat_members(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение участников чата"""
    chat_service = ChatService(session)
    members = await chat_service.get_chat_members(chat_id, current_user.id)
    return members


@router.post("/{chat_id}/messages", response_model=MessageResponse)
async def send_message(
    chat_id: int,
    request: MessageCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Отправка сообщения в чат"""
    chat_service = ChatService(session)
    
    try:
        message = await chat_service.send_message(
            chat_id=chat_id,
            sender_id=current_user.id,
            message_type=request.message_type,
            content=request.content,
            metadata=request.metadata,
            reply_to_message_id=request.reply_to_message_id
        )
        
        # Отправляем уведомление через WebSocket
        await websocket_manager.send_message_notification(message)
        
        return message
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{chat_id}/messages", response_model=MessageListResponse)
async def get_chat_messages(
    chat_id: int,
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(50, ge=1, le=100, description="Количество на странице"),
    before_message_id: Optional[int] = Query(None, description="ID сообщения для пагинации"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение сообщений чата"""
    chat_service = ChatService(session)
    
    messages, total_count = await chat_service.get_messages(
        chat_id=chat_id,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        before_message_id=before_message_id
    )
    
    total_pages = (total_count + per_page - 1) // per_page
    
    return MessageListResponse(
        messages=messages,
        total_count=total_count,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.post("/messages/{message_id}/read")
async def mark_message_as_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Отметить сообщение как прочитанное"""
    chat_service = ChatService(session)
    
    success = await chat_service.mark_message_as_read(message_id, current_user.id)
    
    if success:
        return {"message": "Message marked as read"}
    else:
        raise HTTPException(status_code=400, detail="Failed to mark message as read")


@router.post("/messages/{message_id}/reactions")
async def add_message_reaction(
    message_id: int,
    request: ReactionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Добавление реакции на сообщение"""
    chat_service = ChatService(session)
    
    success = await chat_service.add_message_reaction(
        message_id=message_id,
        user_id=current_user.id,
        emoji=request.emoji
    )
    
    if success:
        return {"message": "Reaction added successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to add reaction")


@router.delete("/messages/{message_id}/reactions/{emoji}")
async def remove_message_reaction(
    message_id: int,
    emoji: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Удаление реакции с сообщения"""
    chat_service = ChatService(session)
    
    success = await chat_service.remove_message_reaction(
        message_id=message_id,
        user_id=current_user.id,
        emoji=emoji
    )
    
    if success:
        return {"message": "Reaction removed successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to remove reaction")


@router.post("/messages/{message_id}/pin")
async def pin_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Закрепление сообщения"""
    chat_service = ChatService(session)
    
    success = await chat_service.pin_message(message_id, current_user.id)
    
    if success:
        return {"message": "Message pinned successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to pin message")


@router.delete("/messages/{message_id}/pin")
async def unpin_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Открепление сообщения"""
    chat_service = ChatService(session)
    
    success = await chat_service.unpin_message(message_id, current_user.id)
    
    if success:
        return {"message": "Message unpinned successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to unpin message")


@router.put("/messages/{message_id}")
async def edit_message(
    message_id: int,
    request: MessageEditRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Редактирование сообщения"""
    chat_service = ChatService(session)
    
    success = await chat_service.edit_message(
        message_id=message_id,
        user_id=current_user.id,
        new_content=request.content
    )
    
    if success:
        return {"message": "Message edited successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to edit message")


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Удаление сообщения"""
    chat_service = ChatService(session)
    
    success = await chat_service.delete_message(message_id, current_user.id)
    
    if success:
        return {"message": "Message deleted successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to delete message")


@router.put("/{chat_id}/settings")
async def update_chat_settings(
    chat_id: int,
    request: ChatSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Обновление настроек чата"""
    chat_service = ChatService(session)
    
    settings = request.dict(exclude_unset=True)
    success = await chat_service.update_chat_settings(
        chat_id=chat_id,
        user_id=current_user.id,
        settings=settings
    )
    
    if success:
        return {"message": "Chat settings updated successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to update chat settings")


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение количества непрочитанных сообщений по чатам"""
    chat_service = ChatService(session)
    unread_counts = await chat_service.get_unread_count(current_user.id)
    return unread_counts


@router.websocket("/ws/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...)
):
    """WebSocket эндпоинт для чата"""
    # Здесь должна быть проверка токена и получение пользователя
    # Пока используем заглушку
    user_id = 1  # В реальной реализации получаем из токена
    
    try:
        await websocket_manager.connect(websocket, chat_id, user_id)
        
        # Обновляем статус пользователя
        session = next(get_session())
        chat_service = ChatService(session)
        await chat_service.update_user_status(chat_id, user_id, True)
        
        # Отправляем уведомление о подключении
        await websocket_manager.send_user_status_update(chat_id, user_id, True)
        
        try:
            while True:
                # Получаем сообщения от клиента
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                message_type = message_data.get("type")
                
                if message_type == "typing":
                    # Отправляем индикатор печати
                    await websocket_manager.send_typing_indicator(
                        chat_id, user_id, message_data.get("is_typing", True)
                    )
                
                elif message_type == "message":
                    # Отправляем сообщение в чат
                    session = next(get_session())
                    chat_service = ChatService(session)
                    
                    message = await chat_service.send_message(
                        chat_id=chat_id,
                        sender_id=user_id,
                        message_type=MessageType.TEXT,
                        content=message_data.get("content")
                    )
                    
                    # Отправляем уведомление всем участникам
                    await websocket_manager.send_message_notification(message)
                
                elif message_type == "read":
                    # Отмечаем сообщение как прочитанное
                    message_id = message_data.get("message_id")
                    if message_id:
                        session = next(get_session())
                        chat_service = ChatService(session)
                        await chat_service.mark_message_as_read(message_id, user_id)
        
        except WebSocketDisconnect:
            pass
        
        finally:
            # Обновляем статус пользователя при отключении
            session = next(get_session())
            chat_service = ChatService(session)
            await chat_service.update_user_status(chat_id, user_id, False)
            
            # Отправляем уведомление об отключении
            await websocket_manager.send_user_status_update(chat_id, user_id, False)
            
            # Отключаем пользователя
            websocket_manager.disconnect(chat_id, user_id)
    
    except Exception as e:
        # В случае ошибки отключаем пользователя
        websocket_manager.disconnect(chat_id, user_id)
        raise e


@router.post("/{chat_id}/upload")
async def upload_file(
    chat_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Загрузка файла в чат"""
    # Проверяем права доступа к чату
    chat_service = ChatService(session)
    chat = await chat_service.get_chat(chat_id, current_user.id)
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Проверяем настройки чата
    settings_result = await session.execute(
        select(ChatSettings).where(ChatSettings.chat_id == chat_id)
    )
    chat_settings = settings_result.scalar_one_or_none()
    
    if chat_settings and not chat_settings.allow_file_sharing:
        raise HTTPException(status_code=403, detail="File sharing is not allowed in this chat")
    
    # Проверяем размер файла
    if chat_settings and file.size > chat_settings.max_file_size:
        raise HTTPException(status_code=413, detail="File too large")
    
    # Сохраняем файл
    file_path = f"uploads/chat_attachments/{file.filename}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Определяем тип сообщения
    message_type = MessageType.FILE
    if file.content_type.startswith("image/"):
        message_type = MessageType.IMAGE
    elif file.content_type.startswith("video/"):
        message_type = MessageType.VIDEO
    elif file.content_type.startswith("audio/"):
        message_type = MessageType.AUDIO
    
    # Создаем сообщение с файлом
    attachment_data = {
        "file_path": file_path,
        "file_name": file.filename,
        "mime_type": file.content_type,
        "size": file.size
    }
    
    message = await chat_service.send_message(
        chat_id=chat_id,
        sender_id=current_user.id,
        message_type=message_type,
        content=f"File: {file.filename}",
        metadata={"file_info": attachment_data},
        attachments=[attachment_data]
    )
    
    # Отправляем уведомление через WebSocket
    await websocket_manager.send_message_notification(message)
    
    return {
        "message": "File uploaded successfully",
        "message_id": message.id,
        "file_name": file.filename
    }


@router.get("/stats/{chat_id}")
async def get_chat_stats(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Получение статистики чата"""
    chat_service = ChatService(session)
    
    # Проверяем права доступа
    chat = await chat_service.get_chat(chat_id, current_user.id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Получаем статистику
    members = await chat_service.get_chat_members(chat_id, current_user.id)
    messages, total_messages = await chat_service.get_messages(chat_id, current_user.id, per_page=1)
    
    return {
        "chat_id": chat_id,
        "member_count": len(members),
        "total_messages": total_messages,
        "active_members": len([m for m in members if m.is_active]),
        "online_members": len([m for m in members if m.last_seen_at and (datetime.utcnow() - m.last_seen_at).seconds < 300])
    }
