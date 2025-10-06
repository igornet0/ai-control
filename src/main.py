"""
Main application entry point.
Creates and configures the FastAPI application with Clean Architecture.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.infrastructure.config.logging import configure_logging, get_logger
from src.infrastructure.config.settings import get_settings
from src.presentation.api.controllers.auth_controller import router as auth_router
from src.presentation.api.controllers.user_controller import router as user_router
from src.presentation.api.controllers.task_controller import router as task_router
from src.presentation.api.controllers.dashboard_controller import router as dashboard_router
from src.presentation.api.controllers.kpi_controller import router as kpi_router
from src.presentation.api.controllers.datacode_controller import router as datacode_router
from src.presentation.api.controllers.monitoring_controller import router as monitoring_router
from src.presentation.api.controllers.webhook_controller import router as webhook_router

# Configure logging
configure_logging(
    log_level="INFO",
    log_format="json",
    enable_console=True,
    enable_file=False,
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting AI Control System application")
    
    # Initialize database connections, external services, etc.
    # This will be implemented with proper dependency injection
    
    logger.info("Application startup completed")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Control System application")
    
    # Clean up resources
    # This will be implemented with proper cleanup logic
    
    logger.info("Application shutdown completed")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    Returns:
        FastAPI: Configured application instance
    """
    settings = get_settings()
    
    app = FastAPI(
        title=settings.api.title,
        version=settings.api.version,
        description=settings.api.description,
        docs_url=settings.api.docs_url,
        redoc_url=settings.api.redoc_url,
        openapi_url=settings.api.openapi_url,
        lifespan=lifespan,
    )
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api.cors_origins,
        allow_credentials=settings.api.cors_allow_credentials,
        allow_methods=settings.api.cors_allow_methods,
        allow_headers=settings.api.cors_allow_headers,
    )
    
    # Add exception handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        """Global exception handler."""
        logger.error("Unhandled exception", extra={
            "error": str(exc),
            "error_type": type(exc).__name__,
            "path": str(request.url),
            "method": request.method,
        })
        
        return JSONResponse(
            status_code=500,
            content={
                "message": "Internal server error",
                "error_type": type(exc).__name__,
            }
        )
    
    # Include routers
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(user_router, prefix="/api/v1")
    app.include_router(task_router, prefix="/api/v1")
    app.include_router(dashboard_router, prefix="/api/v1")
    app.include_router(kpi_router, prefix="/api/v1")
    app.include_router(datacode_router, prefix="/api/v1")
    app.include_router(monitoring_router, prefix="/api/v1")
    app.include_router(webhook_router, prefix="/api/v1")
    
    # Health check endpoint
    @app.get("/health", tags=["health"])
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "version": settings.api.version,
            "environment": settings.environment,
        }
    
    # Root endpoint
    @app.get("/", tags=["root"])
    async def root():
        """Root endpoint."""
        return {
            "message": "AI Control System API",
            "version": settings.api.version,
            "docs_url": settings.api.docs_url,
        }
    
    logger.info("FastAPI application created successfully")
    
    return app


# Create the application instance
app = create_app()


def main():
    """Main entry point for running the application."""
    import uvicorn
    
    settings = get_settings()
    
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        log_level=settings.logging.level.lower(),
    )


if __name__ == "__main__":
    main()
