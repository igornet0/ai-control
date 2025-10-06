"""Dependencies for monitoring services."""

from src.infrastructure.monitoring.health_check import HealthCheckService
from src.infrastructure.monitoring.metrics import get_metrics_collector, get_metrics_middleware, get_business_metrics
from src.infrastructure.monitoring.alerts import get_alert_manager


def get_health_check_service() -> HealthCheckService:
    """Get health check service instance."""
    return HealthCheckService()


def get_metrics_collector_dependency():
    """Get metrics collector dependency."""
    return get_metrics_collector()


def get_metrics_middleware_dependency():
    """Get metrics middleware dependency."""
    return get_metrics_middleware()


def get_business_metrics_dependency():
    """Get business metrics dependency."""
    return get_business_metrics()


def get_alert_manager_dependency():
    """Get alert manager dependency."""
    return get_alert_manager()
