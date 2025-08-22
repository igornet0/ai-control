"""
Функциональные тесты для системы коммуникаций (Phase 5)
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timedelta
from typing import Dict, Any

from core.database.models.email_model import (
    EmailStatus, EmailPriority, EmailCategory, EmailFilterType, EmailFilterAction
)
from core.database.models.chat_model import (
    ChatType, MessageType, MessageStatus, ChatRole
)
from core.database.models.video_call_model import (
    CallType, CallStatus, ParticipantStatus, RecordingStatus
)
from backend.api.services.email_service import EmailService
from backend.api.services.chat_service import ChatService, ChatWebSocketManager


class TestEmailEnums:
    """Тесты для email enum'ов"""
    
    def test_email_status_values(self):
        """Проверка значений EmailStatus"""
        assert EmailStatus.DRAFT == "draft"
        assert EmailStatus.SENT == "sent"
        assert EmailStatus.DELIVERED == "delivered"
        assert EmailStatus.READ == "read"
        assert EmailStatus.FAILED == "failed"
        assert EmailStatus.SPAM == "spam"
        assert EmailStatus.ARCHIVED == "archived"
        
        # Проверяем количество значений
        statuses = list(EmailStatus)
        assert len(statuses) == 7
    
    def test_email_priority_values(self):
        """Проверка значений EmailPriority"""
        assert EmailPriority.LOW == "low"
        assert EmailPriority.NORMAL == "normal"
        assert EmailPriority.HIGH == "high"
        assert EmailPriority.URGENT == "urgent"
        
        # Проверяем количество значений
        priorities = list(EmailPriority)
        assert len(priorities) == 4
    
    def test_email_category_values(self):
        """Проверка значений EmailCategory"""
        assert EmailCategory.GENERAL == "general"
        assert EmailCategory.IMPORTANT == "important"
        assert EmailCategory.NOTIFICATION == "notification"
        assert EmailCategory.REPORT == "report"
        assert EmailCategory.MEETING == "meeting"
        assert EmailCategory.TASK == "task"
        assert EmailCategory.SPAM == "spam"
        assert EmailCategory.PERSONAL == "personal"
        
        # Проверяем количество значений
        categories = list(EmailCategory)
        assert len(categories) == 8
    
    def test_email_filter_type_values(self):
        """Проверка значений EmailFilterType"""
        assert EmailFilterType.SENDER == "sender"
        assert EmailFilterType.RECIPIENT == "recipient"
        assert EmailFilterType.SUBJECT == "subject"
        assert EmailFilterType.CONTENT == "content"
        assert EmailFilterType.ATTACHMENT == "attachment"
        assert EmailFilterType.SIZE == "size"
        assert EmailFilterType.DATE == "date"
        assert EmailFilterType.CATEGORY == "category"
        
        # Проверяем количество значений
        filter_types = list(EmailFilterType)
        assert len(filter_types) == 8
    
    def test_email_filter_action_values(self):
        """Проверка значений EmailFilterAction"""
        assert EmailFilterAction.MOVE_TO_FOLDER == "move_to_folder"
        assert EmailFilterAction.MARK_AS_READ == "mark_as_read"
        assert EmailFilterAction.MARK_AS_IMPORTANT == "mark_as_important"
        assert EmailFilterAction.MARK_AS_SPAM == "mark_as_spam"
        assert EmailFilterAction.DELETE == "delete"
        assert EmailFilterAction.FORWARD == "forward"
        assert EmailFilterAction.AUTO_REPLY == "auto_reply"
        
        # Проверяем количество значений
        actions = list(EmailFilterAction)
        assert len(actions) == 7


class TestChatEnums:
    """Тесты для chat enum'ов"""
    
    def test_chat_type_values(self):
        """Проверка значений ChatType"""
        assert ChatType.PRIVATE == "private"
        assert ChatType.GROUP == "group"
        assert ChatType.CHANNEL == "channel"
        assert ChatType.BROADCAST == "broadcast"
        
        # Проверяем количество значений
        chat_types = list(ChatType)
        assert len(chat_types) == 4
    
    def test_message_type_values(self):
        """Проверка значений MessageType"""
        assert MessageType.TEXT == "text"
        assert MessageType.IMAGE == "image"
        assert MessageType.VIDEO == "video"
        assert MessageType.AUDIO == "audio"
        assert MessageType.FILE == "file"
        assert MessageType.LOCATION == "location"
        assert MessageType.CONTACT == "contact"
        assert MessageType.SYSTEM == "system"
        assert MessageType.REPLY == "reply"
        assert MessageType.FORWARD == "forward"
        
        # Проверяем количество значений
        message_types = list(MessageType)
        assert len(message_types) == 10
    
    def test_message_status_values(self):
        """Проверка значений MessageStatus"""
        assert MessageStatus.SENT == "sent"
        assert MessageStatus.DELIVERED == "delivered"
        assert MessageStatus.READ == "read"
        assert MessageStatus.FAILED == "failed"
        assert MessageStatus.EDITED == "edited"
        assert MessageStatus.DELETED == "deleted"
        
        # Проверяем количество значений
        statuses = list(MessageStatus)
        assert len(statuses) == 6
    
    def test_chat_role_values(self):
        """Проверка значений ChatRole"""
        assert ChatRole.OWNER == "owner"
        assert ChatRole.ADMIN == "admin"
        assert ChatRole.MODERATOR == "moderator"
        assert ChatRole.MEMBER == "member"
        assert ChatRole.GUEST == "guest"
        
        # Проверяем количество значений
        roles = list(ChatRole)
        assert len(roles) == 5


class TestVideoCallEnums:
    """Тесты для video call enum'ов"""
    
    def test_call_type_values(self):
        """Проверка значений CallType"""
        assert CallType.AUDIO == "audio"
        assert CallType.VIDEO == "video"
        assert CallType.SCREEN_SHARE == "screen_share"
        assert CallType.CONFERENCE == "conference"
        
        # Проверяем количество значений
        call_types = list(CallType)
        assert len(call_types) == 4
    
    def test_call_status_values(self):
        """Проверка значений CallStatus"""
        assert CallStatus.INITIATED == "initiated"
        assert CallStatus.RINGING == "ringing"
        assert CallStatus.CONNECTED == "connected"
        assert CallStatus.IN_PROGRESS == "in_progress"
        assert CallStatus.ENDED == "ended"
        assert CallStatus.MISSED == "missed"
        assert CallStatus.REJECTED == "rejected"
        assert CallStatus.BUSY == "busy"
        assert CallStatus.FAILED == "failed"
        
        # Проверяем количество значений
        statuses = list(CallStatus)
        assert len(statuses) == 9
    
    def test_participant_status_values(self):
        """Проверка значений ParticipantStatus"""
        assert ParticipantStatus.INVITED == "invited"
        assert ParticipantStatus.JOINED == "joined"
        assert ParticipantStatus.LEFT == "left"
        assert ParticipantStatus.REJECTED == "rejected"
        assert ParticipantStatus.BUSY == "busy"
        assert ParticipantStatus.NOT_AVAILABLE == "not_available"
        
        # Проверяем количество значений
        statuses = list(ParticipantStatus)
        assert len(statuses) == 6
    
    def test_recording_status_values(self):
        """Проверка значений RecordingStatus"""
        assert RecordingStatus.NOT_STARTED == "not_started"
        assert RecordingStatus.RECORDING == "recording"
        assert RecordingStatus.PAUSED == "paused"
        assert RecordingStatus.STOPPED == "stopped"
        assert RecordingStatus.PROCESSING == "processing"
        assert RecordingStatus.READY == "ready"
        assert RecordingStatus.FAILED == "failed"
        
        # Проверяем количество значений
        statuses = list(RecordingStatus)
        assert len(statuses) == 7


class TestEmailService:
    """Тесты для EmailService"""
    
    @pytest.fixture
    def mock_session(self):
        """Фикстура для мок сессии"""
        session = MagicMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.add = MagicMock()
        session.get = MagicMock()
        session.scalar = AsyncMock()
        return session
    
    @pytest.fixture
    def email_service(self, mock_session):
        """Фикстура для EmailService"""
        return EmailService(mock_session)
    
    def test_email_service_initialization(self, mock_session):
        """Тест инициализации EmailService"""
        service = EmailService(mock_session)
        assert service.session == mock_session
        assert hasattr(service, 'attachments_dir')
    
    @pytest.mark.asyncio
    async def test_create_email_account_success(self, email_service, mock_session):
        """Тест успешного создания email аккаунта"""
        # Настройка моков
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        mock_session.flush = AsyncMock()
        mock_session.commit = AsyncMock()
        
        # Выполнение теста
        result = await email_service.create_email_account(
            user_id=1,
            email="test@example.com",
            display_name="Test User"
        )
        
        # Проверки
        assert result is not None
        assert result.user_id == 1
        assert result.email == "test@example.com"
        assert result.display_name == "Test User"
        assert result.is_primary is True
        mock_session.add.assert_called()
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_email_account_duplicate(self, email_service, mock_session):
        """Тест создания email аккаунта с дублирующимся email"""
        # Настройка моков - возвращаем существующий аккаунт
        mock_session.execute.return_value.scalar_one_or_none.return_value = MagicMock()
        
        # Выполнение теста и проверка исключения
        with pytest.raises(ValueError, match="Email account with address test@example.com already exists"):
            await email_service.create_email_account(
                user_id=1,
                email="test@example.com"
            )
    
    @pytest.mark.asyncio
    async def test_get_user_email_accounts(self, email_service, mock_session):
        """Тест получения email аккаунтов пользователя"""
        # Настройка моков
        mock_accounts = [MagicMock(), MagicMock()]
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_accounts
        
        # Выполнение теста
        result = await email_service.get_user_email_accounts(user_id=1)
        
        # Проверки
        assert result == mock_accounts
        mock_session.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_email_success(self, email_service, mock_session):
        """Тест успешного создания email"""
        # Настройка моков
        mock_session.flush = AsyncMock()
        mock_session.commit = AsyncMock()
        
        # Выполнение теста
        result = await email_service.create_email(
            sender_id=1,
            subject="Test Subject",
            body_text="Test body",
            recipients=[{"email": "recipient@example.com", "type": "to"}],
            priority=EmailPriority.NORMAL,
            category=EmailCategory.GENERAL
        )
        
        # Проверки
        assert result is not None
        assert result.subject == "Test Subject"
        assert result.body_text == "Test body"
        assert result.priority == EmailPriority.NORMAL
        assert result.category == EmailCategory.GENERAL
        assert result.status == EmailStatus.DRAFT
        mock_session.add.assert_called()
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_send_email_success(self, email_service, mock_session):
        """Тест успешной отправки email"""
        # Настройка моков
        mock_email = MagicMock()
        mock_email.status = EmailStatus.DRAFT
        mock_email.sender = MagicMock()
        mock_email.sender.smtp_host = "smtp.example.com"
        mock_email.recipients = [MagicMock()]
        mock_email.attachments = []
        
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_email
        mock_session.commit = AsyncMock()
        
        # Мокаем SMTP отправку
        with patch.object(email_service, '_send_via_smtp', new_callable=AsyncMock):
            result = await email_service.send_email(email_id=1)
        
        # Проверки
        assert result is True
        assert mock_email.status == EmailStatus.SENT
        assert mock_email.sent_at is not None
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_emails_with_filters(self, email_service, mock_session):
        """Тест получения email с фильтрами"""
        # Настройка моков
        mock_folder = MagicMock()
        mock_folder.id = 1
        
        mock_emails = [MagicMock(), MagicMock()]
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_folder
        mock_session.scalar.return_value = 2
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_emails
        
        # Выполнение теста
        emails, total_count = await email_service.get_emails(
            account_id=1,
            folder_name="INBOX",
            page=1,
            per_page=20,
            filters={"status": EmailStatus.READ, "is_important": True}
        )
        
        # Проверки
        assert emails == mock_emails
        assert total_count == 2
        mock_session.execute.assert_called()


class TestChatService:
    """Тесты для ChatService"""
    
    @pytest.fixture
    def mock_session(self):
        """Фикстура для мок сессии"""
        session = MagicMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.add = MagicMock()
        session.get = MagicMock()
        session.scalar = AsyncMock()
        return session
    
    @pytest.fixture
    def chat_service(self, mock_session):
        """Фикстура для ChatService"""
        return ChatService(mock_session)
    
    def test_chat_service_initialization(self, mock_session):
        """Тест инициализации ChatService"""
        service = ChatService(mock_session)
        assert service.session == mock_session
        assert hasattr(service, 'attachments_dir')
    
    @pytest.mark.asyncio
    async def test_create_chat_success(self, chat_service, mock_session):
        """Тест успешного создания чата"""
        # Настройка моков
        mock_session.flush = AsyncMock()
        mock_session.commit = AsyncMock()
        
        # Выполнение теста
        result = await chat_service.create_chat(
            creator_id=1,
            chat_type=ChatType.GROUP,
            name="Test Group",
            description="Test description",
            member_ids=[2, 3],
            is_private=False
        )
        
        # Проверки
        assert result is not None
        assert result.chat_type == ChatType.GROUP
        assert result.name == "Test Group"
        assert result.description == "Test description"
        assert result.is_private is False
        assert result.member_count == 3  # creator + 2 members
        mock_session.add.assert_called()
        mock_session.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_get_user_chats(self, chat_service, mock_session):
        """Тест получения чатов пользователя"""
        # Настройка моков
        mock_chats = [MagicMock(), MagicMock()]
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_chats
        
        # Выполнение теста
        result = await chat_service.get_user_chats(user_id=1)
        
        # Проверки
        assert result == mock_chats
        mock_session.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_send_message_success(self, chat_service, mock_session):
        """Тест успешной отправки сообщения"""
        # Настройка моков
        mock_session.flush = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.get.return_value = MagicMock()
        
        # Мокаем проверку участника
        mock_session.execute.return_value.scalar_one_or_none.return_value = MagicMock()
        
        # Выполнение теста
        result = await chat_service.send_message(
            chat_id=1,
            sender_id=1,
            message_type=MessageType.TEXT,
            content="Test message"
        )
        
        # Проверки
        assert result is not None
        assert result.content == "Test message"
        assert result.message_type == MessageType.TEXT
        assert result.status == MessageStatus.SENT
        mock_session.add.assert_called()
        mock_session.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_send_message_not_member(self, chat_service, mock_session):
        """Тест отправки сообщения не участником чата"""
        # Настройка моков - пользователь не является участником
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        
        # Выполнение теста и проверка исключения
        with pytest.raises(ValueError, match="User is not a member of this chat"):
            await chat_service.send_message(
                chat_id=1,
                sender_id=1,
                message_type=MessageType.TEXT,
                content="Test message"
            )
    
    @pytest.mark.asyncio
    async def test_get_messages_with_pagination(self, chat_service, mock_session):
        """Тест получения сообщений с пагинацией"""
        # Настройка моков
        mock_member = MagicMock()
        mock_messages = [MagicMock(), MagicMock()]
        
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_member
        mock_session.scalar.return_value = 2
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_messages
        
        # Выполнение теста
        messages, total_count = await chat_service.get_messages(
            chat_id=1,
            user_id=1,
            page=1,
            per_page=50
        )
        
        # Проверки
        assert messages == mock_messages
        assert total_count == 2
        mock_session.execute.assert_called()
    
    @pytest.mark.asyncio
    async def test_add_chat_member_success(self, chat_service, mock_session):
        """Тест успешного добавления участника в чат"""
        # Настройка моков
        mock_session.execute.return_value.scalar_one_or_none.return_value = ChatRole.ADMIN
        mock_session.execute.return_value.scalar_one_or_none.return_value = None  # пользователь еще не в чате
        mock_session.get.return_value = MagicMock()
        mock_session.commit = AsyncMock()
        
        # Выполнение теста
        result = await chat_service.add_chat_member(
            chat_id=1,
            user_id=2,
            added_by_id=1,
            role=ChatRole.MEMBER
        )
        
        # Проверки
        assert result is True
        mock_session.add.assert_called()
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_add_chat_member_no_permission(self, chat_service, mock_session):
        """Тест добавления участника без прав"""
        # Настройка моков - нет прав на добавление
        mock_session.execute.return_value.scalar_one_or_none.return_value = ChatRole.MEMBER
        
        # Выполнение теста
        result = await chat_service.add_chat_member(
            chat_id=1,
            user_id=2,
            added_by_id=1
        )
        
        # Проверки
        assert result is False
    
    @pytest.mark.asyncio
    async def test_mark_message_as_read_success(self, chat_service, mock_session):
        """Тест успешного отметки сообщения как прочитанного"""
        # Настройка моков
        mock_message = MagicMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_message
        mock_session.execute.return_value.scalar_one_or_none.return_value = None  # еще не прочитано
        mock_session.commit = AsyncMock()
        
        # Выполнение теста
        result = await chat_service.mark_message_as_read(message_id=1, user_id=1)
        
        # Проверки
        assert result is True
        assert mock_message.status == MessageStatus.READ
        assert mock_message.read_at is not None
        mock_session.add.assert_called()
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_add_message_reaction_success(self, chat_service, mock_session):
        """Тест успешного добавления реакции на сообщение"""
        # Настройка моков
        mock_session.execute.return_value.scalar_one_or_none.return_value = MagicMock()  # пользователь в чате
        mock_session.execute.return_value.scalar_one_or_none.return_value = None  # реакция еще не добавлена
        mock_session.commit = AsyncMock()
        
        # Выполнение теста
        result = await chat_service.add_message_reaction(
            message_id=1,
            user_id=1,
            emoji="👍"
        )
        
        # Проверки
        assert result is True
        mock_session.add.assert_called()
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_unread_count(self, chat_service, mock_session):
        """Тест получения количества непрочитанных сообщений"""
        # Настройка моков
        mock_session.execute.return_value.fetchall.return_value = [(1,), (2,)]
        mock_session.execute.return_value.scalar_one_or_none.return_value = datetime.utcnow() - timedelta(hours=1)
        mock_session.scalar.return_value = 5
        
        # Выполнение теста
        result = await chat_service.get_unread_count(user_id=1)
        
        # Проверки
        assert isinstance(result, dict)
        assert 1 in result
        assert 2 in result
        assert result[1] == 5
        assert result[2] == 5


class TestChatWebSocketManager:
    """Тесты для ChatWebSocketManager"""
    
    @pytest.fixture
    def websocket_manager(self):
        """Фикстура для ChatWebSocketManager"""
        return ChatWebSocketManager()
    
    @pytest.fixture
    def mock_websocket(self):
        """Фикстура для мок WebSocket"""
        websocket = MagicMock()
        websocket.accept = AsyncMock()
        websocket.send_text = AsyncMock()
        return websocket
    
    def test_websocket_manager_initialization(self):
        """Тест инициализации ChatWebSocketManager"""
        manager = ChatWebSocketManager()
        assert hasattr(manager, 'active_connections')
        assert hasattr(manager, 'user_connections')
        assert isinstance(manager.active_connections, dict)
        assert isinstance(manager.user_connections, dict)
    
    @pytest.mark.asyncio
    async def test_connect_user(self, websocket_manager, mock_websocket):
        """Тест подключения пользователя"""
        # Выполнение теста
        await websocket_manager.connect(mock_websocket, chat_id=1, user_id=1)
        
        # Проверки
        assert 1 in websocket_manager.active_connections
        assert 1 in websocket_manager.active_connections[1]
        assert websocket_manager.active_connections[1][1] == mock_websocket
        assert 1 in websocket_manager.user_connections
        assert 1 in websocket_manager.user_connections[1]
        mock_websocket.accept.assert_called_once()
    
    def test_disconnect_user(self, websocket_manager, mock_websocket):
        """Тест отключения пользователя"""
        # Подключаем пользователя
        websocket_manager.active_connections[1] = {1: mock_websocket}
        websocket_manager.user_connections[1] = {1}
        
        # Выполнение теста
        websocket_manager.disconnect(chat_id=1, user_id=1)
        
        # Проверки
        assert 1 not in websocket_manager.active_connections
        assert 1 not in websocket_manager.user_connections
    
    @pytest.mark.asyncio
    async def test_send_personal_message(self, websocket_manager, mock_websocket):
        """Тест отправки личного сообщения"""
        # Выполнение теста
        await websocket_manager.send_personal_message(
            {"type": "test", "data": "test"}, 
            mock_websocket
        )
        
        # Проверки
        mock_websocket.send_text.assert_called_once()
        sent_data = mock_websocket.send_text.call_args[0][0]
        assert "test" in sent_data
        assert "data" in sent_data
    
    @pytest.mark.asyncio
    async def test_broadcast_to_chat(self, websocket_manager, mock_websocket):
        """Тест широковещательной отправки в чат"""
        # Подключаем пользователей
        websocket_manager.active_connections[1] = {
            1: mock_websocket,
            2: MagicMock()
        }
        
        # Выполнение теста
        await websocket_manager.broadcast_to_chat(
            {"type": "broadcast", "data": "test"}, 
            chat_id=1
        )
        
        # Проверки
        mock_websocket.send_text.assert_called_once()
        sent_data = mock_websocket.send_text.call_args[0][0]
        assert "broadcast" in sent_data
        assert "data" in sent_data
    
    @pytest.mark.asyncio
    async def test_send_typing_indicator(self, websocket_manager, mock_websocket):
        """Тест отправки индикатора печати"""
        # Подключаем пользователей
        websocket_manager.active_connections[1] = {
            1: mock_websocket,
            2: MagicMock()
        }
        
        # Выполнение теста
        await websocket_manager.send_typing_indicator(
            chat_id=1, 
            user_id=1, 
            is_typing=True
        )
        
        # Проверки
        mock_websocket.send_text.assert_called_once()
        sent_data = mock_websocket.send_text.call_args[0][0]
        assert "typing_indicator" in sent_data
        assert "is_typing" in sent_data
    
    @pytest.mark.asyncio
    async def test_send_message_notification(self, websocket_manager, mock_websocket):
        """Тест отправки уведомления о новом сообщении"""
        # Подключаем пользователей
        websocket_manager.active_connections[1] = {
            1: mock_websocket,
            2: MagicMock()
        }
        
        # Создаем мок сообщение
        mock_message = MagicMock()
        mock_message.chat_id = 1
        mock_message.id = 1
        mock_message.message_uuid = "test-uuid"
        mock_message.sender_id = 2
        mock_message.content = "Test message"
        mock_message.message_type = MessageType.TEXT
        mock_message.sent_at = datetime.utcnow()
        mock_message.message_metadata = {}
        
        # Выполнение теста
        await websocket_manager.send_message_notification(mock_message)
        
        # Проверки
        mock_websocket.send_text.assert_called_once()
        sent_data = mock_websocket.send_text.call_args[0][0]
        assert "new_message" in sent_data
        assert "message" in sent_data


class TestCommunicationSystemIntegration:
    """Интеграционные тесты системы коммуникаций"""
    
    @pytest.fixture
    def mock_session(self):
        """Фикстура для мок сессии"""
        session = MagicMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.add = MagicMock()
        session.get = MagicMock()
        session.scalar = AsyncMock()
        return session
    
    @pytest.fixture
    def email_service(self, mock_session):
        """Фикстура для EmailService"""
        return EmailService(mock_session)
    
    @pytest.fixture
    def chat_service(self, mock_session):
        """Фикстура для ChatService"""
        return ChatService(mock_session)
    
    @pytest.fixture
    def websocket_manager(self):
        """Фикстура для ChatWebSocketManager"""
        return ChatWebSocketManager()
    
    def test_communication_system_components_exist(self, email_service, chat_service, websocket_manager):
        """Тест существования всех компонентов системы коммуникаций"""
        assert email_service is not None
        assert chat_service is not None
        assert websocket_manager is not None
        
        # Проверяем основные методы
        assert hasattr(email_service, 'create_email_account')
        assert hasattr(email_service, 'send_email')
        assert hasattr(email_service, 'get_emails')
        
        assert hasattr(chat_service, 'create_chat')
        assert hasattr(chat_service, 'send_message')
        assert hasattr(chat_service, 'get_messages')
        
        assert hasattr(websocket_manager, 'connect')
        assert hasattr(websocket_manager, 'broadcast_to_chat')
        assert hasattr(websocket_manager, 'send_message_notification')
    
    def test_enum_consistency(self):
        """Тест согласованности enum'ов"""
        # Проверяем, что все enum'ы имеют уникальные значения
        email_statuses = set(EmailStatus)
        email_priorities = set(EmailPriority)
        email_categories = set(EmailCategory)
        
        chat_types = set(ChatType)
        message_types = set(MessageType)
        message_statuses = set(MessageStatus)
        chat_roles = set(ChatRole)
        
        call_types = set(CallType)
        call_statuses = set(CallStatus)
        participant_statuses = set(ParticipantStatus)
        recording_statuses = set(RecordingStatus)
        
        # Проверяем, что нет пересечений между разными enum'ами
        assert len(email_statuses.intersection(email_priorities)) == 0
        assert len(email_statuses.intersection(email_categories)) == 0
        assert len(chat_types.intersection(message_types)) == 0
        assert len(call_types.intersection(call_statuses)) == 0
    
    def test_service_method_signatures(self, email_service, chat_service):
        """Тест сигнатур методов сервисов"""
        # Проверяем, что методы являются корутинами
        import asyncio
        
        assert asyncio.iscoroutinefunction(email_service.create_email_account)
        assert asyncio.iscoroutinefunction(email_service.send_email)
        assert asyncio.iscoroutinefunction(email_service.get_emails)
        
        assert asyncio.iscoroutinefunction(chat_service.create_chat)
        assert asyncio.iscoroutinefunction(chat_service.send_message)
        assert asyncio.iscoroutinefunction(chat_service.get_messages)
    
    def test_websocket_manager_methods_async(self, websocket_manager):
        """Тест асинхронности методов WebSocket менеджера"""
        import asyncio
        
        assert asyncio.iscoroutinefunction(websocket_manager.connect)
        assert asyncio.iscoroutinefunction(websocket_manager.send_personal_message)
        assert asyncio.iscoroutinefunction(websocket_manager.broadcast_to_chat)
        assert asyncio.iscoroutinefunction(websocket_manager.send_typing_indicator)
        assert asyncio.iscoroutinefunction(websocket_manager.send_message_notification)
    
    def test_communication_system_completeness(self):
        """Тест полноты системы коммуникаций"""
        # Проверяем наличие всех необходимых компонентов
        required_components = [
            'EmailService',
            'ChatService', 
            'ChatWebSocketManager',
            'EmailStatus',
            'EmailPriority',
            'EmailCategory',
            'ChatType',
            'MessageType',
            'MessageStatus',
            'CallType',
            'CallStatus',
            'ParticipantStatus'
        ]
        
        for component in required_components:
            assert component in globals(), f"Component {component} not found"
        
        # Проверяем, что все enum'ы имеют значения
        assert len(EmailStatus) > 0
        assert len(EmailPriority) > 0
        assert len(EmailCategory) > 0
        assert len(ChatType) > 0
        assert len(MessageType) > 0
        assert len(MessageStatus) > 0
        assert len(CallType) > 0
        assert len(CallStatus) > 0
        assert len(ParticipantStatus) > 0
