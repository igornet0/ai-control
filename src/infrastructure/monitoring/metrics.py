"""Metrics collection and monitoring service."""

import time
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from src.infrastructure.config.logging import get_logger

logger = get_logger(__name__)


@dataclass
class Metric:
    """Metric data structure."""
    name: str
    value: float
    timestamp: datetime
    labels: Optional[Dict[str, str]] = None
    unit: Optional[str] = None


@dataclass
class MetricSummary:
    """Metric summary statistics."""
    name: str
    count: int
    min: float
    max: float
    avg: float
    sum: float
    last_value: float
    last_updated: datetime


class MetricsCollector:
    """Collects and stores application metrics."""

    def __init__(self, max_metrics_per_name: int = 1000):
        self.metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_metrics_per_name))
        self.summaries: Dict[str, MetricSummary] = {}
        self.lock = asyncio.Lock()

    async def record_metric(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        unit: Optional[str] = None
    ) -> None:
        """Record a metric value."""
        metric = Metric(
            name=name,
            value=value,
            timestamp=datetime.utcnow(),
            labels=labels,
            unit=unit
        )

        async with self.lock:
            self.metrics[name].append(metric)
            self._update_summary(name)

    async def increment_counter(
        self,
        name: str,
        value: float = 1.0,
        labels: Optional[Dict[str, str]] = None
    ) -> None:
        """Increment a counter metric."""
        await self.record_metric(name, value, labels, "count")

    async def record_histogram(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a histogram metric."""
        await self.record_metric(name, value, labels, "histogram")

    async def record_gauge(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a gauge metric."""
        await self.record_metric(name, value, labels, "gauge")

    def _update_summary(self, name: str) -> None:
        """Update metric summary statistics."""
        if name not in self.metrics or not self.metrics[name]:
            return

        values = [metric.value for metric in self.metrics[name]]
        last_metric = self.metrics[name][-1]

        self.summaries[name] = MetricSummary(
            name=name,
            count=len(values),
            min=min(values),
            max=max(values),
            avg=sum(values) / len(values),
            sum=sum(values),
            last_value=last_metric.value,
            last_updated=last_metric.timestamp
        )

    async def get_metrics(
        self,
        name: Optional[str] = None,
        since: Optional[datetime] = None
    ) -> List[Metric]:
        """Get metrics, optionally filtered by name and time."""
        async with self.lock:
            if name:
                metrics = list(self.metrics.get(name, []))
            else:
                metrics = []
                for metric_list in self.metrics.values():
                    metrics.extend(metric_list)

            if since:
                metrics = [m for m in metrics if m.timestamp >= since]

            return sorted(metrics, key=lambda m: m.timestamp)

    async def get_summary(self, name: str) -> Optional[MetricSummary]:
        """Get metric summary."""
        async with self.lock:
            return self.summaries.get(name)

    async def get_all_summaries(self) -> Dict[str, MetricSummary]:
        """Get all metric summaries."""
        async with self.lock:
            return self.summaries.copy()

    async def clear_metrics(self, name: Optional[str] = None) -> None:
        """Clear metrics, optionally for a specific name."""
        async with self.lock:
            if name:
                if name in self.metrics:
                    self.metrics[name].clear()
                if name in self.summaries:
                    del self.summaries[name]
            else:
                self.metrics.clear()
                self.summaries.clear()


class MetricsMiddleware:
    """Middleware for collecting HTTP request metrics."""

    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics = metrics_collector

    @asynccontextmanager
    async def measure_request(self, method: str, path: str):
        """Context manager for measuring request duration."""
        start_time = time.time()
        labels = {"method": method, "path": path}
        
        try:
            yield
            # Record successful request
            duration = (time.time() - start_time) * 1000  # Convert to milliseconds
            await self.metrics.record_histogram("http_request_duration_ms", duration, labels)
            await self.metrics.increment_counter("http_requests_total", labels=labels)
            await self.metrics.increment_counter("http_requests_success_total", labels=labels)
            
        except Exception as e:
            # Record failed request
            duration = (time.time() - start_time) * 1000
            error_labels = {**labels, "error": type(e).__name__}
            await self.metrics.record_histogram("http_request_duration_ms", duration, error_labels)
            await self.metrics.increment_counter("http_requests_total", labels=labels)
            await self.metrics.increment_counter("http_requests_error_total", labels=error_labels)
            raise


class BusinessMetricsCollector:
    """Collects business-specific metrics."""

    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics = metrics_collector

    async def record_user_registration(self, user_role: str) -> None:
        """Record user registration metric."""
        await self.metrics.increment_counter(
            "user_registrations_total",
            labels={"role": user_role}
        )

    async def record_user_login(self, success: bool) -> None:
        """Record user login metric."""
        status = "success" if success else "failure"
        await self.metrics.increment_counter(
            "user_logins_total",
            labels={"status": status}
        )

    async def record_task_creation(self, task_priority: str) -> None:
        """Record task creation metric."""
        await self.metrics.increment_counter(
            "tasks_created_total",
            labels={"priority": task_priority}
        )

    async def record_task_completion(self, task_priority: str, duration_hours: float) -> None:
        """Record task completion metric."""
        await self.metrics.increment_counter(
            "tasks_completed_total",
            labels={"priority": task_priority}
        )
        await self.metrics.record_histogram(
            "task_completion_duration_hours",
            duration_hours,
            labels={"priority": task_priority}
        )

    async def record_dashboard_view(self, dashboard_type: str) -> None:
        """Record dashboard view metric."""
        await self.metrics.increment_counter(
            "dashboard_views_total",
            labels={"type": dashboard_type}
        )

    async def record_kpi_calculation(self, kpi_type: str, calculation_time_ms: float) -> None:
        """Record KPI calculation metric."""
        await self.metrics.increment_counter(
            "kpi_calculations_total",
            labels={"type": kpi_type}
        )
        await self.metrics.record_histogram(
            "kpi_calculation_duration_ms",
            calculation_time_ms,
            labels={"type": kpi_type}
        )

    async def record_datacode_execution(
        self,
        query_type: str,
        execution_time_ms: float,
        success: bool
    ) -> None:
        """Record DataCode execution metric."""
        status = "success" if success else "failure"
        await self.metrics.increment_counter(
            "datacode_executions_total",
            labels={"type": query_type, "status": status}
        )
        await self.metrics.record_histogram(
            "datacode_execution_duration_ms",
            execution_time_ms,
            labels={"type": query_type, "status": status}
        )


# Global metrics collector instance
_metrics_collector = MetricsCollector()
_metrics_middleware = MetricsMiddleware(_metrics_collector)
_business_metrics = BusinessMetricsCollector(_metrics_collector)


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance."""
    return _metrics_collector


def get_metrics_middleware() -> MetricsMiddleware:
    """Get the global metrics middleware instance."""
    return _metrics_middleware


def get_business_metrics() -> BusinessMetricsCollector:
    """Get the global business metrics collector instance."""
    return _business_metrics
