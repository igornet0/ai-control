"""Alert system for monitoring and notifications."""

import asyncio
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

from src.infrastructure.config.logging import get_logger
from src.infrastructure.monitoring.health_check import HealthStatus
from src.infrastructure.monitoring.metrics import MetricsCollector, MetricSummary

logger = get_logger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(Enum):
    """Alert status."""
    ACTIVE = "active"
    RESOLVED = "resolved"
    ACKNOWLEDGED = "acknowledged"


@dataclass
class Alert:
    """Alert data structure."""
    id: str
    title: str
    description: str
    severity: AlertSeverity
    status: AlertStatus
    source: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class AlertRule:
    """Alert rule configuration."""
    id: str
    name: str
    description: str
    condition: Callable[[Any], bool]
    severity: AlertSeverity
    enabled: bool = True
    cooldown_minutes: int = 5
    last_triggered: Optional[datetime] = None


class AlertManager:
    """Manages alerts and alert rules."""

    def __init__(self):
        self.alerts: Dict[str, Alert] = {}
        self.rules: Dict[str, AlertRule] = {}
        self.notification_handlers: List[Callable[[Alert], None]] = []
        self.lock = asyncio.Lock()

    def add_rule(self, rule: AlertRule) -> None:
        """Add an alert rule."""
        self.rules[rule.id] = rule

    def remove_rule(self, rule_id: str) -> None:
        """Remove an alert rule."""
        if rule_id in self.rules:
            del self.rules[rule_id]

    def add_notification_handler(self, handler: Callable[[Alert], None]) -> None:
        """Add a notification handler for alerts."""
        self.notification_handlers.append(handler)

    async def check_health_alerts(self, health_results: Dict[str, HealthStatus]) -> None:
        """Check health status and trigger alerts."""
        for service_name, health_status in health_results.items():
            rule_id = f"health_{service_name}"
            
            if rule_id in self.rules:
                rule = self.rules[rule_id]
                
                if not rule.enabled:
                    continue
                
                # Check if rule should trigger
                should_trigger = rule.condition(health_status)
                
                if should_trigger:
                    await self._trigger_alert(rule, health_status)
                else:
                    # Resolve any active alerts for this service
                    await self._resolve_health_alert(service_name)

    async def check_metric_alerts(
        self,
        metrics_collector: MetricsCollector,
        metric_name: str,
        threshold: float,
        comparison: str = "greater_than"
    ) -> None:
        """Check metric values and trigger alerts."""
        summary = await metrics_collector.get_summary(metric_name)
        
        if not summary:
            return
        
        rule_id = f"metric_{metric_name}_{comparison}_{threshold}"
        
        if rule_id in self.rules:
            rule = self.rules[rule_id]
            
            if not rule.enabled:
                return
            
            should_trigger = False
            
            if comparison == "greater_than":
                should_trigger = summary.last_value > threshold
            elif comparison == "less_than":
                should_trigger = summary.last_value < threshold
            elif comparison == "equals":
                should_trigger = summary.last_value == threshold
            
            if should_trigger:
                await self._trigger_metric_alert(rule, summary, threshold, comparison)

    async def _trigger_alert(self, rule: AlertRule, data: Any) -> None:
        """Trigger an alert based on a rule."""
        # Check cooldown
        if (rule.last_triggered and 
            datetime.utcnow() - rule.last_triggered < timedelta(minutes=rule.cooldown_minutes)):
            return
        
        alert_id = f"{rule.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        alert = Alert(
            id=alert_id,
            title=f"{rule.name}",
            description=rule.description,
            severity=rule.severity,
            status=AlertStatus.ACTIVE,
            source=rule.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            metadata={"rule_id": rule.id, "data": asdict(data) if hasattr(data, '__dict__') else str(data)}
        )
        
        async with self.lock:
            self.alerts[alert_id] = alert
            rule.last_triggered = datetime.utcnow()
        
        logger.warning(f"Alert triggered: {alert.title} - {alert.description}")
        
        # Send notifications
        await self._send_notifications(alert)

    async def _trigger_metric_alert(
        self,
        rule: AlertRule,
        summary: MetricSummary,
        threshold: float,
        comparison: str
    ) -> None:
        """Trigger a metric-based alert."""
        # Check cooldown
        if (rule.last_triggered and 
            datetime.utcnow() - rule.last_triggered < timedelta(minutes=rule.cooldown_minutes)):
            return
        
        alert_id = f"{rule.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        alert = Alert(
            id=alert_id,
            title=f"Metric Alert: {rule.name}",
            description=f"{rule.description} - Current value: {summary.last_value}, Threshold: {threshold}",
            severity=rule.severity,
            status=AlertStatus.ACTIVE,
            source=rule.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            metadata={
                "rule_id": rule.id,
                "metric_name": summary.name,
                "current_value": summary.last_value,
                "threshold": threshold,
                "comparison": comparison,
                "summary": asdict(summary)
            }
        )
        
        async with self.lock:
            self.alerts[alert_id] = alert
            rule.last_triggered = datetime.utcnow()
        
        logger.warning(f"Metric alert triggered: {alert.title} - {alert.description}")
        
        # Send notifications
        await self._send_notifications(alert)

    async def _resolve_health_alert(self, service_name: str) -> None:
        """Resolve health alerts for a service."""
        async with self.lock:
            for alert in self.alerts.values():
                if (alert.source == f"health_{service_name}" and 
                    alert.status == AlertStatus.ACTIVE):
                    alert.status = AlertStatus.RESOLVED
                    alert.resolved_at = datetime.utcnow()
                    alert.updated_at = datetime.utcnow()
                    
                    logger.info(f"Health alert resolved: {alert.title}")

    async def _send_notifications(self, alert: Alert) -> None:
        """Send notifications for an alert."""
        for handler in self.notification_handlers:
            try:
                await asyncio.get_event_loop().run_in_executor(None, handler, alert)
            except Exception as e:
                logger.error(f"Failed to send notification for alert {alert.id}: {e}")

    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert."""
        async with self.lock:
            if alert_id in self.alerts:
                alert = self.alerts[alert_id]
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = datetime.utcnow()
                alert.acknowledged_by = acknowledged_by
                alert.updated_at = datetime.utcnow()
                
                logger.info(f"Alert acknowledged: {alert.title} by {acknowledged_by}")
                return True
        
        return False

    async def resolve_alert(self, alert_id: str) -> bool:
        """Manually resolve an alert."""
        async with self.lock:
            if alert_id in self.alerts:
                alert = self.alerts[alert_id]
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.utcnow()
                alert.updated_at = datetime.utcnow()
                
                logger.info(f"Alert resolved: {alert.title}")
                return True
        
        return False

    async def get_active_alerts(self) -> List[Alert]:
        """Get all active alerts."""
        async with self.lock:
            return [alert for alert in self.alerts.values() if alert.status == AlertStatus.ACTIVE]

    async def get_alerts_by_severity(self, severity: AlertSeverity) -> List[Alert]:
        """Get alerts by severity level."""
        async with self.lock:
            return [alert for alert in self.alerts.values() if alert.severity == severity]

    async def get_alert_history(
        self,
        since: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Alert]:
        """Get alert history."""
        async with self.lock:
            alerts = list(self.alerts.values())
            
            if since:
                alerts = [alert for alert in alerts if alert.created_at >= since]
            
            # Sort by creation time (newest first)
            alerts.sort(key=lambda a: a.created_at, reverse=True)
            
            return alerts[:limit]


class DefaultAlertRules:
    """Default alert rules for common scenarios."""

    @staticmethod
    def create_health_rules() -> List[AlertRule]:
        """Create default health monitoring rules."""
        return [
            AlertRule(
                id="health_database",
                name="Database Health",
                description="Database service is unhealthy",
                condition=lambda status: status.status == "unhealthy",
                severity=AlertSeverity.CRITICAL,
                cooldown_minutes=2
            ),
            AlertRule(
                id="health_datacode",
                name="DataCode Service Health",
                description="DataCode service is unhealthy",
                condition=lambda status: status.status == "unhealthy",
                severity=AlertSeverity.HIGH,
                cooldown_minutes=5
            ),
            AlertRule(
                id="health_memory",
                name="Memory Usage",
                description="Memory usage is critically high",
                condition=lambda status: status.status == "unhealthy",
                severity=AlertSeverity.HIGH,
                cooldown_minutes=10
            ),
            AlertRule(
                id="health_disk",
                name="Disk Usage",
                description="Disk usage is critically high",
                condition=lambda status: status.status == "unhealthy",
                severity=AlertSeverity.HIGH,
                cooldown_minutes=15
            ),
        ]

    @staticmethod
    def create_metric_rules() -> List[AlertRule]:
        """Create default metric monitoring rules."""
        return [
            AlertRule(
                id="metric_http_request_duration_ms_greater_than_5000",
                name="High Response Time",
                description="HTTP request duration is too high",
                condition=lambda x: True,  # Will be checked by metric value
                severity=AlertSeverity.MEDIUM,
                cooldown_minutes=5
            ),
            AlertRule(
                id="metric_http_requests_error_total_greater_than_10",
                name="High Error Rate",
                description="Too many HTTP errors",
                condition=lambda x: True,  # Will be checked by metric value
                severity=AlertSeverity.HIGH,
                cooldown_minutes=2
            ),
        ]


# Global alert manager instance
_alert_manager = AlertManager()


def get_alert_manager() -> AlertManager:
    """Get the global alert manager instance."""
    return _alert_manager


def initialize_default_alerts() -> None:
    """Initialize default alert rules."""
    alert_manager = get_alert_manager()
    
    # Add health rules
    for rule in DefaultAlertRules.create_health_rules():
        alert_manager.add_rule(rule)
    
    # Add metric rules
    for rule in DefaultAlertRules.create_metric_rules():
        alert_manager.add_rule(rule)
    
    logger.info("Default alert rules initialized")
