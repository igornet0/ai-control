"""
Logging configuration for the AI Control System.
Provides structured logging with different levels and formats.
"""

import logging
import sys
from typing import Any, Dict

import structlog
from structlog.stdlib import LoggerFactory


def configure_logging(
    log_level: str = "INFO",
    log_format: str = "json",
    enable_console: bool = True,
    enable_file: bool = False,
    log_file: str = "logs/app.log",
) -> None:
    """
    Configure structured logging for the application.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Log format (json, console)
        enable_console: Enable console logging
        enable_file: Enable file logging
        log_file: Path to log file
    """
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )
    
    # Configure structlog processors
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]
    
    if log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=LoggerFactory(),
        context_class=dict,
        cache_logger_on_first_use=True,
    )
    
    # Configure file logging if enabled
    if enable_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(getattr(logging, log_level.upper()))
        
        # Add file handler to root logger
        root_logger = logging.getLogger()
        root_logger.addHandler(file_handler)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.
    
    Args:
        name: Logger name (usually __name__)
        
    Returns:
        Configured structlog logger
    """
    return structlog.get_logger(name)


class LoggerMixin:
    """Mixin class to add logging capabilities to any class."""
    
    @property
    def logger(self) -> structlog.stdlib.BoundLogger:
        """Get logger for this class."""
        return get_logger(self.__class__.__module__ + "." + self.__class__.__name__)


def log_function_call(func_name: str, **kwargs: Any) -> Dict[str, Any]:
    """
    Log function call with parameters.
    
    Args:
        func_name: Name of the function being called
        **kwargs: Function parameters
        
    Returns:
        Dictionary with log data
    """
    return {
        "event": "function_call",
        "function": func_name,
        "parameters": kwargs,
    }


def log_database_operation(operation: str, table: str, **kwargs: Any) -> Dict[str, Any]:
    """
    Log database operation.
    
    Args:
        operation: Database operation (SELECT, INSERT, UPDATE, DELETE)
        table: Table name
        **kwargs: Additional parameters
        
    Returns:
        Dictionary with log data
    """
    return {
        "event": "database_operation",
        "operation": operation,
        "table": table,
        **kwargs,
    }


def log_api_request(method: str, path: str, **kwargs: Any) -> Dict[str, Any]:
    """
    Log API request.
    
    Args:
        method: HTTP method
        path: Request path
        **kwargs: Additional parameters
        
    Returns:
        Dictionary with log data
    """
    return {
        "event": "api_request",
        "method": method,
        "path": path,
        **kwargs,
    }


def log_business_event(event_type: str, **kwargs: Any) -> Dict[str, Any]:
    """
    Log business event.
    
    Args:
        event_type: Type of business event
        **kwargs: Additional parameters
        
    Returns:
        Dictionary with log data
    """
    return {
        "event": "business_event",
        "event_type": event_type,
        **kwargs,
    }
