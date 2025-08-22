"""
Сервис для работы с корпоративными чатами
"""
import asyncio
import json
import uuid
import hashlib
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple, Set
from pathlib import Path
from sqlalchemy import select, and_, or_, desc, asc, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import WebSocket, WebSocketDisconnect
import aiofiles

from core.database.models.chat_model import (
    Chat, ChatMember, ChatMessage, MessageAttachment, MessageReaction,
    MessageRead, PinnedMessage, ChatInvitation, ChatSettings, UserChatPreference,
    ChatType, MessageType, MessageStatus, ChatRole
)
from core.database.models.main_models import User


class ChatService:
    """Сервис для работы с корпоративными чатами"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.attachments_dir = Path("uploads/chat_attachments")
        self.attachments_dir.mkdir(parents=True, exist_ok=True)
    
    async def create_chat(
        self,
        creator_id: int,
        chat_type: ChatType,
        name: Optional[str] = None,
        description: Optional[str] = None,
        member_ids: Optional[List[int]] = None,
        is_private: bool = False
    ) -> Chat:
        """Создание нового чата"""
        # Создаем чат
        chat = Chat(
            chat_type=chat_type,
            name=name,
            description=description,
            is_private=is_private
        )
        
        self.session.add(chat)
        await self.session.flush()
        
        # Добавляем создателя как владельца
        creator_member = ChatMember(
            chat_id=chat.id,
            user_id=creator_id,
            role=ChatRole.OWNER
        )
        self.session.add(creator_member)
        
        # Добавляем других участников
        if member_ids:
            for user_id in member_ids:
                if user_id != creator_id:
                    member = ChatMember(
                        chat_id=chat.id,
                        user_id=user_id,
                        role=ChatRole.MEMBER
                    )
                    self.session.add(member)
        
        # Создаем настройки чата
        settings = ChatSettings(chat_id=chat.id)
        self.session.add(settings)
        
        await self.session.commit()
        
        # Обновляем количество участников
        chat.member_count = len(member_ids or []) + 1
        await self.session.commit()
        
        return chat
    
    async def get_user_chats(self, user_id: int) -> List[Chat]:
        """Получение чатов пользователя"""
        result = await self.session.execute(
            select(Chat)
            .join(ChatMember)
            .where(ChatMember.user_id == user_id)
            .options(
                selectinload(Chat.members).selectinload(ChatMember.user),
                selectinload(Chat.messages).selectinload(ChatMessage.sender)
            )
            .order_by(desc(Chat.last_message_at), desc(Chat.created_at))
        )
        return result.scalars().all()
    
    async def get_chat(self, chat_id: int, user_id: int) -> Optional[Chat]:
        """Получение чата с проверкой прав доступа"""
        result = await self.session.execute(
            select(Chat)
            .join(ChatMember)
            .where(
                and_(
                    Chat.id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
            .options(
                selectinload(Chat.members).selectinload(ChatMember.user),
                selectinload(Chat.messages).selectinload(ChatMessage.sender),
                selectinload(Chat.pinned_messages).selectinload(PinnedMessage.message)
            )
        )
        return result.scalar_one_or_none()
    
    async def add_chat_member(
        self, 
        chat_id: int, 
        user_id: int, 
        added_by_id: int,
        role: ChatRole = ChatRole.MEMBER
    ) -> bool:
        """Добавление участника в чат"""
        # Проверяем права на добавление участников
        can_add = await self._can_manage_members(chat_id, added_by_id)
        if not can_add:
            return False
        
        # Проверяем, что пользователь еще не в чате
        existing_member = await self.session.execute(
            select(ChatMember).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
        )
        if existing_member.scalar_one_or_none():
            return False
        
        # Добавляем участника
        member = ChatMember(
            chat_id=chat_id,
            user_id=user_id,
            role=role
        )
        self.session.add(member)
        
        # Обновляем количество участников
        chat = await self.session.get(Chat, chat_id)
        if chat:
            chat.member_count += 1
        
        await self.session.commit()
        return True
    
    async def remove_chat_member(
        self, 
        chat_id: int, 
        user_id: int, 
        removed_by_id: int
    ) -> bool:
        """Удаление участника из чата"""
        # Проверяем права на удаление участников
        can_remove = await self._can_manage_members(chat_id, removed_by_id)
        if not can_remove:
            return False
        
        # Удаляем участника
        result = await self.session.execute(
            delete(ChatMember).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
        )
        
        if result.rowcount > 0:
            # Обновляем количество участников
            chat = await self.session.get(Chat, chat_id)
            if chat:
                chat.member_count = max(0, chat.member_count - 1)
            
            await self.session.commit()
            return True
        
        return False
    
    async def _can_manage_members(self, chat_id: int, user_id: int) -> bool:
        """Проверка прав на управление участниками"""
        result = await self.session.execute(
            select(ChatMember.role).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
        )
        role = result.scalar_one_or_none()
        
        if not role:
            return False
        
        return role in [ChatRole.OWNER, ChatRole.ADMIN, ChatRole.MODERATOR]
    
    async def send_message(
        self,
        chat_id: int,
        sender_id: int,
        message_type: MessageType,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        reply_to_message_id: Optional[int] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> ChatMessage:
        """Отправка сообщения в чат"""
        # Проверяем, что отправитель является участником чата
        member = await self.session.execute(
            select(ChatMember).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == sender_id,
                    ChatMember.is_active == True
                )
            )
        )
        if not member.scalar_one_or_none():
            raise ValueError("User is not a member of this chat")
        
        # Создаем сообщение
        message = ChatMessage(
            chat_id=chat_id,
            sender_id=sender_id,
            message_type=message_type,
            content=content,
            message_metadata=metadata,
            reply_to_message_id=reply_to_message_id,
            status=MessageStatus.SENT,
            sent_at=datetime.utcnow()
        )
        
        self.session.add(message)
        await self.session.flush()
        
        # Добавляем вложения
        if attachments:
            for attachment_data in attachments:
                attachment = await self._create_message_attachment(
                    message.id, 
                    attachment_data
                )
                self.session.add(attachment)
        
        # Обновляем статистику чата
        chat = await self.session.get(Chat, chat_id)
        if chat:
            chat.message_count += 1
            chat.last_message_at = datetime.utcnow()
        
        await self.session.commit()
        return message
    
    async def _create_message_attachment(
        self, 
        message_id: int, 
        attachment_data: Dict[str, Any]
    ) -> MessageAttachment:
        """Создание вложения для сообщения"""
        file_path = attachment_data['file_path']
        file_name = attachment_data.get('file_name', os.path.basename(file_path))
        mime_type = attachment_data.get('mime_type', 'application/octet-stream')
        
        # Копируем файл в папку вложений
        file_hash = await self._calculate_file_hash(file_path)
        new_file_path = self.attachments_dir / f"{file_hash}_{file_name}"
        
        async with aiofiles.open(file_path, 'rb') as src, \
                   aiofiles.open(new_file_path, 'wb') as dst:
            content = await src.read()
            await dst.write(content)
        
        # Получаем размер файла
        file_size = len(content)
        
        attachment = MessageAttachment(
            message_id=message_id,
            file_name=file_name,
            file_path=str(new_file_path),
            file_size=file_size,
            mime_type=mime_type,
            file_hash=file_hash,
            thumbnail_url=attachment_data.get('thumbnail_url'),
            duration=attachment_data.get('duration'),
            width=attachment_data.get('width'),
            height=attachment_data.get('height')
        )
        
        return attachment
    
    async def _calculate_file_hash(self, file_path: str) -> str:
        """Вычисление хеша файла"""
        hash_md5 = hashlib.md5()
        async with aiofiles.open(file_path, 'rb') as f:
            while True:
                chunk = await f.read(4096)
                if not chunk:
                    break
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    async def get_messages(
        self,
        chat_id: int,
        user_id: int,
        page: int = 1,
        per_page: int = 50,
        before_message_id: Optional[int] = None
    ) -> Tuple[List[ChatMessage], int]:
        """Получение сообщений чата с пагинацией"""
        # Проверяем права доступа
        member = await self.session.execute(
            select(ChatMember).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
        )
        if not member.scalar_one_or_none():
            return [], 0
        
        # Базовый запрос
        query = select(ChatMessage).where(
            and_(
                ChatMessage.chat_id == chat_id,
                ChatMessage.is_deleted == False
            )
        )
        
        # Фильтр по ID сообщения (для пагинации)
        if before_message_id:
            query = query.where(ChatMessage.id < before_message_id)
        
        # Подсчитываем общее количество
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await self.session.scalar(count_query)
        
        # Добавляем пагинацию и сортировку
        query = query.order_by(desc(ChatMessage.sent_at)).offset(
            (page - 1) * per_page
        ).limit(per_page)
        
        # Выполняем запрос с загрузкой связанных данных
        result = await self.session.execute(
            query.options(
                selectinload(ChatMessage.sender),
                selectinload(ChatMessage.attachments),
                selectinload(ChatMessage.reactions),
                selectinload(ChatMessage.reply_to_message),
                selectinload(ChatMessage.forward_from_message)
            )
        )
        
        messages = result.scalars().all()
        return messages, total_count
    
    async def mark_message_as_read(
        self, 
        message_id: int, 
        user_id: int
    ) -> bool:
        """Отметить сообщение как прочитанное"""
        # Проверяем, что пользователь является участником чата
        message = await self.session.execute(
            select(ChatMessage)
            .join(ChatMember)
            .where(
                and_(
                    ChatMessage.id == message_id,
                    ChatMember.user_id == user_id,
                    ChatMember.chat_id == ChatMessage.chat_id
                )
            )
        )
        message_obj = message.scalar_one_or_none()
        
        if not message_obj:
            return False
        
        # Проверяем, не прочитано ли уже сообщение
        existing_read = await self.session.execute(
            select(MessageRead).where(
                and_(
                    MessageRead.message_id == message_id,
                    MessageRead.user_id == user_id
                )
            )
        )
        if existing_read.scalar_one_or_none():
            return True
        
        # Отмечаем как прочитанное
        read_record = MessageRead(
            message_id=message_id,
            user_id=user_id
        )
        self.session.add(read_record)
        
        # Обновляем статус сообщения
        message_obj.status = MessageStatus.READ
        message_obj.read_at = datetime.utcnow()
        
        await self.session.commit()
        return True
    
    async def add_message_reaction(
        self, 
        message_id: int, 
        user_id: int, 
        emoji: str
    ) -> bool:
        """Добавление реакции на сообщение"""
        # Проверяем, что пользователь является участником чата
        message = await self.session.execute(
            select(ChatMessage)
            .join(ChatMember)
            .where(
                and_(
                    ChatMessage.id == message_id,
                    ChatMember.user_id == user_id,
                    ChatMember.chat_id == ChatMessage.chat_id
                )
            )
        )
        if not message.scalar_one_or_none():
            return False
        
        # Проверяем, не добавлена ли уже такая реакция
        existing_reaction = await self.session.execute(
            select(MessageReaction).where(
                and_(
                    MessageReaction.message_id == message_id,
                    MessageReaction.user_id == user_id,
                    MessageReaction.emoji == emoji
                )
            )
        )
        if existing_reaction.scalar_one_or_none():
            return True  # Реакция уже существует
        
        # Добавляем реакцию
        reaction = MessageReaction(
            message_id=message_id,
            user_id=user_id,
            emoji=emoji
        )
        self.session.add(reaction)
        await self.session.commit()
        return True
    
    async def remove_message_reaction(
        self, 
        message_id: int, 
        user_id: int, 
        emoji: str
    ) -> bool:
        """Удаление реакции с сообщения"""
        result = await self.session.execute(
            delete(MessageReaction).where(
                and_(
                    MessageReaction.message_id == message_id,
                    MessageReaction.user_id == user_id,
                    MessageReaction.emoji == emoji
                )
            )
        )
        
        if result.rowcount > 0:
            await self.session.commit()
            return True
        
        return False
    
    async def pin_message(
        self, 
        message_id: int, 
        user_id: int
    ) -> bool:
        """Закрепление сообщения"""
        # Проверяем права на закрепление
        message = await self.session.execute(
            select(ChatMessage)
            .join(ChatMember)
            .where(
                and_(
                    ChatMessage.id == message_id,
                    ChatMember.user_id == user_id,
                    ChatMember.chat_id == ChatMessage.chat_id
                )
            )
        )
        message_obj = message.scalar_one_or_none()
        
        if not message_obj:
            return False
        
        # Проверяем, не закреплено ли уже сообщение
        existing_pin = await self.session.execute(
            select(PinnedMessage).where(
                PinnedMessage.message_id == message_id
            )
        )
        if existing_pin.scalar_one_or_none():
            return True
        
        # Закрепляем сообщение
        pinned_message = PinnedMessage(
            chat_id=message_obj.chat_id,
            message_id=message_id,
            pinned_by_id=user_id
        )
        self.session.add(pinned_message)
        await self.session.commit()
        return True
    
    async def unpin_message(
        self, 
        message_id: int, 
        user_id: int
    ) -> bool:
        """Открепление сообщения"""
        result = await self.session.execute(
            delete(PinnedMessage).where(
                PinnedMessage.message_id == message_id
            )
        )
        
        if result.rowcount > 0:
            await self.session.commit()
            return True
        
        return False
    
    async def edit_message(
        self, 
        message_id: int, 
        user_id: int, 
        new_content: str
    ) -> bool:
        """Редактирование сообщения"""
        # Получаем сообщение
        result = await self.session.execute(
            select(ChatMessage).where(ChatMessage.id == message_id)
        )
        message = result.scalar_one_or_none()
        
        if not message or message.sender_id != user_id:
            return False
        
        # Проверяем настройки чата
        settings = await self.session.execute(
            select(ChatSettings).where(ChatSettings.chat_id == message.chat_id)
        )
        chat_settings = settings.scalar_one_or_none()
        
        if chat_settings and not chat_settings.allow_message_editing:
            return False
        
        # Обновляем сообщение
        message.content = new_content
        message.is_edited = True
        message.edited_at = datetime.utcnow()
        
        await self.session.commit()
        return True
    
    async def delete_message(
        self, 
        message_id: int, 
        user_id: int
    ) -> bool:
        """Удаление сообщения"""
        # Получаем сообщение
        result = await self.session.execute(
            select(ChatMessage).where(ChatMessage.id == message_id)
        )
        message = result.scalar_one_or_none()
        
        if not message:
            return False
        
        # Проверяем права на удаление
        can_delete = False
        
        # Автор сообщения может удалить свое сообщение
        if message.sender_id == user_id:
            can_delete = True
        else:
            # Администраторы могут удалять любые сообщения
            member = await self.session.execute(
                select(ChatMember).where(
                    and_(
                        ChatMember.chat_id == message.chat_id,
                        ChatMember.user_id == user_id
                    )
                )
            )
            member_obj = member.scalar_one_or_none()
            if member_obj and member_obj.role in [ChatRole.OWNER, ChatRole.ADMIN]:
                can_delete = True
        
        if not can_delete:
            return False
        
        # Проверяем настройки чата
        settings = await self.session.execute(
            select(ChatSettings).where(ChatSettings.chat_id == message.chat_id)
        )
        chat_settings = settings.scalar_one_or_none()
        
        if chat_settings and not chat_settings.allow_message_deletion:
            return False
        
        # Удаляем сообщение (мягкое удаление)
        message.is_deleted = True
        message.status = MessageStatus.DELETED
        
        await self.session.commit()
        return True
    
    async def get_chat_members(
        self, 
        chat_id: int, 
        user_id: int
    ) -> List[ChatMember]:
        """Получение участников чата"""
        # Проверяем права доступа
        member = await self.session.execute(
            select(ChatMember).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
        )
        if not member.scalar_one_or_none():
            return []
        
        result = await self.session.execute(
            select(ChatMember)
            .where(ChatMember.chat_id == chat_id)
            .options(selectinload(ChatMember.user))
            .order_by(ChatMember.role, ChatMember.joined_at)
        )
        return result.scalars().all()
    
    async def update_chat_settings(
        self, 
        chat_id: int, 
        user_id: int, 
        settings: Dict[str, Any]
    ) -> bool:
        """Обновление настроек чата"""
        # Проверяем права на изменение настроек
        member = await self.session.execute(
            select(ChatMember).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
        )
        member_obj = member.scalar_one_or_none()
        
        if not member_obj or member_obj.role not in [ChatRole.OWNER, ChatRole.ADMIN]:
            return False
        
        # Получаем настройки чата
        result = await self.session.execute(
            select(ChatSettings).where(ChatSettings.chat_id == chat_id)
        )
        chat_settings = result.scalar_one_or_none()
        
        if not chat_settings:
            chat_settings = ChatSettings(chat_id=chat_id)
            self.session.add(chat_settings)
        
        # Обновляем настройки
        for field, value in settings.items():
            if hasattr(chat_settings, field):
                setattr(chat_settings, field, value)
        
        chat_settings.updated_at = datetime.utcnow()
        await self.session.commit()
        return True
    
    async def get_unread_count(self, user_id: int) -> Dict[int, int]:
        """Получение количества непрочитанных сообщений по чатам"""
        # Получаем все чаты пользователя
        chats = await self.session.execute(
            select(ChatMember.chat_id).where(ChatMember.user_id == user_id)
        )
        chat_ids = [row[0] for row in chats.fetchall()]
        
        unread_counts = {}
        
        for chat_id in chat_ids:
            # Получаем последнее прочитанное сообщение
            last_read = await self.session.execute(
                select(ChatMember.last_read_at).where(
                    and_(
                        ChatMember.chat_id == chat_id,
                        ChatMember.user_id == user_id
                    )
                )
            )
            last_read_at = last_read.scalar_one_or_none()
            
            # Подсчитываем непрочитанные сообщения
            query = select(func.count(ChatMessage.id)).where(
                and_(
                    ChatMessage.chat_id == chat_id,
                    ChatMessage.is_deleted == False
                )
            )
            
            if last_read_at:
                query = query.where(ChatMessage.sent_at > last_read_at)
            
            count = await self.session.scalar(query)
            if count > 0:
                unread_counts[chat_id] = count
        
        return unread_counts
    
    async def update_user_status(
        self, 
        chat_id: int, 
        user_id: int, 
        is_online: bool = True
    ) -> None:
        """Обновление статуса пользователя в чате"""
        member = await self.session.execute(
            select(ChatMember).where(
                and_(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user_id
                )
            )
        )
        member_obj = member.scalar_one_or_none()
        
        if member_obj:
            member_obj.last_seen_at = datetime.utcnow()
            await self.session.commit()


class ChatWebSocketManager:
    """Менеджер WebSocket соединений для чатов"""
    
    def __init__(self):
        self.active_connections: Dict[int, Dict[int, WebSocket]] = {}  # chat_id -> {user_id: websocket}
        self.user_connections: Dict[int, Set[int]] = {}  # user_id -> set of chat_ids
    
    async def connect(self, websocket: WebSocket, chat_id: int, user_id: int):
        """Подключение пользователя к чату через WebSocket"""
        await websocket.accept()
        
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = {}
        
        self.active_connections[chat_id][user_id] = websocket
        
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(chat_id)
        
        # Отправляем информацию о подключении
        await self.send_personal_message(
            {
                "type": "connection_established",
                "chat_id": chat_id,
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            },
            websocket
        )
    
    def disconnect(self, chat_id: int, user_id: int):
        """Отключение пользователя от чата"""
        if chat_id in self.active_connections:
            self.active_connections[chat_id].pop(user_id, None)
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]
        
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(chat_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Отправка личного сообщения пользователю"""
        try:
            await websocket.send_text(json.dumps(message))
        except WebSocketDisconnect:
            pass
    
    async def broadcast_to_chat(self, message: Dict[str, Any], chat_id: int, exclude_user: Optional[int] = None):
        """Отправка сообщения всем участникам чата"""
        if chat_id not in self.active_connections:
            return
        
        disconnected_users = []
        
        for user_id, websocket in self.active_connections[chat_id].items():
            if user_id != exclude_user:
                try:
                    await websocket.send_text(json.dumps(message))
                except WebSocketDisconnect:
                    disconnected_users.append(user_id)
        
        # Удаляем отключенных пользователей
        for user_id in disconnected_users:
            self.disconnect(chat_id, user_id)
    
    async def send_typing_indicator(self, chat_id: int, user_id: int, is_typing: bool):
        """Отправка индикатора печати"""
        message = {
            "type": "typing_indicator",
            "chat_id": chat_id,
            "user_id": user_id,
            "is_typing": is_typing,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_chat(message, chat_id, exclude_user=user_id)
    
    async def send_message_notification(self, message: ChatMessage):
        """Отправка уведомления о новом сообщении"""
        notification = {
            "type": "new_message",
            "chat_id": message.chat_id,
            "message": {
                "id": message.id,
                "message_uuid": message.message_uuid,
                "sender_id": message.sender_id,
                "content": message.content,
                "message_type": message.message_type,
                "sent_at": message.sent_at.isoformat(),
                "metadata": message.message_metadata
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_chat(notification, message.chat_id, exclude_user=message.sender_id)
    
    async def send_user_status_update(self, chat_id: int, user_id: int, is_online: bool):
        """Отправка обновления статуса пользователя"""
        message = {
            "type": "user_status_update",
            "chat_id": chat_id,
            "user_id": user_id,
            "is_online": is_online,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_chat(message, chat_id, exclude_user=user_id)


# Глобальный экземпляр менеджера WebSocket
websocket_manager = ChatWebSocketManager()
