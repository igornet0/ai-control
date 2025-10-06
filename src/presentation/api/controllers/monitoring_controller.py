"""Monitoring API endpoints for health checks, metrics, and alerts."""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from src.infrastructure.monitoring.health_check import HealthCheckService, get_health_check_service
from src.infrastructure.monitoring.metrics import get_metrics_collector, MetricsCollector
from src.infrastructure.monitoring.alerts import get_alert_manager, AlertManager, AlertSeverity
from src.presentation.api.dependencies import get_current_user_id

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
async def health_check(
    service: Optional[str] = Query(None, description="Specific service to check"),
    health_service: HealthCheckService = Depends(get_health_check_service)
) -> Dict[str, Any]:
    """Get system health status."""
    try:
        if service:
            # Check specific service
            status = await health_service.check_service(service)
            return {
                "service": service,
                "status": status.status,
                "message": status.message,
                "response_time_ms": status.response_time_ms,
                "last_check": status.last_check.isoformat() if status.last_check else None,
                "details": status.details
            }
        else:
            # Check all services
            results = await health_service.check_all()
            summary = health_service.get_summary(results)
            return summary
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@router.get("/health/live")
async def liveness_probe() -> Dict[str, str]:
    """Kubernetes liveness probe endpoint."""
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}


@router.get("/health/ready")
async def readiness_probe(
    health_service: HealthCheckService = Depends(get_health_check_service)
) -> Dict[str, Any]:
    """Kubernetes readiness probe endpoint."""
    try:
        # Check critical services only
        critical_services = ["database"]
        results = {}
        
        for service in critical_services:
            status = await health_service.check_service(service)
            results[service] = status.status
        
        # Determine overall readiness
        all_healthy = all(status == "healthy" for status in results.values())
        
        if all_healthy:
            return {
                "status": "ready",
                "timestamp": datetime.utcnow().isoformat(),
                "services": results
            }
        else:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "timestamp": datetime.utcnow().isoformat(),
                    "services": results
                }
            )
            
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }
        )


@router.get("/metrics")
async def get_metrics(
    name: Optional[str] = Query(None, description="Specific metric name"),
    since: Optional[datetime] = Query(None, description="Get metrics since this time"),
    metrics_collector: MetricsCollector = Depends(get_metrics_collector)
) -> Dict[str, Any]:
    """Get application metrics."""
    try:
        if name:
            # Get specific metric
            metrics = await metrics_collector.get_metrics(name, since)
            summary = await metrics_collector.get_summary(name)
            
            return {
                "metric_name": name,
                "summary": summary.__dict__ if summary else None,
                "data_points": [
                    {
                        "value": metric.value,
                        "timestamp": metric.timestamp.isoformat(),
                        "labels": metric.labels,
                        "unit": metric.unit
                    }
                    for metric in metrics
                ]
            }
        else:
            # Get all metric summaries
            summaries = await metrics_collector.get_all_summaries()
            
            return {
                "metrics": {
                    name: summary.__dict__
                    for name, summary in summaries.items()
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")


@router.get("/metrics/prometheus")
async def prometheus_metrics(
    metrics_collector: MetricsCollector = Depends(get_metrics_collector)
) -> str:
    """Get metrics in Prometheus format."""
    try:
        summaries = await metrics_collector.get_all_summaries()
        
        prometheus_lines = []
        
        for name, summary in summaries.items():
            # Add metric summary
            prometheus_lines.append(f"# HELP {name} {name}")
            prometheus_lines.append(f"# TYPE {name} gauge")
            prometheus_lines.append(f"{name} {summary.last_value}")
            
            # Add derived metrics
            prometheus_lines.append(f"{name}_count {summary.count}")
            prometheus_lines.append(f"{name}_sum {summary.sum}")
            prometheus_lines.append(f"{name}_min {summary.min}")
            prometheus_lines.append(f"{name}_max {summary.max}")
            prometheus_lines.append(f"{name}_avg {summary.avg}")
        
        return "\n".join(prometheus_lines)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get Prometheus metrics: {str(e)}")


@router.get("/alerts")
async def get_alerts(
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    active_only: bool = Query(True, description="Show only active alerts"),
    limit: int = Query(100, description="Maximum number of alerts to return"),
    alert_manager: AlertManager = Depends(get_alert_manager)
) -> Dict[str, Any]:
    """Get system alerts."""
    try:
        if active_only:
            alerts = await alert_manager.get_active_alerts()
        else:
            since = datetime.utcnow() - timedelta(days=7)  # Last 7 days
            alerts = await alert_manager.get_alert_history(since, limit)
        
        if severity:
            alerts = [alert for alert in alerts if alert.severity == severity]
        
        return {
            "alerts": [
                {
                    "id": alert.id,
                    "title": alert.title,
                    "description": alert.description,
                    "severity": alert.severity.value,
                    "status": alert.status.value,
                    "source": alert.source,
                    "created_at": alert.created_at.isoformat(),
                    "updated_at": alert.updated_at.isoformat(),
                    "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
                    "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                    "acknowledged_by": alert.acknowledged_by,
                    "metadata": alert.metadata
                }
                for alert in alerts
            ],
            "total": len(alerts),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    current_user_id: str = Depends(get_current_user_id),
    alert_manager: AlertManager = Depends(get_alert_manager)
) -> Dict[str, str]:
    """Acknowledge an alert."""
    try:
        success = await alert_manager.acknowledge_alert(alert_id, current_user_id)
        
        if success:
            return {"message": "Alert acknowledged successfully"}
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to acknowledge alert: {str(e)}")


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user_id: str = Depends(get_current_user_id),
    alert_manager: AlertManager = Depends(get_alert_manager)
) -> Dict[str, str]:
    """Manually resolve an alert."""
    try:
        success = await alert_manager.resolve_alert(alert_id)
        
        if success:
            return {"message": "Alert resolved successfully"}
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}")


@router.get("/dashboard")
async def monitoring_dashboard(
    health_service: HealthCheckService = Depends(get_health_check_service),
    metrics_collector: MetricsCollector = Depends(get_metrics_collector),
    alert_manager: AlertManager = Depends(get_alert_manager)
) -> Dict[str, Any]:
    """Get comprehensive monitoring dashboard data."""
    try:
        # Get health status
        health_results = await health_service.check_all()
        health_summary = health_service.get_summary(health_results)
        
        # Get metrics summaries
        metrics_summaries = await metrics_collector.get_all_summaries()
        
        # Get active alerts
        active_alerts = await alert_manager.get_active_alerts()
        
        # Get critical alerts
        critical_alerts = await alert_manager.get_alerts_by_severity(AlertSeverity.CRITICAL)
        
        return {
            "health": health_summary,
            "metrics": {
                name: summary.__dict__
                for name, summary in metrics_summaries.items()
            },
            "alerts": {
                "active": len(active_alerts),
                "critical": len(critical_alerts),
                "recent": [
                    {
                        "id": alert.id,
                        "title": alert.title,
                        "severity": alert.severity.value,
                        "created_at": alert.created_at.isoformat()
                    }
                    for alert in active_alerts[:5]  # Last 5 active alerts
                ]
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard data: {str(e)}")


@router.delete("/metrics")
async def clear_metrics(
    name: Optional[str] = Query(None, description="Specific metric name to clear"),
    current_user_id: str = Depends(get_current_user_id),
    metrics_collector: MetricsCollector = Depends(get_metrics_collector)
) -> Dict[str, str]:
    """Clear metrics data (admin only)."""
    try:
        await metrics_collector.clear_metrics(name)
        
        if name:
            return {"message": f"Metrics cleared for {name}"}
        else:
            return {"message": "All metrics cleared"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear metrics: {str(e)}")
