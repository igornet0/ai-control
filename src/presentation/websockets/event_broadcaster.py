"""
Event broadcaster for sending real-time updates via WebSocket.
"""

import uuid
from typing import Dict, Any, Optional
from src.presentation.websockets.connection_manager import connection_manager
from src.infrastructure.config.logging import get_logger


class EventBroadcaster:
    """Broadcasts domain events to WebSocket connections."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
    
    async def broadcast_user_event(self, user_id: str, event_type: str, data: Dict[str, Any]):
        """Broadcast user-related events."""
        message = {
            "type": "user_event",
            "event_type": event_type,
            "user_id": user_id,
            "data": data,
            "timestamp": str(uuid.uuid4())
        }
        
        await connection_manager.send_to_user(message, user_id)
        
        self.logger.info(
            "User event broadcasted",
            extra={
                "user_id": user_id,
                "event_type": event_type,
                "recipients": connection_manager.get_user_connection_count(user_id)
            }
        )
    
    async def broadcast_task_event(self, task_id: str, event_type: str, data: Dict[str, Any], user_ids: Optional[list] = None):
        """Broadcast task-related events."""
        message = {
            "type": "task_event",
            "event_type": event_type,
            "task_id": task_id,
            "data": data,
            "timestamp": str(uuid.uuid4())
        }
        
        if user_ids:
            # Send to specific users
            for user_id in user_ids:
                await connection_manager.send_to_user(message, user_id)
        else:
            # Broadcast to all connections
            await connection_manager.broadcast(message)
        
        self.logger.info(
            "Task event broadcasted",
            extra={
                "task_id": task_id,
                "event_type": event_type,
                "recipients": len(user_ids) if user_ids else connection_manager.get_connection_count()
            }
        )
    
    async def broadcast_dashboard_event(self, dashboard_id: str, event_type: str, data: Dict[str, Any]):
        """Broadcast dashboard-related events."""
        message = {
            "type": "dashboard_event",
            "event_type": event_type,
            "dashboard_id": dashboard_id,
            "data": data,
            "timestamp": str(uuid.uuid4())
        }
        
        await connection_manager.send_to_room(message, f"dashboard:{dashboard_id}")
        
        self.logger.info(
            "Dashboard event broadcasted",
            extra={
                "dashboard_id": dashboard_id,
                "event_type": event_type,
                "recipients": connection_manager.get_room_connection_count(f"dashboard:{dashboard_id}")
            }
        )
    
    async def broadcast_kpi_event(self, kpi_id: str, event_type: str, data: Dict[str, Any], user_ids: Optional[list] = None):
        """Broadcast KPI-related events."""
        message = {
            "type": "kpi_event",
            "event_type": event_type,
            "kpi_id": kpi_id,
            "data": data,
            "timestamp": str(uuid.uuid4())
        }
        
        if user_ids:
            # Send to specific users
            for user_id in user_ids:
                await connection_manager.send_to_user(message, user_id)
        else:
            # Broadcast to all connections
            await connection_manager.broadcast(message)
        
        self.logger.info(
            "KPI event broadcasted",
            extra={
                "kpi_id": kpi_id,
                "event_type": event_type,
                "recipients": len(user_ids) if user_ids else connection_manager.get_connection_count()
            }
        )
    
    async def broadcast_notification(self, user_id: str, notification_type: str, data: Dict[str, Any]):
        """Broadcast notifications to users."""
        message = {
            "type": "notification",
            "notification_type": notification_type,
            "user_id": user_id,
            "data": data,
            "timestamp": str(uuid.uuid4())
        }
        
        # Send to user's notification room
        await connection_manager.send_to_room(message, f"notifications:{user_id}")
        
        # Send to specific notification type room
        await connection_manager.send_to_room(message, f"notifications:{user_id}:{notification_type}")
        
        self.logger.info(
            "Notification broadcasted",
            extra={
                "user_id": user_id,
                "notification_type": notification_type,
                "recipients": connection_manager.get_user_connection_count(user_id)
            }
        )
    
    async def broadcast_system_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast system-wide events."""
        message = {
            "type": "system_event",
            "event_type": event_type,
            "data": data,
            "timestamp": str(uuid.uuid4())
        }
        
        await connection_manager.broadcast(message)
        
        self.logger.info(
            "System event broadcasted",
            extra={
                "event_type": event_type,
                "recipients": connection_manager.get_connection_count()
            }
        )


# Global event broadcaster instance
event_broadcaster = EventBroadcaster()
