from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import logging
import asyncio
from uuid import uuid4

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    """Manages WebSocket connections for real-time communication"""
    
    def __init__(self):
        # Store active connections by execution_id
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store connection metadata
        self.connection_metadata: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket, execution_id: str = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        if not execution_id:
            execution_id = str(uuid4())
            
        if execution_id not in self.active_connections:
            self.active_connections[execution_id] = set()
            
        self.active_connections[execution_id].add(websocket)
        self.connection_metadata[websocket] = {
            "execution_id": execution_id,
            "connected_at": asyncio.get_event_loop().time()
        }
        
        logger.info(f"WebSocket connected for execution_id: {execution_id}")
        return execution_id
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.connection_metadata:
            execution_id = self.connection_metadata[websocket]["execution_id"]
            
            # Remove from active connections
            if execution_id in self.active_connections:
                self.active_connections[execution_id].discard(websocket)
                
                # Clean up empty execution_id entries
                if not self.active_connections[execution_id]:
                    del self.active_connections[execution_id]
            
            # Remove metadata
            del self.connection_metadata[websocket]
            
            logger.info(f"WebSocket disconnected for execution_id: {execution_id}")
    
    async def send_to_execution(self, execution_id: str, message: dict):
        """Send message to all connections for a specific execution_id"""
        if execution_id in self.active_connections:
            disconnected = []
            
            for websocket in self.active_connections[execution_id].copy():
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending message to WebSocket: {e}")
                    disconnected.append(websocket)
            
            # Clean up disconnected websockets
            for websocket in disconnected:
                self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all active connections"""
        for execution_id in list(self.active_connections.keys()):
            await self.send_to_execution(execution_id, message)
    
    def get_connection_count(self, execution_id: str = None) -> int:
        """Get number of active connections"""
        if execution_id:
            return len(self.active_connections.get(execution_id, set()))
        return sum(len(connections) for connections in self.active_connections.values())

# Global connection manager instance
connection_manager = ConnectionManager()

@router.websocket("/ws/code-execution")
async def websocket_code_execution(websocket: WebSocket):
    """WebSocket endpoint for real-time code execution updates"""
    execution_id = None
    
    try:
        # Accept connection
        execution_id = await connection_manager.connect(websocket)
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "execution_id": execution_id,
            "message": "Connected to code execution stream"
        }))
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": asyncio.get_event_loop().time()
                    }))
                elif message.get("type") == "subscribe":
                    # Client wants to subscribe to a specific execution_id
                    new_execution_id = message.get("execution_id")
                    if new_execution_id:
                        # Remove from current execution_id
                        connection_manager.disconnect(websocket)
                        # Add to new execution_id
                        await connection_manager.connect(websocket, new_execution_id)
                        await websocket.send_text(json.dumps({
                            "type": "subscribed",
                            "execution_id": new_execution_id,
                            "message": f"Subscribed to execution {new_execution_id}"
                        }))
                
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Internal server error"
                }))
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket:
            connection_manager.disconnect(websocket)

@router.websocket("/ws/code-execution/{execution_id}")
async def websocket_code_execution_specific(websocket: WebSocket, execution_id: str):
    """WebSocket endpoint for a specific execution ID"""
    
    try:
        # Accept connection for specific execution_id
        await connection_manager.connect(websocket, execution_id)
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "execution_id": execution_id,
            "message": f"Connected to execution stream {execution_id}"
        }))
        
        # Keep connection alive
        while True:
            try:
                # Wait for messages from client (mainly for keepalive)
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "execution_id": execution_id,
                        "timestamp": asyncio.get_event_loop().time()
                    }))
                    
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "execution_id": execution_id,
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for execution {execution_id}")
    except Exception as e:
        logger.error(f"WebSocket error for execution {execution_id}: {e}")
    finally:
        connection_manager.disconnect(websocket)

# Export connection manager for use in other modules
__all__ = ["router", "connection_manager"]
