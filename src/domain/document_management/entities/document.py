"""
Document domain entity.
Represents a document in the system with business logic and validation.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class DocumentType(str, Enum):
    """Document type enumeration."""
    
    FILE = "file"
    FOLDER = "folder"
    LINK = "link"
    TEXT = "text"


class DocumentStatus(str, Enum):
    """Document status enumeration."""
    
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DELETED = "deleted"


class DocumentCreatedEvent(DomainEvent):
    """Event raised when a document is created."""
    
    def __init__(self, document_id: UUID, name: str, document_type: DocumentType, created_by: UUID):
        super().__init__(
            event_type="document_created",
            aggregate_id=str(document_id),
            aggregate_type="Document",
            data={
                "document_id": str(document_id),
                "name": name,
                "document_type": document_type.value,
                "created_by": str(created_by),
            }
        )


class Document(Document):
    """Document domain entity."""
    
    # Basic information
    name: str = Field(..., min_length=1, max_length=255, description="Document name")
    description: Optional[str] = Field(default=None, description="Document description")
    document_type: DocumentType = Field(..., description="Document type")
    status: DocumentStatus = Field(default=DocumentStatus.DRAFT, description="Document status")
    
    # File information
    file_path: Optional[str] = Field(default=None, description="File path")
    file_size: Optional[int] = Field(default=None, ge=0, description="File size in bytes")
    mime_type: Optional[str] = Field(default=None, description="MIME type")
    file_hash: Optional[str] = Field(default=None, description="File hash")
    
    # Content
    content: Optional[str] = Field(default=None, description="Document content")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    
    # Hierarchy
    parent_id: Optional[UUID] = Field(default=None, description="Parent document ID")
    
    # User and organizational context
    created_by: UUID = Field(..., description="Document creator ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate document name."""
        if not v.strip():
            raise ValidationError(
                field="name",
                value=v,
                reason="Document name cannot be empty or only whitespace"
            )
        return v.strip()
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the document."""
        # Check if folder has content
        if self.document_type == DocumentType.FOLDER and self.content:
            raise BusinessRuleViolation(
                "Folder cannot have content",
                {"document_type": self.document_type.value, "content": self.content}
            )
        
        # Check if file has file_path
        if self.document_type == DocumentType.FILE and not self.file_path:
            raise BusinessRuleViolation(
                "File must have file path",
                {"document_type": self.document_type.value, "file_path": self.file_path}
            )
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if document can be edited by user."""
        # Creator can always edit
        if user_id == self.created_by:
            return True
        
        # Add more business logic for permissions
        return False
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if document can be deleted by user."""
        # Creator can always delete
        if user_id == self.created_by:
            return True
        
        # Add more business logic for permissions
        return False
    
    def is_folder(self) -> bool:
        """Check if document is a folder."""
        return self.document_type == DocumentType.FOLDER
    
    def is_file(self) -> bool:
        """Check if document is a file."""
        return self.document_type == DocumentType.FILE
    
    def is_link(self) -> bool:
        """Check if document is a link."""
        return self.document_type == DocumentType.LINK
    
    def is_text(self) -> bool:
        """Check if document is text."""
        return self.document_type == DocumentType.TEXT
    
    def is_published(self) -> bool:
        """Check if document is published."""
        return self.status == DocumentStatus.PUBLISHED
    
    def is_draft(self) -> bool:
        """Check if document is draft."""
        return self.status == DocumentStatus.DRAFT
    
    def is_archived(self) -> bool:
        """Check if document is archived."""
        return self.status == DocumentStatus.ARCHIVED
    
    def is_deleted(self) -> bool:
        """Check if document is deleted."""
        return self.status == DocumentStatus.DELETED
    
    def get_file_extension(self) -> Optional[str]:
        """Get file extension if it's a file."""
        if not self.is_file() or not self.name:
            return None
        
        parts = self.name.split('.')
        return parts[-1] if len(parts) > 1 else None
    
    def get_file_size_formatted(self) -> str:
        """Get formatted file size."""
        if not self.file_size:
            return "Unknown"
        
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        
        return f"{size:.1f} PB"
    
    @classmethod
    def create(
        cls,
        name: str,
        document_type: DocumentType,
        created_by: UUID,
        description: Optional[str] = None,
        content: Optional[str] = None,
        file_path: Optional[str] = None,
        file_size: Optional[int] = None,
        mime_type: Optional[str] = None,
        file_hash: Optional[str] = None,
        parent_id: Optional[UUID] = None,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
    ) -> "Document":
        """Create a new document."""
        document = cls(
            name=name,
            description=description,
            document_type=document_type,
            content=content,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            file_hash=file_hash,
            parent_id=parent_id,
            created_by=created_by,
            organization_id=organization_id,
            department_id=department_id,
        )
        
        # Validate business rules
        document.validate_business_rules()
        
        # Add domain event
        document.add_domain_event(DocumentCreatedEvent(document.id, name, document_type, created_by))
        
        return document
