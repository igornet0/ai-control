"""
WebSocket connection manager for handling real-time connections.
"""

import json
from typing import Dict, List, Set
from fastapi import WebSocket
from src.infrastructure.config.logging import get_logger


class ConnectionManager:
    """Manages WebSocket connections and broadcasting."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, Set[str]] = {}  # user_id -> set of connection_ids
        self.room_connections: Dict[str, Set[str]] = {}  # room -> set of connection_ids
        self.logger = get_logger(__name__)
    
    async def connect(self, websocket: WebSocket, connection_id: str, user_id: str = None):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)
        
        self.logger.info(
            "WebSocket connection established",
            extra={
                "connection_id": connection_id,
                "user_id": user_id,
                "total_connections": len(self.active_connections)
            }
        )
    
    def disconnect(self, connection_id: str):
        """Remove a WebSocket connection."""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Remove from user connections
        for user_id, connections in self.user_connections.items():
            connections.discard(connection_id)
            if not connections:
                del self.user_connections[user_id]
        
        # Remove from room connections
        for room, connections in self.room_connections.items():
            connections.discard(connection_id)
            if not connections:
                del self.room_connections[room]
        
        self.logger.info(
            "WebSocket connection closed",
            extra={
                "connection_id": connection_id,
                "total_connections": len(self.active_connections)
            }
        )
    
    async def send_personal_message(self, message: dict, connection_id: str):
        """Send a message to a specific connection."""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                self.logger.error(
                    "Failed to send personal message",
                    extra={
                        "connection_id": connection_id,
                        "error": str(e)
                    }
                )
                self.disconnect(connection_id)
    
    async def send_to_user(self, message: dict, user_id: str):
        """Send a message to all connections of a specific user."""
        if user_id in self.user_connections:
            for connection_id in self.user_connections[user_id].copy():
                await self.send_personal_message(message, connection_id)
    
    async def send_to_room(self, message: dict, room: str):
        """Send a message to all connections in a room."""
        if room in self.room_connections:
            for connection_id in self.room_connections[room].copy():
                await self.send_personal_message(message, connection_id)
    
    async def broadcast(self, message: dict):
        """Broadcast a message to all active connections."""
        for connection_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, connection_id)
    
    def join_room(self, connection_id: str, room: str):
        """Add a connection to a room."""
        if room not in self.room_connections:
            self.room_connections[room] = set()
        self.room_connections[room].add(connection_id)
        
        self.logger.info(
            "Connection joined room",
            extra={
                "connection_id": connection_id,
                "room": room
            }
        )
    
    def leave_room(self, connection_id: str, room: str):
        """Remove a connection from a room."""
        if room in self.room_connections:
            self.room_connections[room].discard(connection_id)
            if not self.room_connections[room]:
                del self.room_connections[room]
        
        self.logger.info(
            "Connection left room",
            extra={
                "connection_id": connection_id,
                "room": room
            }
        )
    
    def get_connection_count(self) -> int:
        """Get the total number of active connections."""
        return len(self.active_connections)
    
    def get_user_connection_count(self, user_id: str) -> int:
        """Get the number of connections for a specific user."""
        return len(self.user_connections.get(user_id, set()))
    
    def get_room_connection_count(self, room: str) -> int:
        """Get the number of connections in a specific room."""
        return len(self.room_connections.get(room, set()))


# Global connection manager instance
connection_manager = ConnectionManager()
