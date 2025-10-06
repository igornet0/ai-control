"""
WebSocket handlers for real-time functionality.
"""

import json
import uuid
from typing import Dict, Any
from fastapi import WebSocket, WebSocketDisconnect, Depends
from fastapi.routing import APIRouter

from src.presentation.websockets.connection_manager import connection_manager
from src.infrastructure.config.logging import get_logger
from src.infrastructure.auth.jwt_service import JWTService
from src.domain.user_management.value_objects.user_id import UserId


class WebSocketHandlers:
    """WebSocket handlers for real-time functionality."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
        self.router = APIRouter()
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup WebSocket routes."""
        
        @self.router.websocket("/ws/notifications/{user_id}")
        async def notifications_websocket(websocket: WebSocket, user_id: str):
            """WebSocket endpoint for user notifications."""
            connection_id = str(uuid.uuid4())
            
            try:
                await connection_manager.connect(websocket, connection_id, user_id)
                
                # Join notification room for the user
                connection_manager.join_room(connection_id, f"notifications:{user_id}")
                
                while True:
                    # Keep connection alive and handle incoming messages
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    # Handle different message types
                    await self._handle_notification_message(websocket, message, user_id)
                    
            except WebSocketDisconnect:
                connection_manager.disconnect(connection_id)
            except Exception as e:
                self.logger.error(
                    "WebSocket error in notifications",
                    extra={
                        "user_id": user_id,
                        "connection_id": connection_id,
                        "error": str(e)
                    }
                )
                connection_manager.disconnect(connection_id)
        
        @self.router.websocket("/ws/chat/{room_id}")
        async def chat_websocket(websocket: WebSocket, room_id: str):
            """WebSocket endpoint for chat rooms."""
            connection_id = str(uuid.uuid4())
            
            try:
                await connection_manager.connect(websocket, connection_id)
                
                # Join chat room
                connection_manager.join_room(connection_id, f"chat:{room_id}")
                
                # Notify others that user joined
                await connection_manager.send_to_room(
                    {
                        "type": "user_joined",
                        "room": room_id,
                        "connection_id": connection_id,
                        "timestamp": str(uuid.uuid4())
                    },
                    f"chat:{room_id}"
                )
                
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    # Handle chat messages
                    await self._handle_chat_message(websocket, message, room_id, connection_id)
                    
            except WebSocketDisconnect:
                # Notify others that user left
                await connection_manager.send_to_room(
                    {
                        "type": "user_left",
                        "room": room_id,
                        "connection_id": connection_id,
                        "timestamp": str(uuid.uuid4())
                    },
                    f"chat:{room_id}"
                )
                connection_manager.disconnect(connection_id)
            except Exception as e:
                self.logger.error(
                    "WebSocket error in chat",
                    extra={
                        "room_id": room_id,
                        "connection_id": connection_id,
                        "error": str(e)
                    }
                )
                connection_manager.disconnect(connection_id)
        
        @self.router.websocket("/ws/dashboard/{dashboard_id}")
        async def dashboard_websocket(websocket: WebSocket, dashboard_id: str):
            """WebSocket endpoint for dashboard updates."""
            connection_id = str(uuid.uuid4())
            
            try:
                await connection_manager.connect(websocket, connection_id)
                
                # Join dashboard room
                connection_manager.join_room(connection_id, f"dashboard:{dashboard_id}")
                
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    # Handle dashboard updates
                    await self._handle_dashboard_message(websocket, message, dashboard_id, connection_id)
                    
            except WebSocketDisconnect:
                connection_manager.disconnect(connection_id)
            except Exception as e:
                self.logger.error(
                    "WebSocket error in dashboard",
                    extra={
                        "dashboard_id": dashboard_id,
                        "connection_id": connection_id,
                        "error": str(e)
                    }
                )
                connection_manager.disconnect(connection_id)
    
    async def _handle_notification_message(self, websocket: WebSocket, message: Dict[str, Any], user_id: str):
        """Handle notification WebSocket messages."""
        message_type = message.get("type")
        
        if message_type == "ping":
            await websocket.send_text(json.dumps({"type": "pong"}))
        elif message_type == "subscribe":
            # Subscribe to specific notification types
            notification_types = message.get("notification_types", [])
            for notification_type in notification_types:
                connection_manager.join_room(
                    websocket.state.get("connection_id", ""),
                    f"notifications:{user_id}:{notification_type}"
                )
        elif message_type == "unsubscribe":
            # Unsubscribe from specific notification types
            notification_types = message.get("notification_types", [])
            for notification_type in notification_types:
                connection_manager.leave_room(
                    websocket.state.get("connection_id", ""),
                    f"notifications:{user_id}:{notification_type}"
                )
    
    async def _handle_chat_message(self, websocket: WebSocket, message: Dict[str, Any], room_id: str, connection_id: str):
        """Handle chat WebSocket messages."""
        message_type = message.get("type")
        
        if message_type == "message":
            # Broadcast message to all users in the room
            chat_message = {
                "type": "message",
                "room": room_id,
                "content": message.get("content", ""),
                "sender": message.get("sender", "anonymous"),
                "timestamp": str(uuid.uuid4()),
                "connection_id": connection_id
            }
            
            await connection_manager.send_to_room(chat_message, f"chat:{room_id}")
        
        elif message_type == "typing":
            # Broadcast typing indicator
            typing_message = {
                "type": "typing",
                "room": room_id,
                "user": message.get("user", "anonymous"),
                "is_typing": message.get("is_typing", False),
                "timestamp": str(uuid.uuid4())
            }
            
            await connection_manager.send_to_room(typing_message, f"chat:{room_id}")
    
    async def _handle_dashboard_message(self, websocket: WebSocket, message: Dict[str, Any], dashboard_id: str, connection_id: str):
        """Handle dashboard WebSocket messages."""
        message_type = message.get("type")
        
        if message_type == "subscribe_widget":
            # Subscribe to specific widget updates
            widget_id = message.get("widget_id")
            if widget_id:
                connection_manager.join_room(
                    connection_id,
                    f"dashboard:{dashboard_id}:widget:{widget_id}"
                )
        
        elif message_type == "unsubscribe_widget":
            # Unsubscribe from specific widget updates
            widget_id = message.get("widget_id")
            if widget_id:
                connection_manager.leave_room(
                    connection_id,
                    f"dashboard:{dashboard_id}:widget:{widget_id}"
                )
        
        elif message_type == "ping":
            await websocket.send_text(json.dumps({"type": "pong"}))


# Global WebSocket handlers instance
websocket_handlers = WebSocketHandlers()
