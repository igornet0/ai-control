"""
Background tasks module.
"""

from .celery_app import celery_app
from .tasks import (
    process_data,
    send_notification,
    cleanup_old_data,
    generate_report,
    backup_database,
    update_statistics,
    process_file_upload,
    send_bulk_emails,
    process_webhook,
    schedule_task
)
from .kpi_tasks import (
    calculate_kpi,
    calculate_kpi_batch,
    calculate_kpi_for_user,
    calculate_kpi_for_organization,
    calculate_kpi_for_department,
    calculate_kpi_for_period,
    calculate_kpi_trend,
    calculate_kpi_comparison,
    calculate_kpi_forecast,
    calculate_kpi_anomaly
)
from .notification_tasks import (
    send_notification,
    send_bulk_notifications,
    send_email_notification,
    send_sms_notification,
    send_push_notification,
    send_task_reminder,
    send_daily_summary
)
from .email_tasks import (
    send_welcome_email,
    send_password_reset_email,
    send_task_assignment_email,
    send_task_reminder_email,
    send_kpi_report_email,
    send_weekly_report_email,
    send_bulk_emails
)
from .cleanup_tasks import (
    cleanup_old_logs,
    cleanup_old_sessions,
    cleanup_old_notifications,
    cleanup_old_cache,
    cleanup_old_backups,
    cleanup_old_metrics,
    cleanup_old_audit_logs,
    cleanup_old_temp_files
)

__all__ = [
    "celery_app",
    "process_data",
    "send_notification",
    "cleanup_old_data",
    "generate_report",
    "backup_database",
    "update_statistics",
    "process_file_upload",
    "send_bulk_emails",
    "process_webhook",
    "schedule_task",
    "calculate_kpi",
    "calculate_kpi_batch",
    "calculate_kpi_for_user",
    "calculate_kpi_for_organization",
    "calculate_kpi_for_department",
    "calculate_kpi_for_period",
    "calculate_kpi_trend",
    "calculate_kpi_comparison",
    "calculate_kpi_forecast",
    "calculate_kpi_anomaly",
    "send_notification",
    "send_bulk_notifications",
    "send_email_notification",
    "send_sms_notification",
    "send_push_notification",
    "send_task_reminder",
    "send_daily_summary",
    "send_welcome_email",
    "send_password_reset_email",
    "send_task_assignment_email",
    "send_task_reminder_email",
    "send_kpi_report_email",
    "send_weekly_report_email",
    "send_bulk_emails",
    "cleanup_old_logs",
    "cleanup_old_sessions",
    "cleanup_old_notifications",
    "cleanup_old_cache",
    "cleanup_old_backups",
    "cleanup_old_metrics",
    "cleanup_old_audit_logs",
    "cleanup_old_temp_files"
]
