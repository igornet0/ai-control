"""Webhook endpoints for external service integrations."""

from typing import Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.infrastructure.config.logging import get_logger
from src.infrastructure.monitoring.alerts import get_alert_manager, AlertManager, AlertSeverity, AlertStatus

logger = get_logger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class AlertManagerAlert(BaseModel):
    """AlertManager alert model."""
    status: str
    labels: Dict[str, str]
    annotations: Dict[str, str]
    startsAt: str
    endsAt: str
    generatorURL: str


class AlertManagerWebhook(BaseModel):
    """AlertManager webhook payload."""
    receiver: str
    status: str
    alerts: List[AlertManagerAlert]
    groupLabels: Dict[str, str]
    commonLabels: Dict[str, str]
    commonAnnotations: Dict[str, str]
    externalURL: str
    version: str
    groupKey: str


@router.post("/alertmanager")
async def alertmanager_webhook(
    payload: AlertManagerWebhook,
    request: Request
) -> Dict[str, str]:
    """Receive alerts from AlertManager."""
    try:
        logger.info(f"Received AlertManager webhook: {payload.status} with {len(payload.alerts)} alerts")
        
        alert_manager = get_alert_manager()
        
        for alert in payload.alerts:
            # Convert AlertManager alert to internal alert format
            severity = _map_alertmanager_severity(alert.labels.get("severity", "warning"))
            status = _map_alertmanager_status(alert.status)
            
            # Create internal alert
            internal_alert = {
                "id": f"prometheus_{alert.labels.get('alertname', 'unknown')}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                "title": alert.annotations.get("summary", alert.labels.get("alertname", "Unknown Alert")),
                "description": alert.annotations.get("description", "No description available"),
                "severity": severity,
                "status": status,
                "source": "prometheus",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "metadata": {
                    "prometheus_alert": {
                        "labels": alert.labels,
                        "annotations": alert.annotations,
                        "starts_at": alert.startsAt,
                        "ends_at": alert.endsAt,
                        "generator_url": alert.generatorURL
                    },
                    "webhook_payload": {
                        "receiver": payload.receiver,
                        "group_labels": payload.groupLabels,
                        "common_labels": payload.commonLabels,
                        "external_url": payload.externalURL
                    }
                }
            }
            
            # Log the alert
            if status == AlertStatus.ACTIVE:
                logger.warning(f"Prometheus alert active: {internal_alert['title']} - {internal_alert['description']}")
            else:
                logger.info(f"Prometheus alert resolved: {internal_alert['title']}")
        
        return {"status": "success", "message": f"Processed {len(payload.alerts)} alerts"}
        
    except Exception as e:
        logger.error(f"Failed to process AlertManager webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process webhook: {str(e)}")


@router.post("/github")
async def github_webhook(
    request: Request
) -> Dict[str, str]:
    """Receive webhooks from GitHub."""
    try:
        payload = await request.json()
        event_type = request.headers.get("X-GitHub-Event")
        
        logger.info(f"Received GitHub webhook: {event_type}")
        
        # Process different GitHub events
        if event_type == "push":
            await _process_github_push(payload)
        elif event_type == "pull_request":
            await _process_github_pull_request(payload)
        elif event_type == "issues":
            await _process_github_issue(payload)
        else:
            logger.info(f"Unhandled GitHub event type: {event_type}")
        
        return {"status": "success", "message": f"Processed GitHub {event_type} event"}
        
    except Exception as e:
        logger.error(f"Failed to process GitHub webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process webhook: {str(e)}")


@router.post("/slack")
async def slack_webhook(
    request: Request
) -> Dict[str, str]:
    """Receive webhooks from Slack."""
    try:
        payload = await request.json()
        
        logger.info("Received Slack webhook")
        
        # Process Slack webhook payload
        # This could be used for interactive components, slash commands, etc.
        
        return {"status": "success", "message": "Processed Slack webhook"}
        
    except Exception as e:
        logger.error(f"Failed to process Slack webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process webhook: {str(e)}")


def _map_alertmanager_severity(severity: str) -> AlertSeverity:
    """Map AlertManager severity to internal severity."""
    mapping = {
        "critical": AlertSeverity.CRITICAL,
        "warning": AlertSeverity.HIGH,
        "info": AlertSeverity.MEDIUM,
        "low": AlertSeverity.LOW,
    }
    return mapping.get(severity.lower(), AlertSeverity.MEDIUM)


def _map_alertmanager_status(status: str) -> AlertStatus:
    """Map AlertManager status to internal status."""
    if status == "firing":
        return AlertStatus.ACTIVE
    elif status == "resolved":
        return AlertStatus.RESOLVED
    else:
        return AlertStatus.ACTIVE


async def _process_github_push(payload: Dict[str, Any]) -> None:
    """Process GitHub push event."""
    repository = payload.get("repository", {})
    commits = payload.get("commits", [])
    
    logger.info(f"GitHub push to {repository.get('name')}: {len(commits)} commits")
    
    # Could trigger deployments, tests, etc.
    # For now, just log the event


async def _process_github_pull_request(payload: Dict[str, Any]) -> None:
    """Process GitHub pull request event."""
    pull_request = payload.get("pull_request", {})
    action = payload.get("action")
    
    logger.info(f"GitHub PR {action}: {pull_request.get('title')}")
    
    # Could trigger code reviews, tests, etc.
    # For now, just log the event


async def _process_github_issue(payload: Dict[str, Any]) -> None:
    """Process GitHub issue event."""
    issue = payload.get("issue", {})
    action = payload.get("action")
    
    logger.info(f"GitHub issue {action}: {issue.get('title')}")
    
    # Could create tasks, send notifications, etc.
    # For now, just log the event
