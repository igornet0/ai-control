"""
Error handling middleware for consistent error responses.
"""

from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.infrastructure.config.logging import get_logger
from src.domain.exceptions import (
    DomainException,
    BusinessRuleViolation,
    EntityNotFound,
    EntityAlreadyExists,
    ValidationError,
    PermissionDenied,
    ConcurrencyError,
    ServiceUnavailable,
)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for consistent error handling."""
    
    def __init__(self, app):
        super().__init__(app)
        self.logger = get_logger(__name__)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and handle errors."""
        try:
            return await call_next(request)
            
        except HTTPException as e:
            # FastAPI HTTP exceptions
            return JSONResponse(
                status_code=e.status_code,
                content={
                    "error": {
                        "type": "HTTPException",
                        "message": e.detail,
                        "status_code": e.status_code,
                    }
                }
            )
            
        except BusinessRuleViolation as e:
            # Business rule violations
            self.logger.warning(
                "Business rule violation",
                extra={
                    "error": str(e),
                    "details": e.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "type": "BusinessRuleViolation",
                        "message": e.message,
                        "details": e.details,
                    }
                }
            )
            
        except EntityNotFound as e:
            # Entity not found
            self.logger.warning(
                "Entity not found",
                extra={
                    "entity_type": e.entity_type,
                    "entity_id": e.entity_id,
                    "details": e.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=404,
                content={
                    "error": {
                        "type": "EntityNotFound",
                        "message": e.message,
                        "entity_type": e.entity_type,
                        "entity_id": e.entity_id,
                        "details": e.details,
                    }
                }
            )
            
        except EntityAlreadyExists as e:
            # Entity already exists
            self.logger.warning(
                "Entity already exists",
                extra={
                    "entity_type": e.entity_type,
                    "entity_id": e.entity_id,
                    "details": e.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=409,
                content={
                    "error": {
                        "type": "EntityAlreadyExists",
                        "message": e.message,
                        "entity_type": e.entity_type,
                        "entity_id": e.entity_id,
                        "details": e.details,
                    }
                }
            )
            
        except ValidationError as e:
            # Validation errors
            self.logger.warning(
                "Validation error",
                extra={
                    "field": e.field,
                    "value": e.value,
                    "reason": e.reason,
                    "details": e.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=422,
                content={
                    "error": {
                        "type": "ValidationError",
                        "message": e.message,
                        "field": e.field,
                        "value": e.value,
                        "reason": e.reason,
                        "details": e.details,
                    }
                }
            )
            
        except PermissionDenied as e:
            # Permission denied
            self.logger.warning(
                "Permission denied",
                extra={
                    "operation": e.operation,
                    "resource": e.resource,
                    "user_id": e.user_id,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "type": "PermissionDenied",
                        "message": e.message,
                        "operation": e.operation,
                        "resource": e.resource,
                        "user_id": e.user_id,
                    }
                }
            )
            
        except ConcurrencyError as e:
            # Concurrency errors
            self.logger.warning(
                "Concurrency error",
                extra={
                    "entity_type": e.entity_type,
                    "entity_id": e.entity_id,
                    "details": e.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=409,
                content={
                    "error": {
                        "type": "ConcurrencyError",
                        "message": e.message,
                        "entity_type": e.entity_type,
                        "entity_id": e.entity_id,
                        "details": e.details,
                    }
                }
            )
            
        except ServiceUnavailable as e:
            # Service unavailable
            self.logger.error(
                "Service unavailable",
                extra={
                    "service_name": e.service_name,
                    "details": e.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=503,
                content={
                    "error": {
                        "type": "ServiceUnavailable",
                        "message": e.message,
                        "service_name": e.service_name,
                        "details": e.details,
                    }
                }
            )
            
        except DomainException as e:
            # Generic domain exceptions
            self.logger.error(
                "Domain exception",
                extra={
                    "error": str(e),
                    "details": e.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "type": "DomainException",
                        "message": e.message,
                        "details": e.details,
                    }
                }
            )
            
        except Exception as e:
            # Unexpected errors
            self.logger.error(
                "Unexpected error",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "path": request.url.path,
                    "method": request.method,
                },
                exc_info=True
            )
            
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "type": "InternalServerError",
                        "message": "An unexpected error occurred",
                    }
                }
            )
