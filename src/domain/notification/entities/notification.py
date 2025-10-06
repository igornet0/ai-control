"""
Notification domain entity.
Represents a notification in the system.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class NotificationType(str, Enum):
    """Notification type enumeration."""
    
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"
    TASK = "task"
    MESSAGE = "message"
    EVENT = "event"
    SYSTEM = "system"


class NotificationStatus(str, Enum):
    """Notification status enumeration."""
    
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NotificationPriority(str, Enum):
    """Notification priority enumeration."""
    
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationCreatedEvent(DomainEvent):
    """Event raised when a notification is created."""
    
    def __init__(self, notification_id: UUID, recipient_id: UUID, notification_type: NotificationType):
        super().__init__(
            event_type="notification_created",
            aggregate_id=str(notification_id),
            aggregate_type="Notification",
            data={
                "notification_id": str(notification_id),
                "recipient_id": str(recipient_id),
                "notification_type": notification_type.value,
            }
        )


class Notification(Notification):
    """Notification domain entity."""
    
    # Basic information
    title: str = Field(..., min_length=1, max_length=255, description="Notification title")
    message: str = Field(..., min_length=1, description="Notification message")
    notification_type: NotificationType = Field(default=NotificationType.INFO, description="Notification type")
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM, description="Notification priority")
    status: NotificationStatus = Field(default=NotificationStatus.PENDING, description="Notification status")
    
    # Recipient
    recipient_id: UUID = Field(..., description="Recipient ID")
    
    # Sender
    sender_id: Optional[UUID] = Field(default=None, description="Sender ID")
    
    # Related entities
    related_entity_type: Optional[str] = Field(default=None, description="Related entity type")
    related_entity_id: Optional[UUID] = Field(default=None, description="Related entity ID")
    
    # Delivery
    delivery_methods: List[str] = Field(default_factory=list, description="Delivery methods")
    scheduled_at: Optional[datetime] = Field(default=None, description="Scheduled delivery time")
    expires_at: Optional[datetime] = Field(default=None, description="Expiration time")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Notification metadata")
    action_url: Optional[str] = Field(default=None, description="Action URL")
    action_text: Optional[str] = Field(default=None, description="Action text")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    sent_at: Optional[datetime] = Field(default=None, description="Sent timestamp")
    delivered_at: Optional[datetime] = Field(default=None, description="Delivered timestamp")
    read_at: Optional[datetime] = Field(default=None, description="Read timestamp")
    
    @validator("title")
    def validate_title(cls, v):
        """Validate notification title."""
        if not v.strip():
            raise ValidationError(
                field="title",
                value=v,
                reason="Notification title cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("message")
    def validate_message(cls, v):
        """Validate notification message."""
        if not v.strip():
            raise ValidationError(
                field="message",
                value=v,
                reason="Notification message cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("delivery_methods")
    def validate_delivery_methods(cls, v):
        """Validate delivery methods."""
        valid_methods = ["email", "sms", "push", "in_app", "webhook"]
        for method in v:
            if method not in valid_methods:
                raise ValidationError(
                    field="delivery_methods",
                    value=method,
                    reason=f"Invalid delivery method: {method}. Valid methods: {', '.join(valid_methods)}"
                )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the notification."""
        # Check if notification has at least one delivery method
        if not self.delivery_methods:
            raise BusinessRuleViolation(
                "Notification must have at least one delivery method",
                {"delivery_methods": self.delivery_methods}
            )
        
        # Check if scheduled notification has future time
        if self.scheduled_at and self.scheduled_at <= datetime.utcnow():
            raise BusinessRuleViolation(
                "Scheduled notification must have future time",
                {"scheduled_at": self.scheduled_at.isoformat()}
            )
        
        # Check if notification has expiration time
        if self.expires_at and self.expires_at <= datetime.utcnow():
            raise BusinessRuleViolation(
                "Notification expiration time must be in the future",
                {"expires_at": self.expires_at.isoformat()}
            )
    
    def can_be_cancelled_by(self, user_id: UUID) -> bool:
        """Check if notification can be cancelled by user."""
        # Sender can cancel if notification is pending
        if user_id == self.sender_id and self.status == NotificationStatus.PENDING:
            return True
        
        # Recipient can cancel if notification is pending
        if user_id == self.recipient_id and self.status == NotificationStatus.PENDING:
            return True
        
        return False
    
    def can_be_read_by(self, user_id: UUID) -> bool:
        """Check if notification can be read by user."""
        # Only recipient can read
        return user_id == self.recipient_id
    
    def mark_as_sent(self) -> None:
        """Mark notification as sent."""
        if self.status == NotificationStatus.PENDING:
            self.status = NotificationStatus.SENT
            self.sent_at = datetime.utcnow()
            self.mark_as_updated()
    
    def mark_as_delivered(self) -> None:
        """Mark notification as delivered."""
        if self.status == NotificationStatus.SENT:
            self.status = NotificationStatus.DELIVERED
            self.delivered_at = datetime.utcnow()
            self.mark_as_updated()
    
    def mark_as_read(self) -> None:
        """Mark notification as read."""
        if self.status in [NotificationStatus.SENT, NotificationStatus.DELIVERED]:
            self.status = NotificationStatus.READ
            self.read_at = datetime.utcnow()
            self.mark_as_updated()
    
    def mark_as_failed(self) -> None:
        """Mark notification as failed."""
        self.status = NotificationStatus.FAILED
        self.mark_as_updated()
    
    def mark_as_cancelled(self) -> None:
        """Mark notification as cancelled."""
        if self.status == NotificationStatus.PENDING:
            self.status = NotificationStatus.CANCELLED
            self.mark_as_updated()
    
    def is_pending(self) -> bool:
        """Check if notification is pending."""
        return self.status == NotificationStatus.PENDING
    
    def is_sent(self) -> bool:
        """Check if notification is sent."""
        return self.status == NotificationStatus.SENT
    
    def is_delivered(self) -> bool:
        """Check if notification is delivered."""
        return self.status == NotificationStatus.DELIVERED
    
    def is_read(self) -> bool:
        """Check if notification is read."""
        return self.status == NotificationStatus.READ
    
    def is_failed(self) -> bool:
        """Check if notification is failed."""
        return self.status == NotificationStatus.FAILED
    
    def is_cancelled(self) -> bool:
        """Check if notification is cancelled."""
        return self.status == NotificationStatus.CANCELLED
    
    def is_expired(self) -> bool:
        """Check if notification is expired."""
        if not self.expires_at:
            return False
        
        return datetime.utcnow() > self.expires_at
    
    def is_scheduled(self) -> bool:
        """Check if notification is scheduled."""
        return self.scheduled_at is not None
    
    def is_ready_to_send(self) -> bool:
        """Check if notification is ready to send."""
        if self.status != NotificationStatus.PENDING:
            return False
        
        if self.is_expired():
            return False
        
        if self.is_scheduled():
            return datetime.utcnow() >= self.scheduled_at
        
        return True
    
    def is_high_priority(self) -> bool:
        """Check if notification is high priority."""
        return self.priority in [NotificationPriority.HIGH, NotificationPriority.URGENT]
    
    def is_urgent(self) -> bool:
        """Check if notification is urgent."""
        return self.priority == NotificationPriority.URGENT
    
    def is_info(self) -> bool:
        """Check if notification is info type."""
        return self.notification_type == NotificationType.INFO
    
    def is_warning(self) -> bool:
        """Check if notification is warning type."""
        return self.notification_type == NotificationType.WARNING
    
    def is_error(self) -> bool:
        """Check if notification is error type."""
        return self.notification_type == NotificationType.ERROR
    
    def is_success(self) -> bool:
        """Check if notification is success type."""
        return self.notification_type == NotificationType.SUCCESS
    
    def is_task_notification(self) -> bool:
        """Check if notification is task type."""
        return self.notification_type == NotificationType.TASK
    
    def is_message_notification(self) -> bool:
        """Check if notification is message type."""
        return self.notification_type == NotificationType.MESSAGE
    
    def is_event_notification(self) -> bool:
        """Check if notification is event type."""
        return self.notification_type == NotificationType.EVENT
    
    def is_system_notification(self) -> bool:
        """Check if notification is system type."""
        return self.notification_type == NotificationType.SYSTEM
    
    def has_action(self) -> bool:
        """Check if notification has action."""
        return self.action_url is not None and self.action_text is not None
    
    def get_delivery_methods(self) -> List[str]:
        """Get delivery methods."""
        return self.delivery_methods.copy()
    
    def add_delivery_method(self, method: str) -> None:
        """Add delivery method."""
        if method not in self.delivery_methods:
            self.delivery_methods.append(method)
            self.mark_as_updated()
    
    def remove_delivery_method(self, method: str) -> None:
        """Remove delivery method."""
        if method in self.delivery_methods:
            self.delivery_methods.remove(method)
            self.mark_as_updated()
    
    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Get metadata value by key."""
        return self.metadata.get(key, default)
    
    def set_metadata(self, key: str, value: Any) -> None:
        """Set metadata value by key."""
        self.metadata[key] = value
        self.mark_as_updated()
    
    def remove_metadata(self, key: str) -> None:
        """Remove metadata value by key."""
        if key in self.metadata:
            del self.metadata[key]
            self.mark_as_updated()
    
    def get_time_until_send(self) -> Optional[timedelta]:
        """Get time until notification should be sent."""
        if not self.is_scheduled():
            return None
        
        if self.scheduled_at <= datetime.utcnow():
            return timedelta(0)
        
        return self.scheduled_at - datetime.utcnow()
    
    def get_time_until_expiry(self) -> Optional[timedelta]:
        """Get time until notification expires."""
        if not self.expires_at:
            return None
        
        if self.expires_at <= datetime.utcnow():
            return timedelta(0)
        
        return self.expires_at - datetime.utcnow()
    
    @classmethod
    def create(
        cls,
        title: str,
        message: str,
        recipient_id: UUID,
        notification_type: NotificationType = NotificationType.INFO,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        sender_id: Optional[UUID] = None,
        delivery_methods: Optional[List[str]] = None,
        scheduled_at: Optional[datetime] = None,
        expires_at: Optional[datetime] = None,
        action_url: Optional[str] = None,
        action_text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "Notification":
        """Create a new notification."""
        notification = cls(
            title=title,
            message=message,
            recipient_id=recipient_id,
            notification_type=notification_type,
            priority=priority,
            sender_id=sender_id,
            delivery_methods=delivery_methods or ["in_app"],
            scheduled_at=scheduled_at,
            expires_at=expires_at,
            action_url=action_url,
            action_text=action_text,
            metadata=metadata or {},
        )
        
        # Validate business rules
        notification.validate_business_rules()
        
        # Add domain event
        notification.add_domain_event(NotificationCreatedEvent(
            notification.id, recipient_id, notification_type
        ))
        
        return notification
