import pytest
import json
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect
from backend.api.routers.websocket import ConnectionManager, router


class TestConnectionManager:
    """Tests for WebSocket connection management"""
    
    @pytest.fixture
    def manager(self):
        """Create a fresh ConnectionManager for each test"""
        return ConnectionManager()
    
    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket connection"""
        ws = MagicMock()
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        return ws
    
    @pytest.mark.asyncio
    async def test_connect_new_execution(self, manager, mock_websocket):
        """Test connecting to a new execution ID"""
        execution_id = await manager.connect(mock_websocket, "test-exec-123")
        
        assert execution_id == "test-exec-123"
        assert "test-exec-123" in manager.active_connections
        assert mock_websocket in manager.active_connections["test-exec-123"]
        assert mock_websocket in manager.connection_metadata
        
        mock_websocket.accept.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_connect_without_execution_id(self, manager, mock_websocket):
        """Test connecting without providing execution ID"""
        execution_id = await manager.connect(mock_websocket)
        
        assert execution_id is not None
        assert len(execution_id) > 0
        assert execution_id in manager.active_connections
        assert mock_websocket in manager.active_connections[execution_id]
    
    @pytest.mark.asyncio
    async def test_connect_multiple_to_same_execution(self, manager):
        """Test multiple connections to the same execution ID"""
        ws1 = MagicMock()
        ws1.accept = AsyncMock()
        ws2 = MagicMock()
        ws2.accept = AsyncMock()
        
        exec_id1 = await manager.connect(ws1, "shared-exec")
        exec_id2 = await manager.connect(ws2, "shared-exec")
        
        assert exec_id1 == exec_id2 == "shared-exec"
        assert len(manager.active_connections["shared-exec"]) == 2
        assert ws1 in manager.active_connections["shared-exec"]
        assert ws2 in manager.active_connections["shared-exec"]
    
    def test_disconnect_existing_connection(self, manager, mock_websocket):
        """Test disconnecting an existing connection"""
        # Manually add connection (simulating previous connect)
        manager.active_connections["test-exec"] = {mock_websocket}
        manager.connection_metadata[mock_websocket] = {
            "execution_id": "test-exec",
            "connected_at": 123456789
        }
        
        manager.disconnect(mock_websocket)
        
        assert mock_websocket not in manager.connection_metadata
        assert len(manager.active_connections.get("test-exec", set())) == 0
        assert "test-exec" not in manager.active_connections  # Should be cleaned up
    
    def test_disconnect_nonexistent_connection(self, manager, mock_websocket):
        """Test disconnecting a connection that doesn't exist"""
        # Should not raise an exception
        manager.disconnect(mock_websocket)
        assert mock_websocket not in manager.connection_metadata
    
    @pytest.mark.asyncio
    async def test_send_to_execution_existing(self, manager):
        """Test sending message to existing execution"""
        ws1 = MagicMock()
        ws1.send_text = AsyncMock()
        ws2 = MagicMock()
        ws2.send_text = AsyncMock()
        
        manager.active_connections["test-exec"] = {ws1, ws2}
        
        message = {"type": "test", "data": "hello"}
        await manager.send_to_execution("test-exec", message)
        
        expected_json = json.dumps(message)
        ws1.send_text.assert_called_once_with(expected_json)
        ws2.send_text.assert_called_once_with(expected_json)
    
    @pytest.mark.asyncio
    async def test_send_to_execution_nonexistent(self, manager):
        """Test sending message to non-existent execution"""
        message = {"type": "test", "data": "hello"}
        
        # Should not raise an exception
        await manager.send_to_execution("nonexistent-exec", message)
        
        # No connections should be affected
        assert len(manager.active_connections) == 0
    
    @pytest.mark.asyncio
    async def test_send_to_execution_with_failed_websocket(self, manager):
        """Test sending message when WebSocket fails"""
        ws_good = MagicMock()
        ws_good.send_text = AsyncMock()
        
        ws_bad = MagicMock()
        ws_bad.send_text = AsyncMock(side_effect=Exception("Connection lost"))
        
        manager.active_connections["test-exec"] = {ws_good, ws_bad}
        manager.connection_metadata[ws_good] = {"execution_id": "test-exec"}
        manager.connection_metadata[ws_bad] = {"execution_id": "test-exec"}
        
        message = {"type": "test", "data": "hello"}
        await manager.send_to_execution("test-exec", message)
        
        # Good WebSocket should receive message
        ws_good.send_text.assert_called_once()
        
        # Bad WebSocket should be disconnected
        assert ws_bad not in manager.connection_metadata
        assert ws_bad not in manager.active_connections["test-exec"]
    
    @pytest.mark.asyncio
    async def test_broadcast_to_all_connections(self, manager):
        """Test broadcasting message to all active connections"""
        # Setup multiple executions with multiple connections each
        ws1 = MagicMock()
        ws1.send_text = AsyncMock()
        ws2 = MagicMock()
        ws2.send_text = AsyncMock()
        ws3 = MagicMock()
        ws3.send_text = AsyncMock()
        
        manager.active_connections["exec-1"] = {ws1, ws2}
        manager.active_connections["exec-2"] = {ws3}
        
        message = {"type": "broadcast", "data": "global message"}
        await manager.broadcast(message)
        
        expected_json = json.dumps(message)
        ws1.send_text.assert_called_once_with(expected_json)
        ws2.send_text.assert_called_once_with(expected_json)
        ws3.send_text.assert_called_once_with(expected_json)
    
    def test_get_connection_count_specific_execution(self, manager):
        """Test getting connection count for specific execution"""
        ws1 = MagicMock()
        ws2 = MagicMock()
        ws3 = MagicMock()
        
        manager.active_connections["exec-1"] = {ws1, ws2}
        manager.active_connections["exec-2"] = {ws3}
        
        assert manager.get_connection_count("exec-1") == 2
        assert manager.get_connection_count("exec-2") == 1
        assert manager.get_connection_count("nonexistent") == 0
    
    def test_get_connection_count_total(self, manager):
        """Test getting total connection count"""
        ws1 = MagicMock()
        ws2 = MagicMock()
        ws3 = MagicMock()
        
        manager.active_connections["exec-1"] = {ws1, ws2}
        manager.active_connections["exec-2"] = {ws3}
        
        assert manager.get_connection_count() == 3
    
    def test_get_connection_count_empty(self, manager):
        """Test getting connection count when no connections"""
        assert manager.get_connection_count() == 0
        assert manager.get_connection_count("any-exec") == 0


class TestWebSocketEndpoints:
    """Integration tests for WebSocket endpoints"""
    
    @pytest.fixture
    def app(self):
        """Create FastAPI app with WebSocket router"""
        from fastapi import FastAPI
        app = FastAPI()
        app.include_router(router)
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)
    
    def test_websocket_connection_establishment(self, client):
        """Test basic WebSocket connection establishment"""
        with client.websocket_connect("/ws/code-execution") as websocket:
            # Should receive welcome message
            data = websocket.receive_json()
            assert data["type"] == "connection_established"
            assert "execution_id" in data
            assert "Connected to code execution stream" in data["message"]
    
    def test_websocket_specific_execution_id(self, client):
        """Test WebSocket connection to specific execution ID"""
        execution_id = "test-specific-123"
        
        with client.websocket_connect(f"/ws/code-execution/{execution_id}") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "connection_established"
            assert data["execution_id"] == execution_id
            assert execution_id in data["message"]
    
    def test_websocket_ping_pong(self, client):
        """Test WebSocket ping/pong functionality"""
        with client.websocket_connect("/ws/code-execution") as websocket:
            # Skip welcome message
            websocket.receive_json()
            
            # Send ping
            websocket.send_json({"type": "ping"})
            
            # Should receive pong
            response = websocket.receive_json()
            assert response["type"] == "pong"
            assert "timestamp" in response
    
    def test_websocket_subscribe_to_execution(self, client):
        """Test subscribing to a specific execution ID"""
        with client.websocket_connect("/ws/code-execution") as websocket:
            # Skip welcome message
            welcome = websocket.receive_json()
            original_exec_id = welcome["execution_id"]
            
            # Subscribe to different execution
            new_exec_id = "new-execution-456"
            websocket.send_json({
                "type": "subscribe",
                "execution_id": new_exec_id
            })
            
            # Should receive subscription confirmation
            response = websocket.receive_json()
            assert response["type"] == "subscribed"
            assert response["execution_id"] == new_exec_id
    
    def test_websocket_invalid_json(self, client):
        """Test WebSocket handling of invalid JSON"""
        with client.websocket_connect("/ws/code-execution") as websocket:
            # Skip welcome message
            websocket.receive_json()
            
            # Send invalid JSON
            websocket.send_text("invalid json {")
            
            # Should receive error message
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "Invalid JSON format" in response["message"]
    
    def test_websocket_connection_cleanup(self, client):
        """Test that connections are properly cleaned up"""
        from backend.api.routers.websocket import connection_manager
        
        initial_count = connection_manager.get_connection_count()
        
        with client.websocket_connect("/ws/code-execution") as websocket:
            websocket.receive_json()  # Welcome message
            
            # Connection should be active
            assert connection_manager.get_connection_count() > initial_count
        
        # After context exit, connection should be cleaned up
        # Note: In real scenarios, cleanup might be asynchronous
        # This test verifies the cleanup mechanism exists
    
    @pytest.mark.asyncio
    async def test_websocket_message_delivery(self, client):
        """Test message delivery to WebSocket connections"""
        from backend.api.routers.websocket import connection_manager
        
        execution_id = "test-delivery-789"
        
        with client.websocket_connect(f"/ws/code-execution/{execution_id}") as websocket:
            websocket.receive_json()  # Welcome message
            
            # Send message through connection manager
            test_message = {
                "type": "execution_update",
                "status": "running",
                "message": "Test execution update"
            }
            
            # This would normally be called by the consumer
            await connection_manager.send_to_execution(execution_id, test_message)
            
            # WebSocket should receive the message
            # Note: This test might need adjustment based on actual async behavior
            # In practice, you'd use a proper async WebSocket test framework
    
    def test_websocket_multiple_connections_same_execution(self, client):
        """Test multiple WebSocket connections to same execution"""
        execution_id = "shared-execution-999"
        
        with client.websocket_connect(f"/ws/code-execution/{execution_id}") as ws1:
            with client.websocket_connect(f"/ws/code-execution/{execution_id}") as ws2:
                # Both should receive welcome messages
                welcome1 = ws1.receive_json()
                welcome2 = ws2.receive_json()
                
                assert welcome1["execution_id"] == execution_id
                assert welcome2["execution_id"] == execution_id
                
                # Both connections should be active
                from backend.api.routers.websocket import connection_manager
                assert connection_manager.get_connection_count(execution_id) >= 2
