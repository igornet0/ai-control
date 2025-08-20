import pytest
import json
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from backend.api.routers.code_execution import router


class TestCodeExecutionAPI:
    """Comprehensive tests for code execution API endpoints"""
    
    @pytest.fixture
    def app(self):
        """Create FastAPI app with code execution router"""
        app = FastAPI()
        app.include_router(router)
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)
    
    def test_execute_code_with_direct_code(self, client):
        """Test code execution with direct code"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.send_message = AsyncMock()
            
            payload = {
                "code": "print('Hello, World!')",
                "language": "python"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            
            assert "execution_id" in data
            assert data["status"] == "queued"
            assert "websocket_url" in data
            assert data["websocket_url"].startswith("/ws/code-execution/")
            
            # Verify RabbitMQ message was sent
            mock_rabbit.send_message.assert_called_once()
            call_args = mock_rabbit.send_message.call_args
            assert call_args[0][0] == "code_execution_queue"  # Queue name
            
            message_data = call_args[0][1]
            assert message_data["code"] == "print('Hello, World!')"
            assert message_data["language"] == "python"
            assert message_data["execution_id"] == data["execution_id"]
    
    def test_execute_code_with_tabs(self, client):
        """Test code execution with tabs"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.send_message = AsyncMock()
            
            payload = {
                "tabs": [
                    {"name": "Main", "content": "print('Main tab')"},
                    {"name": "Utils", "content": "def helper(): return 42"}
                ],
                "language": "python"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            
            assert "execution_id" in data
            assert data["status"] == "queued"
            
            # Verify message contains tabs
            call_args = mock_rabbit.send_message.call_args
            message_data = call_args[0][1]
            assert len(message_data["tabs"]) == 2
            assert message_data["tabs"][0]["name"] == "Main"
            assert message_data["tabs"][1]["content"] == "def helper(): return 42"
    
    def test_execute_code_with_custom_execution_id(self, client):
        """Test code execution with custom execution ID"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.send_message = AsyncMock()
            
            custom_id = "custom-exec-123"
            payload = {
                "code": "print('test')",
                "execution_id": custom_id
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["execution_id"] == custom_id
            assert custom_id in data["websocket_url"]
    
    def test_execute_code_no_code_or_tabs(self, client):
        """Test code execution without code or tabs"""
        payload = {"language": "python"}
        
        response = client.post("/api/code-execution/execute", json=payload)
        
        assert response.status_code == 400
        assert "Either 'code' or 'tabs' must be provided" in response.json()["detail"]
    
    def test_execute_code_empty_tabs(self, client):
        """Test code execution with empty tabs"""
        payload = {
            "tabs": [
                {"name": "Empty1", "content": ""},
                {"name": "Empty2", "content": "   "}  # Only whitespace
            ],
            "language": "python"
        }
        
        response = client.post("/api/code-execution/execute", json=payload)
        
        assert response.status_code == 400
        assert "At least one tab must contain code" in response.json()["detail"]
    
    def test_execute_code_mixed_empty_and_content_tabs(self, client):
        """Test code execution with mix of empty and content tabs"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.send_message = AsyncMock()
            
            payload = {
                "tabs": [
                    {"name": "Empty", "content": ""},
                    {"name": "HasContent", "content": "print('Hello')"},
                    {"name": "AlsoEmpty", "content": "   "}
                ],
                "language": "python"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 200
            # Should succeed because at least one tab has content
    
    def test_execute_code_javascript_language(self, client):
        """Test code execution with JavaScript"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.send_message = AsyncMock()
            
            payload = {
                "code": "console.log('Hello from JS');",
                "language": "javascript"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 200
            
            call_args = mock_rabbit.send_message.call_args
            message_data = call_args[0][1]
            assert message_data["language"] == "javascript"
    
    def test_execute_code_with_user_id(self, client):
        """Test code execution with user ID"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.send_message = AsyncMock()
            
            payload = {
                "code": "print('test')",
                "user_id": "user-123"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 200
            
            call_args = mock_rabbit.send_message.call_args
            message_data = call_args[0][1]
            assert message_data["user_id"] == "user-123"
    
    def test_execute_code_rabbitmq_error(self, client):
        """Test code execution when RabbitMQ fails"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.send_message = AsyncMock(side_effect=Exception("RabbitMQ connection failed"))
            
            payload = {"code": "print('test')"}
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 500
            assert "Internal server error" in response.json()["detail"]
    
    def test_get_execution_status(self, client):
        """Test getting execution status"""
        execution_id = "test-status-123"
        
        response = client.get(f"/api/code-execution/status/{execution_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["execution_id"] == execution_id
        assert "websocket_url" in data
        assert execution_id in data["websocket_url"]
    
    def test_health_check_healthy(self, client):
        """Test health check when services are healthy"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_connection = AsyncMock()
            mock_connection.is_closed = False
            mock_rabbit.get_connection = AsyncMock(return_value=mock_connection)
            
            response = client.get("/api/code-execution/health")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["status"] == "healthy"
            assert data["services"]["rabbitmq"] == "healthy"
            assert data["services"]["code_execution"] == "healthy"
            assert "timestamp" in data
    
    def test_health_check_unhealthy_rabbitmq(self, client):
        """Test health check when RabbitMQ is unhealthy"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_connection = AsyncMock()
            mock_connection.is_closed = True
            mock_rabbit.get_connection = AsyncMock(return_value=mock_connection)
            
            response = client.get("/api/code-execution/health")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["services"]["rabbitmq"] == "unhealthy"
    
    def test_health_check_connection_error(self, client):
        """Test health check when connection fails"""
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.get_connection = AsyncMock(side_effect=Exception("Connection failed"))
            
            response = client.get("/api/code-execution/health")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["status"] == "unhealthy"
            assert "Connection failed" in data["error"]
    
    def test_get_supported_languages(self, client):
        """Test getting supported languages"""
        response = client.get("/api/code-execution/supported-languages")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "languages" in data
        languages = data["languages"]
        
        # Should have at least Python and JavaScript
        language_keys = [lang["key"] for lang in languages]
        assert "python" in language_keys
        assert "javascript" in language_keys
        
        # Check structure of language entries
        python_lang = next(lang for lang in languages if lang["key"] == "python")
        assert "name" in python_lang
        assert "description" in python_lang
        assert "file_extension" in python_lang
    
    def test_validate_code_python_valid(self, client):
        """Test code validation with valid Python code"""
        payload = {
            "code": "print('Hello, World!')\nx = 2 + 2",
            "language": "python"
        }
        
        response = client.post("/api/code-execution/validate", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["language"] == "python"
        assert data["validation"]["valid"] is True
        assert len(data["validation"]["errors"]) == 0
        assert data["code_length"] > 0
        assert data["line_count"] >= 2
    
    def test_validate_code_python_syntax_error(self, client):
        """Test code validation with Python syntax error"""
        payload = {
            "code": "print('Hello World'\n# Missing closing parenthesis",
            "language": "python"
        }
        
        response = client.post("/api/code-execution/validate", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["validation"]["valid"] is False
        assert len(data["validation"]["errors"]) > 0
        
        error = data["validation"]["errors"][0]
        assert error["type"] == "SyntaxError"
        assert "message" in error
        assert error.get("line") is not None
    
    def test_validate_code_with_tabs(self, client):
        """Test code validation with tabs"""
        payload = {
            "tabs": [
                {"name": "Main", "content": "print('Main')"},
                {"name": "Utils", "content": "def helper():\n    return 42"}
            ],
            "language": "python"
        }
        
        response = client.post("/api/code-execution/validate", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["validation"]["valid"] is True
        # Should combine both tabs
        assert data["code_length"] > len("print('Main')")
    
    def test_validate_code_no_content(self, client):
        """Test code validation with no content"""
        payload = {"language": "python"}
        
        response = client.post("/api/code-execution/validate", json=payload)
        
        assert response.status_code == 400
        assert "Either 'code' or 'tabs' must be provided" in response.json()["detail"]
    
    def test_validate_code_empty_content(self, client):
        """Test code validation with empty content"""
        payload = {
            "code": "   ",  # Only whitespace
            "language": "python"
        }
        
        response = client.post("/api/code-execution/validate", json=payload)
        
        assert response.status_code == 400
        assert "No code content found to validate" in response.json()["detail"]
    
    def test_validate_code_javascript_language(self, client):
        """Test code validation with JavaScript (should not validate syntax)"""
        payload = {
            "code": "console.log('Hello');",
            "language": "javascript"
        }
        
        response = client.post("/api/code-execution/validate", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # JavaScript validation is not implemented, so should be valid by default
        assert data["validation"]["valid"] is True
