"""
Сервис для работы с корпоративной почтой
"""
import asyncio
import smtplib
import imaplib
import email
import uuid
import hashlib
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.header import decode_header
import aiofiles
from sqlalchemy import select, and_, or_, desc, asc, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database.models.email_model import (
    EmailAccount, Email, EmailRecipient, EmailAttachment, 
    EmailFolder, EmailFolderMapping, EmailLabel, EmailFilter,
    EmailAutoReply, EmailTemplate, EmailStatus, EmailPriority,
    EmailCategory, EmailFilterType, EmailFilterAction
)
from core.database.models.main_models import User


class EmailService:
    """Сервис для работы с корпоративной почтой"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.attachments_dir = Path("uploads/email_attachments")
        self.attachments_dir.mkdir(parents=True, exist_ok=True)
    
    async def create_email_account(
        self, 
        user_id: int, 
        email: str, 
        display_name: Optional[str] = None,
        smtp_config: Optional[Dict[str, Any]] = None,
        imap_config: Optional[Dict[str, Any]] = None
    ) -> EmailAccount:
        """Создание email аккаунта"""
        # Проверяем, что email уникален
        existing_account = await self.session.execute(
            select(EmailAccount).where(EmailAccount.email == email)
        )
        if existing_account.scalar_one_or_none():
            raise ValueError(f"Email account with address {email} already exists")
        
        # Создаем аккаунт
        account = EmailAccount(
            user_id=user_id,
            email=email,
            display_name=display_name or email.split('@')[0],
            is_primary=True  # Первый аккаунт становится основным
        )
        
        # Настраиваем SMTP если предоставлен
        if smtp_config:
            account.smtp_host = smtp_config.get('host')
            account.smtp_port = smtp_config.get('port', 587)
            account.smtp_username = smtp_config.get('username')
            account.smtp_password = smtp_config.get('password')
            account.smtp_use_tls = smtp_config.get('use_tls', True)
        
        # Настраиваем IMAP если предоставлен
        if imap_config:
            account.imap_host = imap_config.get('host')
            account.imap_port = imap_config.get('port', 993)
            account.imap_username = imap_config.get('username')
            account.imap_password = imap_config.get('password')
            account.imap_use_ssl = imap_config.get('use_ssl', True)
        
        self.session.add(account)
        await self.session.flush()
        
        # Создаем системные папки
        await self._create_system_folders(account.id)
        
        await self.session.commit()
        return account
    
    async def _create_system_folders(self, account_id: int):
        """Создание системных папок для email аккаунта"""
        system_folders = [
            {"name": "INBOX", "display_name": "Входящие", "is_default": True},
            {"name": "SENT", "display_name": "Отправленные"},
            {"name": "DRAFTS", "display_name": "Черновики"},
            {"name": "SPAM", "display_name": "Спам"},
            {"name": "TRASH", "display_name": "Корзина"},
            {"name": "ARCHIVE", "display_name": "Архив"},
        ]
        
        for i, folder_data in enumerate(system_folders):
            folder = EmailFolder(
                email_account_id=account_id,
                name=folder_data["name"],
                display_name=folder_data["display_name"],
                is_system=True,
                is_default=folder_data.get("is_default", False),
                position=i
            )
            self.session.add(folder)
    
    async def get_user_email_accounts(self, user_id: int) -> List[EmailAccount]:
        """Получение email аккаунтов пользователя"""
        result = await self.session.execute(
            select(EmailAccount)
            .where(EmailAccount.user_id == user_id)
            .order_by(desc(EmailAccount.is_primary), asc(EmailAccount.created_at))
        )
        return result.scalars().all()
    
    async def get_email_account(self, account_id: int) -> Optional[EmailAccount]:
        """Получение email аккаунта по ID"""
        result = await self.session.execute(
            select(EmailAccount).where(EmailAccount.id == account_id)
        )
        return result.scalar_one_or_none()
    
    async def update_email_account(
        self, 
        account_id: int, 
        updates: Dict[str, Any]
    ) -> Optional[EmailAccount]:
        """Обновление email аккаунта"""
        account = await self.get_email_account(account_id)
        if not account:
            return None
        
        # Обновляем поля
        for field, value in updates.items():
            if hasattr(account, field):
                setattr(account, field, value)
        
        account.updated_at = datetime.utcnow()
        await self.session.commit()
        return account
    
    async def create_email(
        self,
        sender_id: int,
        subject: str,
        body_text: Optional[str] = None,
        body_html: Optional[str] = None,
        recipients: List[Dict[str, str]] = None,
        priority: EmailPriority = EmailPriority.NORMAL,
        category: EmailCategory = EmailCategory.GENERAL,
        attachments: List[Dict[str, Any]] = None
    ) -> Email:
        """Создание нового email сообщения"""
        # Генерируем уникальный message_id
        message_id = f"<{uuid.uuid4()}@ai-control.local>"
        
        # Создаем email
        email_obj = Email(
            message_id=message_id,
            sender_id=sender_id,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            priority=priority,
            category=category,
            status=EmailStatus.DRAFT
        )
        
        self.session.add(email_obj)
        await self.session.flush()
        
        # Добавляем получателей
        if recipients:
            for recipient_data in recipients:
                recipient = EmailRecipient(
                    email_id=email_obj.id,
                    email_address=recipient_data['email'],
                    display_name=recipient_data.get('display_name'),
                    recipient_type=recipient_data.get('type', 'to')
                )
                self.session.add(recipient)
        
        # Добавляем вложения
        if attachments:
            for attachment_data in attachments:
                attachment = await self._create_attachment(
                    email_obj.id, 
                    attachment_data
                )
                self.session.add(attachment)
        
        await self.session.commit()
        return email_obj
    
    async def _create_attachment(
        self, 
        email_id: int, 
        attachment_data: Dict[str, Any]
    ) -> EmailAttachment:
        """Создание вложения для email"""
        file_path = attachment_data['file_path']
        filename = attachment_data.get('filename', os.path.basename(file_path))
        content_type = attachment_data.get('content_type', 'application/octet-stream')
        
        # Копируем файл в папку вложений
        file_hash = await self._calculate_file_hash(file_path)
        new_file_path = self.attachments_dir / f"{file_hash}_{filename}"
        
        async with aiofiles.open(file_path, 'rb') as src, \
                   aiofiles.open(new_file_path, 'wb') as dst:
            content = await src.read()
            await dst.write(content)
        
        # Получаем размер файла
        size_bytes = len(content)
        
        attachment = EmailAttachment(
            email_id=email_id,
            filename=filename,
            original_filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            file_path=str(new_file_path),
            file_hash=file_hash,
            is_inline=attachment_data.get('is_inline', False),
            content_id=attachment_data.get('content_id')
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
    
    async def send_email(self, email_id: int) -> bool:
        """Отправка email сообщения"""
        # Получаем email с получателями и отправителем
        result = await self.session.execute(
            select(Email)
            .options(
                selectinload(Email.recipients),
                selectinload(Email.sender),
                selectinload(Email.attachments)
            )
            .where(Email.id == email_id)
        )
        email_obj = result.scalar_one_or_none()
        
        if not email_obj or email_obj.status != EmailStatus.DRAFT:
            return False
        
        try:
            # Создаем MIME сообщение
            msg = MIMEMultipart()
            msg['From'] = email_obj.sender.email
            msg['Subject'] = email_obj.subject
            
            # Добавляем получателей
            to_emails = []
            cc_emails = []
            bcc_emails = []
            
            for recipient in email_obj.recipients:
                email_addr = recipient.email_address
                if recipient.display_name:
                    email_addr = f"{recipient.display_name} <{email_addr}>"
                
                if recipient.recipient_type == 'to':
                    to_emails.append(email_addr)
                elif recipient.recipient_type == 'cc':
                    cc_emails.append(email_addr)
                elif recipient.recipient_type == 'bcc':
                    bcc_emails.append(email_addr)
            
            if to_emails:
                msg['To'] = ', '.join(to_emails)
            if cc_emails:
                msg['Cc'] = ', '.join(cc_emails)
            
            # Добавляем тело сообщения
            if email_obj.body_html:
                msg.attach(MIMEText(email_obj.body_html, 'html'))
            elif email_obj.body_text:
                msg.attach(MIMEText(email_obj.body_text, 'plain'))
            
            # Добавляем вложения
            for attachment in email_obj.attachments:
                with open(attachment.file_path, 'rb') as f:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename= {attachment.filename}'
                    )
                    msg.attach(part)
            
            # Отправляем через SMTP
            if email_obj.sender.smtp_host:
                await self._send_via_smtp(email_obj.sender, msg, to_emails + cc_emails + bcc_emails)
            
            # Обновляем статус
            email_obj.status = EmailStatus.SENT
            email_obj.sent_at = datetime.utcnow()
            
            # Обновляем статус получателей
            for recipient in email_obj.recipients:
                recipient.is_delivered = True
                recipient.delivered_at = datetime.utcnow()
            
            await self.session.commit()
            return True
            
        except Exception as e:
            # В случае ошибки обновляем статус
            email_obj.status = EmailStatus.FAILED
            await self.session.commit()
            raise e
    
    async def _send_via_smtp(
        self, 
        account: EmailAccount, 
        msg: MIMEMultipart, 
        recipients: List[str]
    ):
        """Отправка через SMTP"""
        # Используем asyncio для неблокирующей отправки
        loop = asyncio.get_event_loop()
        
        def send_smtp():
            server = smtplib.SMTP(account.smtp_host, account.smtp_port)
            if account.smtp_use_tls:
                server.starttls()
            
            if account.smtp_username and account.smtp_password:
                server.login(account.smtp_username, account.smtp_password)
            
            server.send_message(msg, from_addr=account.email, to_addrs=recipients)
            server.quit()
        
        await loop.run_in_executor(None, send_smtp)
    
    async def get_emails(
        self,
        account_id: int,
        folder_name: str = "INBOX",
        page: int = 1,
        per_page: int = 20,
        filters: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[Email], int]:
        """Получение email сообщений с пагинацией и фильтрацией"""
        # Получаем папку
        folder_result = await self.session.execute(
            select(EmailFolder).where(
                and_(
                    EmailFolder.email_account_id == account_id,
                    EmailFolder.name == folder_name
                )
            )
        )
        folder = folder_result.scalar_one_or_none()
        
        if not folder:
            return [], 0
        
        # Базовый запрос
        query = select(Email).join(EmailFolderMapping).where(
            EmailFolderMapping.folder_id == folder.id
        )
        
        # Применяем фильтры
        if filters:
            query = self._apply_email_filters(query, filters)
        
        # Подсчитываем общее количество
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await self.session.scalar(count_query)
        
        # Добавляем пагинацию и сортировку
        query = query.order_by(desc(Email.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page)
        
        # Выполняем запрос с загрузкой связанных данных
        result = await self.session.execute(
            query.options(
                selectinload(Email.sender),
                selectinload(Email.recipients),
                selectinload(Email.attachments),
                selectinload(Email.labels)
            )
        )
        
        emails = result.scalars().all()
        return emails, total_count
    
    def _apply_email_filters(self, query, filters: Dict[str, Any]):
        """Применение фильтров к запросу email"""
        if filters.get('status'):
            query = query.where(Email.status == filters['status'])
        
        if filters.get('priority'):
            query = query.where(Email.priority == filters['priority'])
        
        if filters.get('category'):
            query = query.where(Email.category == filters['category'])
        
        if filters.get('is_important') is not None:
            query = query.where(Email.is_important == filters['is_important'])
        
        if filters.get('is_flagged') is not None:
            query = query.where(Email.is_flagged == filters['is_flagged'])
        
        if filters.get('search'):
            search_term = f"%{filters['search']}%"
            query = query.where(
                or_(
                    Email.subject.ilike(search_term),
                    Email.body_text.ilike(search_term),
                    Email.body_html.ilike(search_term)
                )
            )
        
        if filters.get('date_from'):
            query = query.where(Email.created_at >= filters['date_from'])
        
        if filters.get('date_to'):
            query = query.where(Email.created_at <= filters['date_to'])
        
        return query
    
    async def get_email(self, email_id: int) -> Optional[Email]:
        """Получение email по ID"""
        result = await self.session.execute(
            select(Email)
            .options(
                selectinload(Email.sender),
                selectinload(Email.recipients),
                selectinload(Email.attachments),
                selectinload(Email.labels),
                selectinload(Email.folder_mappings).selectinload(EmailFolderMapping.folder)
            )
            .where(Email.id == email_id)
        )
        return result.scalar_one_or_none()
    
    async def mark_email_as_read(self, email_id: int) -> bool:
        """Отметить email как прочитанный"""
        email_obj = await self.get_email(email_id)
        if not email_obj:
            return False
        
        email_obj.status = EmailStatus.READ
        email_obj.read_at = datetime.utcnow()
        await self.session.commit()
        return True
    
    async def mark_email_as_important(self, email_id: int, is_important: bool = True) -> bool:
        """Отметить email как важный"""
        email_obj = await self.get_email(email_id)
        if not email_obj:
            return False
        
        email_obj.is_important = is_important
        await self.session.commit()
        return True
    
    async def move_email_to_folder(self, email_id: int, folder_id: int) -> bool:
        """Перемещение email в папку"""
        # Удаляем существующие связи с папками
        await self.session.execute(
            delete(EmailFolderMapping).where(EmailFolderMapping.email_id == email_id)
        )
        
        # Создаем новую связь
        mapping = EmailFolderMapping(
            email_id=email_id,
            folder_id=folder_id
        )
        self.session.add(mapping)
        await self.session.commit()
        return True
    
    async def create_email_folder(
        self,
        account_id: int,
        name: str,
        display_name: Optional[str] = None,
        parent_folder_id: Optional[int] = None,
        color: Optional[str] = None
    ) -> EmailFolder:
        """Создание новой папки для email"""
        folder = EmailFolder(
            email_account_id=account_id,
            name=name,
            display_name=display_name or name,
            parent_folder_id=parent_folder_id,
            color=color
        )
        
        self.session.add(folder)
        await self.session.commit()
        return folder
    
    async def get_email_folders(self, account_id: int) -> List[EmailFolder]:
        """Получение папок email аккаунта"""
        result = await self.session.execute(
            select(EmailFolder)
            .where(EmailFolder.email_account_id == account_id)
            .order_by(EmailFolder.position, EmailFolder.name)
        )
        return result.scalars().all()
    
    async def create_email_filter(
        self,
        account_id: int,
        name: str,
        filter_type: EmailFilterType,
        filter_value: str,
        action: EmailFilterAction,
        action_value: Optional[str] = None,
        filter_condition: str = "contains",
        priority: int = 0
    ) -> EmailFilter:
        """Создание фильтра для email"""
        filter_obj = EmailFilter(
            email_account_id=account_id,
            name=name,
            filter_type=filter_type,
            filter_value=filter_value,
            filter_condition=filter_condition,
            action=action,
            action_value=action_value,
            priority=priority
        )
        
        self.session.add(filter_obj)
        await self.session.commit()
        return filter_obj
    
    async def apply_email_filters(self, email: Email) -> List[EmailFilterAction]:
        """Применение фильтров к email сообщению"""
        # Получаем активные фильтры для аккаунта отправителя
        result = await self.session.execute(
            select(EmailFilter)
            .where(
                and_(
                    EmailFilter.email_account_id == email.sender_id,
                    EmailFilter.is_active == True
                )
            )
            .order_by(EmailFilter.priority)
        )
        filters = result.scalars().all()
        
        applied_actions = []
        
        for filter_obj in filters:
            if await self._filter_matches(email, filter_obj):
                applied_actions.append(filter_obj.action)
                await self._apply_filter_action(email, filter_obj)
        
        return applied_actions
    
    async def _filter_matches(self, email: Email, filter_obj: EmailFilter) -> bool:
        """Проверка соответствия email фильтру"""
        if filter_obj.filter_type == EmailFilterType.SENDER:
            return self._check_condition(
                email.sender.email, 
                filter_obj.filter_value, 
                filter_obj.filter_condition
            )
        
        elif filter_obj.filter_type == EmailFilterType.SUBJECT:
            return self._check_condition(
                email.subject, 
                filter_obj.filter_value, 
                filter_obj.filter_condition
            )
        
        elif filter_obj.filter_type == EmailFilterType.CONTENT:
            content = email.body_text or email.body_html or ""
            return self._check_condition(
                content, 
                filter_obj.filter_value, 
                filter_obj.filter_condition
            )
        
        elif filter_obj.filter_type == EmailFilterType.CATEGORY:
            return email.category == filter_obj.filter_value
        
        return False
    
    def _check_condition(self, value: str, filter_value: str, condition: str) -> bool:
        """Проверка условия фильтра"""
        value = value.lower()
        filter_value = filter_value.lower()
        
        if condition == "contains":
            return filter_value in value
        elif condition == "equals":
            return value == filter_value
        elif condition == "starts_with":
            return value.startswith(filter_value)
        elif condition == "ends_with":
            return value.endswith(filter_value)
        
        return False
    
    async def _apply_filter_action(self, email: Email, filter_obj: EmailFilter):
        """Применение действия фильтра"""
        if filter_obj.action == EmailFilterAction.MARK_AS_READ:
            email.status = EmailStatus.READ
            email.read_at = datetime.utcnow()
        
        elif filter_obj.action == EmailFilterAction.MARK_AS_IMPORTANT:
            email.is_important = True
        
        elif filter_obj.action == EmailFilterAction.MARK_AS_SPAM:
            email.status = EmailStatus.SPAM
            email.category = EmailCategory.SPAM
        
        elif filter_obj.action == EmailFilterAction.MOVE_TO_FOLDER:
            if filter_obj.action_value:
                # Находим папку по имени
                folder_result = await self.session.execute(
                    select(EmailFolder).where(
                        and_(
                            EmailFolder.email_account_id == email.sender_id,
                            EmailFolder.name == filter_obj.action_value
                        )
                    )
                )
                folder = folder_result.scalar_one_or_none()
                
                if folder:
                    await self.move_email_to_folder(email.id, folder.id)
    
    async def create_email_template(
        self,
        user_id: int,
        name: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        is_public: bool = False,
        variables: Optional[Dict[str, Any]] = None
    ) -> EmailTemplate:
        """Создание шаблона email"""
        template = EmailTemplate(
            user_id=user_id,
            name=name,
            description=description,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            category=category,
            is_public=is_public,
            variables=variables or {}
        )
        
        self.session.add(template)
        await self.session.commit()
        return template
    
    async def get_email_templates(
        self, 
        user_id: int, 
        include_public: bool = True
    ) -> List[EmailTemplate]:
        """Получение шаблонов email"""
        query = select(EmailTemplate).where(
            or_(
                EmailTemplate.user_id == user_id,
                and_(EmailTemplate.is_public == True, include_public)
            )
        ).order_by(desc(EmailTemplate.created_at))
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def render_email_template(
        self, 
        template_id: int, 
        variables: Dict[str, Any]
    ) -> Optional[Dict[str, str]]:
        """Рендеринг шаблона email с переменными"""
        result = await self.session.execute(
            select(EmailTemplate).where(EmailTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            return None
        
        # Простая замена переменных в формате {{variable}}
        subject = template.subject
        body_html = template.body_html
        body_text = template.body_text or ""
        
        for var_name, var_value in variables.items():
            placeholder = f"{{{{{var_name}}}}}"
            subject = subject.replace(placeholder, str(var_value))
            body_html = body_html.replace(placeholder, str(var_value))
            body_text = body_text.replace(placeholder, str(var_value))
        
        return {
            "subject": subject,
            "body_html": body_html,
            "body_text": body_text
        }
