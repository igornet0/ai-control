"""
Message domain entity.
Represents a message in the communication system.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class MessageType(str, Enum):
    """Message type enumeration."""
    
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"
    NOTIFICATION = "notification"


class MessageStatus(str, Enum):
    """Message status enumeration."""
    
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class MessageCreatedEvent(DomainEvent):
    """Event raised when a message is created."""
    
    def __init__(self, message_id: UUID, sender_id: UUID, message_type: MessageType):
        super().__init__(
            event_type="message_created",
            aggregate_id=str(message_id),
            aggregate_type="Message",
            data={
                "message_id": str(message_id),
                "sender_id": str(sender_id),
                "message_type": message_type.value,
            }
        )


class Message(Message):
    """Message domain entity."""
    
    # Basic information
    content: str = Field(..., min_length=1, description="Message content")
    message_type: MessageType = Field(default=MessageType.TEXT, description="Message type")
    status: MessageStatus = Field(default=MessageStatus.SENT, description="Message status")
    
    # Participants
    sender_id: UUID = Field(..., description="Sender ID")
    recipient_id: Optional[UUID] = Field(default=None, description="Recipient ID")
    channel_id: Optional[UUID] = Field(default=None, description="Channel ID")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Message metadata")
    attachments: List[str] = Field(default_factory=list, description="Attachment URLs")
    
    # Timestamps
    sent_at: datetime = Field(default_factory=datetime.utcnow, description="Sent timestamp")
    delivered_at: Optional[datetime] = Field(default=None, description="Delivered timestamp")
    read_at: Optional[datetime] = Field(default=None, description="Read timestamp")
    
    @validator("content")
    def validate_content(cls, v):
        """Validate message content."""
        if not v.strip():
            raise ValidationError(
                field="content",
                value=v,
                reason="Message content cannot be empty or only whitespace"
            )
        return v.strip()
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the message."""
        # Check if message has recipient or channel
        if not self.recipient_id and not self.channel_id:
            raise BusinessRuleViolation(
                "Message must have either recipient or channel",
                {"recipient_id": str(self.recipient_id), "channel_id": str(self.channel_id)}
            )
        
        # Check if system message has system sender
        if self.message_type == MessageType.SYSTEM and self.sender_id:
            raise BusinessRuleViolation(
                "System message cannot have sender",
                {"message_type": self.message_type.value, "sender_id": str(self.sender_id)}
            )
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if message can be edited by user."""
        # Only sender can edit their own messages
        return user_id == self.sender_id
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if message can be deleted by user."""
        # Only sender can delete their own messages
        return user_id == self.sender_id
    
    def mark_as_delivered(self) -> None:
        """Mark message as delivered."""
        if self.status == MessageStatus.SENT:
            self.status = MessageStatus.DELIVERED
            self.delivered_at = datetime.utcnow()
            self.mark_as_updated()
    
    def mark_as_read(self) -> None:
        """Mark message as read."""
        if self.status in [MessageStatus.SENT, MessageStatus.DELIVERED]:
            self.status = MessageStatus.READ
            self.read_at = datetime.utcnow()
            self.mark_as_updated()
    
    def mark_as_failed(self) -> None:
        """Mark message as failed."""
        self.status = MessageStatus.FAILED
        self.mark_as_updated()
    
    def is_sent(self) -> bool:
        """Check if message is sent."""
        return self.status == MessageStatus.SENT
    
    def is_delivered(self) -> bool:
        """Check if message is delivered."""
        return self.status == MessageStatus.DELIVERED
    
    def is_read(self) -> bool:
        """Check if message is read."""
        return self.status == MessageStatus.READ
    
    def is_failed(self) -> bool:
        """Check if message is failed."""
        return self.status == MessageStatus.FAILED
    
    def is_system_message(self) -> bool:
        """Check if message is system message."""
        return self.message_type == MessageType.SYSTEM
    
    def is_private_message(self) -> bool:
        """Check if message is private message."""
        return self.recipient_id is not None and self.channel_id is None
    
    def is_channel_message(self) -> bool:
        """Check if message is channel message."""
        return self.channel_id is not None and self.recipient_id is None
    
    def has_attachments(self) -> bool:
        """Check if message has attachments."""
        return len(self.attachments) > 0
    
    def add_attachment(self, url: str) -> None:
        """Add attachment to message."""
        if url not in self.attachments:
            self.attachments.append(url)
            self.mark_as_updated()
    
    def remove_attachment(self, url: str) -> None:
        """Remove attachment from message."""
        if url in self.attachments:
            self.attachments.remove(url)
            self.mark_as_updated()
    
    def get_attachment_count(self) -> int:
        """Get number of attachments."""
        return len(self.attachments)
    
    def get_content_preview(self, max_length: int = 100) -> str:
        """Get content preview."""
        if len(self.content) <= max_length:
            return self.content
        
        return self.content[:max_length] + "..."
    
    @classmethod
    def create(
        cls,
        content: str,
        sender_id: UUID,
        message_type: MessageType = MessageType.TEXT,
        recipient_id: Optional[UUID] = None,
        channel_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[str]] = None,
    ) -> "Message":
        """Create a new message."""
        message = cls(
            content=content,
            message_type=message_type,
            sender_id=sender_id,
            recipient_id=recipient_id,
            channel_id=channel_id,
            metadata=metadata or {},
            attachments=attachments or [],
        )
        
        # Validate business rules
        message.validate_business_rules()
        
        # Add domain event
        message.add_domain_event(MessageCreatedEvent(message.id, sender_id, message_type))
        
        return message
