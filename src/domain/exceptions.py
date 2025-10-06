"""
Domain exceptions for the AI Control System.
Defines business logic exceptions that can be raised in the domain layer.
"""

from typing import Any, Dict, Optional


class DomainException(Exception):
    """Base exception for domain layer."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class BusinessRuleViolation(DomainException):
    """Raised when a business rule is violated."""
    pass


class EntityNotFound(DomainException):
    """Raised when an entity is not found."""
    
    def __init__(self, entity_type: str, entity_id: Any, details: Optional[Dict[str, Any]] = None):
        message = f"{entity_type} with id {entity_id} not found"
        super().__init__(message, details)
        self.entity_type = entity_type
        self.entity_id = entity_id


class EntityAlreadyExists(DomainException):
    """Raised when trying to create an entity that already exists."""
    
    def __init__(self, entity_type: str, entity_id: Any, details: Optional[Dict[str, Any]] = None):
        message = f"{entity_type} with id {entity_id} already exists"
        super().__init__(message, details)
        self.entity_type = entity_type
        self.entity_id = entity_id


class InvalidOperation(DomainException):
    """Raised when an invalid operation is attempted."""
    pass


class PermissionDenied(DomainException):
    """Raised when a user doesn't have permission to perform an operation."""
    
    def __init__(self, operation: str, resource: str, user_id: Optional[str] = None):
        message = f"Permission denied for operation '{operation}' on resource '{resource}'"
        details = {"operation": operation, "resource": resource, "user_id": user_id}
        super().__init__(message, details)
        self.operation = operation
        self.resource = resource
        self.user_id = user_id


class ValidationError(DomainException):
    """Raised when domain validation fails."""
    
    def __init__(self, field: str, value: Any, reason: str, details: Optional[Dict[str, Any]] = None):
        message = f"Validation failed for field '{field}': {reason}"
        super().__init__(message, details)
        self.field = field
        self.value = value
        self.reason = reason


class ConcurrencyError(DomainException):
    """Raised when a concurrency conflict occurs."""
    
    def __init__(self, entity_type: str, entity_id: Any, details: Optional[Dict[str, Any]] = None):
        message = f"Concurrency conflict for {entity_type} with id {entity_id}"
        super().__init__(message, details)
        self.entity_type = entity_type
        self.entity_id = entity_id


class DomainEventError(DomainException):
    """Raised when there's an error with domain events."""
    pass


class RepositoryError(DomainException):
    """Raised when there's an error in the repository layer."""
    pass


class ServiceUnavailable(DomainException):
    """Raised when an external service is unavailable."""
    
    def __init__(self, service_name: str, details: Optional[Dict[str, Any]] = None):
        message = f"Service '{service_name}' is unavailable"
        super().__init__(message, details)
        self.service_name = service_name
