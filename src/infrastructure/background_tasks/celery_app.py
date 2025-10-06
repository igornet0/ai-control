"""
Celery application configuration.
"""

from celery import Celery
from src.infrastructure.config.settings import get_settings

# Get settings
settings = get_settings()

# Create Celery app
celery_app = Celery(
    "ai_control",
    broker=settings.celery.broker_url,
    backend=settings.celery.result_backend,
    include=[
        "src.infrastructure.background_tasks.tasks",
        "src.infrastructure.background_tasks.kpi_tasks",
        "src.infrastructure.background_tasks.notification_tasks",
        "src.infrastructure.background_tasks.report_tasks",
    ]
)

# Configure Celery
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Task routing
    task_routes={
        "src.infrastructure.background_tasks.tasks.*": {"queue": "default"},
        "src.infrastructure.background_tasks.kpi_tasks.*": {"queue": "kpi"},
        "src.infrastructure.background_tasks.notification_tasks.*": {"queue": "notifications"},
        "src.infrastructure.background_tasks.report_tasks.*": {"queue": "reports"},
    },
    
    # Task execution settings
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    
    # Result backend settings
    result_expires=3600,  # 1 hour
    
    # Beat schedule for periodic tasks
    beat_schedule={
        "calculate-kpi-values": {
            "task": "src.infrastructure.background_tasks.kpi_tasks.calculate_all_kpi_values",
            "schedule": 300.0,  # Every 5 minutes
        },
        "send-daily-reports": {
            "task": "src.infrastructure.background_tasks.report_tasks.send_daily_reports",
            "schedule": 86400.0,  # Every 24 hours
        },
        "cleanup-old-sessions": {
            "task": "src.infrastructure.background_tasks.tasks.cleanup_old_sessions",
            "schedule": 3600.0,  # Every hour
        },
        "backup-database": {
            "task": "src.infrastructure.background_tasks.tasks.backup_database",
            "schedule": 86400.0,  # Every 24 hours
        },
    },
    
    # Error handling
    task_annotations={
        "*": {"rate_limit": "100/m"},
        "src.infrastructure.background_tasks.kpi_tasks.calculate_all_kpi_values": {"rate_limit": "10/m"},
    },
)

# Optional configuration for development
if settings.is_development:
    celery_app.conf.update(
        task_always_eager=False,  # Set to True for testing
        task_eager_propagates=True,
    )
