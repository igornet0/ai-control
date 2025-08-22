"""
Сервис для единой системы уведомлений
"""
import asyncio
import json
import uuid
import aiohttp
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database.models.notification_model import (
    Notification, NotificationTemplate, NotificationDelivery, 
    UserNotificationPreference, NotificationBatch, NotificationWebhook,
    NotificationType, NotificationPriority, NotificationStatus, NotificationChannel
)
from core.database.models.main_models import User


class NotificationService:
    """Сервис для управления уведомлениями"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_notification(
        self,
        recipient_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        channels: Optional[List[str]] = None,
        template_id: Optional[int] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[int] = None,
        scheduled_at: Optional[datetime] = None,
        expires_at: Optional[datetime] = None,
        variables: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """Создание нового уведомления"""
        # Получаем настройки пользователя
        user_preferences = await self._get_user_preferences(recipient_id, notification_type)
        
        # Определяем каналы доставки
        if channels is None:
            channels = user_preferences.enabled_channels if user_preferences else [NotificationChannel.IN_APP]
        
        # Проверяем приоритет
        if user_preferences and priority.value < user_preferences.min_priority.value:
            return None  # Пользователь не хочет получать уведомления такого приоритета
        
        # Проверяем тихие часы
        if user_preferences and await self._is_quiet_hours(user_preferences):
            # Откладываем уведомление до окончания тихих часов
            scheduled_at = await self._get_next_available_time(user_preferences)
        
        # Создаем уведомление
        notification = Notification(
            notification_uuid=str(uuid.uuid4()),
            recipient_id=recipient_id,
            template_id=template_id,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
            channels=channels,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            scheduled_at=scheduled_at,
            expires_at=expires_at,
            variables=variables or {},
            metadata=metadata or {}
        )
        
        self.session.add(notification)
        await self.session.flush()
        
        # Создаем записи доставки для каждого канала
        await self._create_delivery_records(notification, channels)
        
        # Если уведомление не отложено, отправляем сразу
        if not scheduled_at or scheduled_at <= datetime.utcnow():
            await self._send_notification(notification)
        
        await self.session.commit()
        return notification
    
    async def create_notification_template(
        self,
        name: str,
        notification_type: NotificationType,
        body_template: str,
        subject_template: Optional[str] = None,
        email_template: Optional[str] = None,
        sms_template: Optional[str] = None,
        push_template: Optional[str] = None,
        default_priority: NotificationPriority = NotificationPriority.NORMAL,
        default_channels: Optional[List[str]] = None,
        variables: Optional[Dict[str, Any]] = None
    ) -> NotificationTemplate:
        """Создание шаблона уведомлений"""
        template = NotificationTemplate(
            template_uuid=str(uuid.uuid4()),
            name=name,
            notification_type=notification_type,
            subject_template=subject_template,
            body_template=body_template,
            email_template=email_template,
            sms_template=sms_template,
            push_template=push_template,
            default_priority=default_priority,
            default_channels=default_channels or [NotificationChannel.IN_APP],
            variables=variables or {}
        )
        
        self.session.add(template)
        await self.session.commit()
        return template
    
    async def send_notification_from_template(
        self,
        template_id: int,
        recipient_id: int,
        variables: Dict[str, Any],
        channels: Optional[List[str]] = None,
        priority: Optional[NotificationPriority] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[int] = None
    ) -> Notification:
        """Отправка уведомления по шаблону"""
        # Получаем шаблон
        template = await self.session.execute(
            select(NotificationTemplate).where(NotificationTemplate.id == template_id)
        )
        template_obj = template.scalar_one_or_none()
        
        if not template_obj or not template_obj.is_active:
            raise ValueError("Template not found or inactive")
        
        # Рендерим шаблон
        title = self._render_template(template_obj.subject_template or template_obj.name, variables)
        message = self._render_template(template_obj.body_template, variables)
        
        # Определяем приоритет
        if priority is None:
            priority = template_obj.default_priority
        
        # Определяем каналы
        if channels is None:
            channels = template_obj.default_channels
        
        # Создаем уведомление
        return await self.create_notification(
            recipient_id=recipient_id,
            notification_type=template_obj.notification_type,
            title=title,
            message=message,
            priority=priority,
            channels=channels,
            template_id=template_id,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            variables=variables
        )
    
    async def get_user_notifications(
        self,
        user_id: int,
        page: int = 1,
        per_page: int = 20,
        status: Optional[NotificationStatus] = None,
        notification_type: Optional[NotificationType] = None,
        unread_only: bool = False
    ) -> Tuple[List[Notification], int]:
        """Получение уведомлений пользователя"""
        # Базовый запрос
        query = select(Notification).where(Notification.recipient_id == user_id)
        
        # Фильтры
        if status:
            query = query.where(Notification.status == status)
        if notification_type:
            query = query.where(Notification.notification_type == notification_type)
        if unread_only:
            query = query.where(Notification.read_at.is_(None))
        
        # Подсчитываем общее количество
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await self.session.scalar(count_query)
        
        # Добавляем пагинацию и сортировку
        query = query.order_by(desc(Notification.created_at)).offset(
            (page - 1) * per_page
        ).limit(per_page)
        
        # Выполняем запрос
        result = await self.session.execute(query)
        notifications = result.scalars().all()
        
        return notifications, total_count
    
    async def mark_notification_as_read(
        self,
        notification_id: int,
        user_id: int
    ) -> bool:
        """Отметить уведомление как прочитанное"""
        notification = await self.session.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.recipient_id == user_id
                )
            )
        )
        notification_obj = notification.scalar_one_or_none()
        
        if not notification_obj:
            return False
        
        notification_obj.status = NotificationStatus.READ
        notification_obj.read_at = datetime.utcnow()
        
        await self.session.commit()
        return True
    
    async def mark_all_notifications_as_read(
        self,
        user_id: int,
        notification_type: Optional[NotificationType] = None
    ) -> int:
        """Отметить все уведомления пользователя как прочитанные"""
        query = select(Notification).where(
            and_(
                Notification.recipient_id == user_id,
                Notification.read_at.is_(None)
            )
        )
        
        if notification_type:
            query = query.where(Notification.notification_type == notification_type)
        
        result = await self.session.execute(query)
        notifications = result.scalars().all()
        
        count = 0
        for notification in notifications:
            notification.status = NotificationStatus.READ
            notification.read_at = datetime.utcnow()
            count += 1
        
        await self.session.commit()
        return count
    
    async def delete_notification(
        self,
        notification_id: int,
        user_id: int
    ) -> bool:
        """Удаление уведомления"""
        notification = await self.session.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.recipient_id == user_id
                )
            )
        )
        notification_obj = notification.scalar_one_or_none()
        
        if not notification_obj:
            return False
        
        await self.session.delete(notification_obj)
        await self.session.commit()
        return True
    
    async def get_notification_stats(
        self,
        user_id: int
    ) -> Dict[str, Any]:
        """Получение статистики уведомлений пользователя"""
        # Общее количество уведомлений
        total_count = await self.session.scalar(
            select(func.count(Notification.id)).where(Notification.recipient_id == user_id)
        )
        
        # Непрочитанные уведомления
        unread_count = await self.session.scalar(
            select(func.count(Notification.id)).where(
                and_(
                    Notification.recipient_id == user_id,
                    Notification.read_at.is_(None)
                )
            )
        )
        
        # Уведомления по типам
        type_stats = await self.session.execute(
            select(
                Notification.notification_type,
                func.count(Notification.id)
            ).where(Notification.recipient_id == user_id).group_by(Notification.notification_type)
        )
        type_counts = dict(type_stats.fetchall())
        
        # Уведомления по приоритетам
        priority_stats = await self.session.execute(
            select(
                Notification.priority,
                func.count(Notification.id)
            ).where(Notification.recipient_id == user_id).group_by(Notification.priority)
        )
        priority_counts = dict(priority_stats.fetchall())
        
        return {
            "total_count": total_count,
            "unread_count": unread_count,
            "type_counts": type_counts,
            "priority_counts": priority_counts
        }
    
    async def update_user_preferences(
        self,
        user_id: int,
        notification_type: NotificationType,
        enabled_channels: Optional[List[str]] = None,
        email_enabled: Optional[bool] = None,
        sms_enabled: Optional[bool] = None,
        push_enabled: Optional[bool] = None,
        in_app_enabled: Optional[bool] = None,
        min_priority: Optional[NotificationPriority] = None,
        quiet_hours_start: Optional[str] = None,
        quiet_hours_end: Optional[str] = None,
        timezone: Optional[str] = None,
        batch_notifications: Optional[bool] = None,
        batch_interval_minutes: Optional[int] = None
    ) -> UserNotificationPreference:
        """Обновление настроек уведомлений пользователя"""
        # Получаем существующие настройки или создаем новые
        existing = await self.session.execute(
            select(UserNotificationPreference).where(
                and_(
                    UserNotificationPreference.user_id == user_id,
                    UserNotificationPreference.notification_type == notification_type
                )
            )
        )
        preferences = existing.scalar_one_or_none()
        
        if not preferences:
            preferences = UserNotificationPreference(
                user_id=user_id,
                notification_type=notification_type
            )
            self.session.add(preferences)
        
        # Обновляем настройки
        if enabled_channels is not None:
            preferences.enabled_channels = enabled_channels
        if email_enabled is not None:
            preferences.email_enabled = email_enabled
        if sms_enabled is not None:
            preferences.sms_enabled = sms_enabled
        if push_enabled is not None:
            preferences.push_enabled = push_enabled
        if in_app_enabled is not None:
            preferences.in_app_enabled = in_app_enabled
        if min_priority is not None:
            preferences.min_priority = min_priority
        if quiet_hours_start is not None:
            preferences.quiet_hours_start = quiet_hours_start
        if quiet_hours_end is not None:
            preferences.quiet_hours_end = quiet_hours_end
        if timezone is not None:
            preferences.timezone = timezone
        if batch_notifications is not None:
            preferences.batch_notifications = batch_notifications
        if batch_interval_minutes is not None:
            preferences.batch_interval_minutes = batch_interval_minutes
        
        await self.session.commit()
        return preferences
    
    async def create_webhook(
        self,
        name: str,
        url: str,
        method: str = "POST",
        notification_types: Optional[List[str]] = None,
        notification_priorities: Optional[List[str]] = None,
        headers: Optional[Dict[str, str]] = None,
        auth_type: Optional[str] = None,
        auth_credentials: Optional[Dict[str, str]] = None,
        retry_count: int = 3,
        timeout_seconds: int = 30
    ) -> NotificationWebhook:
        """Создание webhook'а для уведомлений"""
        webhook = NotificationWebhook(
            webhook_uuid=str(uuid.uuid4()),
            name=name,
            url=url,
            method=method,
            notification_types=notification_types or [],
            notification_priorities=notification_priorities or [],
            headers=headers or {},
            auth_type=auth_type,
            auth_credentials=auth_credentials or {},
            retry_count=retry_count,
            timeout_seconds=timeout_seconds
        )
        
        self.session.add(webhook)
        await self.session.commit()
        return webhook
    
    async def _get_user_preferences(
        self,
        user_id: int,
        notification_type: NotificationType
    ) -> Optional[UserNotificationPreference]:
        """Получение настроек пользователя для типа уведомлений"""
        result = await self.session.execute(
            select(UserNotificationPreference).where(
                and_(
                    UserNotificationPreference.user_id == user_id,
                    UserNotificationPreference.notification_type == notification_type
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def _is_quiet_hours(self, preferences: UserNotificationPreference) -> bool:
        """Проверка тихих часов"""
        if not preferences.quiet_hours_start or not preferences.quiet_hours_end:
            return False
        
        # TODO: Реализовать проверку тихих часов с учетом часового пояса
        return False
    
    async def _get_next_available_time(self, preferences: UserNotificationPreference) -> datetime:
        """Получение следующего доступного времени"""
        # TODO: Реализовать расчет следующего доступного времени
        return datetime.utcnow() + timedelta(hours=1)
    
    async def _create_delivery_records(
        self,
        notification: Notification,
        channels: List[str]
    ):
        """Создание записей доставки для каналов"""
        for channel in channels:
            delivery = NotificationDelivery(
                notification_id=notification.id,
                channel=channel,
                status=NotificationStatus.PENDING
            )
            self.session.add(delivery)
    
    async def _send_notification(self, notification: Notification):
        """Отправка уведомления по всем каналам"""
        for delivery in notification.deliveries:
            if delivery.status == NotificationStatus.PENDING:
                await self._send_to_channel(notification, delivery)
    
    async def _send_to_channel(
        self,
        notification: Notification,
        delivery: NotificationDelivery
    ):
        """Отправка уведомления по конкретному каналу"""
        try:
            if delivery.channel == NotificationChannel.IN_APP:
                # Внутренние уведомления обрабатываются отдельно
                delivery.status = NotificationStatus.DELIVERED
                delivery.delivered_at = datetime.utcnow()
            
            elif delivery.channel == NotificationChannel.EMAIL:
                await self._send_email_notification(notification, delivery)
            
            elif delivery.channel == NotificationChannel.SMS:
                await self._send_sms_notification(notification, delivery)
            
            elif delivery.channel == NotificationChannel.PUSH:
                await self._send_push_notification(notification, delivery)
            
            elif delivery.channel == NotificationChannel.WEBHOOK:
                await self._send_webhook_notification(notification, delivery)
            
            # Обновляем статус уведомления
            if delivery.status == NotificationStatus.DELIVERED:
                notification.delivered_channels.append(delivery.channel)
                if not notification.delivered_at:
                    notification.delivered_at = datetime.utcnow()
                notification.status = NotificationStatus.DELIVERED
            
        except Exception as e:
            delivery.status = NotificationStatus.FAILED
            delivery.error_message = str(e)
            delivery.retry_count += 1
    
    async def _send_email_notification(
        self,
        notification: Notification,
        delivery: NotificationDelivery
    ):
        """Отправка email уведомления"""
        # TODO: Интеграция с email сервисом
        delivery.status = NotificationStatus.DELIVERED
        delivery.delivered_at = datetime.utcnow()
    
    async def _send_sms_notification(
        self,
        notification: Notification,
        delivery: NotificationDelivery
    ):
        """Отправка SMS уведомления"""
        # TODO: Интеграция с SMS сервисом
        delivery.status = NotificationStatus.DELIVERED
        delivery.delivered_at = datetime.utcnow()
    
    async def _send_push_notification(
        self,
        notification: Notification,
        delivery: NotificationDelivery
    ):
        """Отправка push уведомления"""
        # TODO: Интеграция с push сервисом
        delivery.status = NotificationStatus.DELIVERED
        delivery.delivered_at = datetime.utcnow()
    
    async def _send_webhook_notification(
        self,
        notification: Notification,
        delivery: NotificationDelivery
    ):
        """Отправка webhook уведомления"""
        # Получаем активные webhook'и
        webhooks = await self.session.execute(
            select(NotificationWebhook).where(
                and_(
                    NotificationWebhook.is_active == True,
                    or_(
                        NotificationWebhook.notification_types == [],
                        notification.notification_type.value.in_(NotificationWebhook.notification_types)
                    ),
                    or_(
                        NotificationWebhook.notification_priorities == [],
                        notification.priority.value.in_(NotificationWebhook.notification_priorities)
                    )
                )
            )
        )
        
        for webhook in webhooks.scalars().all():
            await self._call_webhook(webhook, notification)
    
    async def _call_webhook(
        self,
        webhook: NotificationWebhook,
        notification: Notification
    ):
        """Вызов webhook'а"""
        try:
            payload = {
                "notification_id": notification.notification_uuid,
                "type": notification.notification_type.value,
                "title": notification.title,
                "message": notification.message,
                "priority": notification.priority.value,
                "recipient_id": notification.recipient_id,
                "created_at": notification.created_at.isoformat(),
                "metadata": notification.metadata
            }
            
            headers = webhook.headers.copy()
            if webhook.auth_type == "bearer" and webhook.auth_credentials:
                headers["Authorization"] = f"Bearer {webhook.auth_credentials.get('token', '')}"
            elif webhook.auth_type == "basic" and webhook.auth_credentials:
                import base64
                auth_str = f"{webhook.auth_credentials.get('username', '')}:{webhook.auth_credentials.get('password', '')}"
                headers["Authorization"] = f"Basic {base64.b64encode(auth_str.encode()).decode()}"
            
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=webhook.method,
                    url=webhook.url,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=webhook.timeout_seconds)
                ) as response:
                    webhook.total_calls += 1
                    webhook.last_called_at = datetime.utcnow()
                    
                    if response.status < 400:
                        webhook.successful_calls += 1
                    else:
                        webhook.failed_calls += 1
                        raise Exception(f"HTTP {response.status}")
            
        except Exception as e:
            webhook.total_calls += 1
            webhook.failed_calls += 1
            webhook.last_called_at = datetime.utcnow()
            raise e
    
    def _render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """Рендеринг шаблона с переменными"""
        try:
            return template.format(**variables)
        except (KeyError, ValueError):
            return template
