import pytest
import asyncio
import json
import time
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from backend.api.routers.code_execution import router as code_router
from backend.api.routers.websocket import router as ws_router
from backend.api.services.rabbitmq_consumer import CodeExecutionConsumer
from backend.api.services.code_execution_service import CodeExecutionService


class TestEndToEndIntegration:
    """End-to-end integration tests for the complete code execution pipeline"""
    
    @pytest.fixture
    def app(self):
        """Create complete FastAPI app with all routers"""
        app = FastAPI()
        app.include_router(code_router)
        app.include_router(ws_router)
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def consumer(self):
        """Create RabbitMQ consumer for testing"""
        return CodeExecutionConsumer()
    
    @pytest.fixture
    def execution_service(self):
        """Create code execution service for testing"""
        return CodeExecutionService()
    
    @pytest.mark.asyncio
    async def test_complete_python_execution_pipeline(self, client, consumer):
        """Test complete pipeline: API -> RabbitMQ -> Execution -> WebSocket"""
        
        # Mock RabbitMQ to capture and process messages directly
        captured_messages = []
        
        async def mock_send_message(queue, message):
            captured_messages.append((queue, message))
            # Simulate immediate processing
            await consumer.process_code_execution_request(message)
        
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit, \
             patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_exec_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_conn_manager:
            
            mock_rabbit.send_message = mock_send_message
            mock_conn_manager.send_to_execution = AsyncMock()
            
            # Mock execution service to return predictable results
            execution_results = [
                {"status": "starting", "execution_id": None, "message": "Starting execution"},
                {"status": "compiling", "execution_id": None, "message": "Compiling code"},
                {"status": "compilation_success", "execution_id": None, "message": "Compilation successful"},
                {"status": "executing", "execution_id": None, "message": "Executing code"},
                {"status": "output", "execution_id": None, "content": "Hello, World!", "stream": "stdout"},
                {"status": "completed", "execution_id": None, "return_code": 0, "message": "Execution completed"}
            ]
            
            async def mock_execute_code(code, language, execution_id):
                for result in execution_results:
                    result["execution_id"] = execution_id
                    yield result
            
            mock_exec_service.execute_code = mock_execute_code
            
            # Step 1: Submit code execution request
            payload = {
                "code": "print('Hello, World!')",
                "language": "python"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            execution_id = data["execution_id"]
            
            # Step 2: Verify message was captured and processed
            assert len(captured_messages) == 1
            queue, message = captured_messages[0]
            assert queue == "code_execution_queue"
            assert message["execution_id"] == execution_id
            assert message["code"] == "print('Hello, World!')"
            
            # Step 3: Verify WebSocket messages were sent
            websocket_calls = mock_conn_manager.send_to_execution.call_args_list
            assert len(websocket_calls) >= 6  # Start + execution results + finish
            
            # Verify execution started message
            start_call = next(call for call in websocket_calls 
                            if call[0][1].get('type') == 'execution_started')
            assert start_call[0][0] == execution_id  # First arg is execution_id
            
            # Verify execution updates were sent
            update_calls = [call for call in websocket_calls 
                          if call[0][1].get('type') == 'execution_update']
            assert len(update_calls) >= len(execution_results)
            
            # Verify output was captured
            output_updates = [call for call in update_calls 
                            if call[0][1].get('status') == 'output']
            assert len(output_updates) > 0
            assert any("Hello, World!" in call[0][1].get('content', '') 
                      for call in output_updates)
    
    @pytest.mark.asyncio
    async def test_complete_javascript_execution_pipeline(self, client, consumer):
        """Test complete pipeline with JavaScript code"""
        
        captured_messages = []
        
        async def mock_send_message(queue, message):
            captured_messages.append((queue, message))
            await consumer.process_code_execution_request(message)
        
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit, \
             patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_exec_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_conn_manager:
            
            mock_rabbit.send_message = mock_send_message
            mock_conn_manager.send_to_execution = AsyncMock()
            
            execution_results = [
                {"status": "executing", "execution_id": None, "message": "Executing JavaScript"},
                {"status": "output", "execution_id": None, "content": "Hello from JS!", "stream": "stdout"},
                {"status": "completed", "execution_id": None, "return_code": 0}
            ]
            
            async def mock_execute_code(code, language, execution_id):
                assert language == "javascript"
                for result in execution_results:
                    result["execution_id"] = execution_id
                    yield result
            
            mock_exec_service.execute_code = mock_execute_code
            
            payload = {
                "code": "console.log('Hello from JS!');",
                "language": "javascript"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            assert response.status_code == 200
            
            # Verify JavaScript execution was processed
            assert len(captured_messages) == 1
            message = captured_messages[0][1]
            assert message["language"] == "javascript"
    
    @pytest.mark.asyncio
    async def test_multi_tab_execution_pipeline(self, client, consumer):
        """Test pipeline with multiple tabs"""
        
        captured_messages = []
        
        async def mock_send_message(queue, message):
            captured_messages.append((queue, message))
            await consumer.process_code_execution_request(message)
        
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit, \
             patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_exec_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_conn_manager:
            
            mock_rabbit.send_message = mock_send_message
            mock_conn_manager.send_to_execution = AsyncMock()
            
            # Capture the combined code for verification
            combined_code_captured = None
            
            async def mock_execute_code(code, language, execution_id):
                nonlocal combined_code_captured
                combined_code_captured = code
                yield {"status": "completed", "execution_id": execution_id, "return_code": 0}
            
            mock_exec_service.execute_code = mock_execute_code
            
            payload = {
                "tabs": [
                    {"name": "Main", "content": "print('Main execution')"},
                    {"name": "Utils", "content": "def helper():\n    return 'helper result'"},
                    {"name": "Config", "content": "CONFIG = {'debug': True}"}
                ],
                "language": "python"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            assert response.status_code == 200
            
            # Verify tabs were combined correctly
            assert combined_code_captured is not None
            assert "# === Main ===" in combined_code_captured
            assert "# === Utils ===" in combined_code_captured
            assert "# === Config ===" in combined_code_captured
            assert "print('Main execution')" in combined_code_captured
            assert "def helper():" in combined_code_captured
            assert "CONFIG = {'debug': True}" in combined_code_captured
    
    @pytest.mark.asyncio
    async def test_error_handling_pipeline(self, client, consumer):
        """Test error handling throughout the pipeline"""
        
        captured_messages = []
        
        async def mock_send_message(queue, message):
            captured_messages.append((queue, message))
            await consumer.process_code_execution_request(message)
        
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit, \
             patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_exec_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_conn_manager:
            
            mock_rabbit.send_message = mock_send_message
            mock_conn_manager.send_to_execution = AsyncMock()
            
            # Mock execution service to raise an error
            async def mock_execute_code(code, language, execution_id):
                raise Exception("Simulated execution error")
                yield  # Never reached
            
            mock_exec_service.execute_code = mock_execute_code
            
            payload = {
                "code": "print('This will fail')",
                "language": "python"
            }
            
            response = client.post("/api/code-execution/execute", json=payload)
            assert response.status_code == 200  # API call succeeds
            
            # Verify error was sent to WebSocket
            error_calls = [call for call in mock_conn_manager.send_to_execution.call_args_list
                          if call[0][1].get('type') == 'execution_error']
            assert len(error_calls) > 0
            
            error_message = error_calls[0][0][1]
            assert "Simulated execution error" in error_message['error']
    
    @pytest.mark.asyncio
    async def test_websocket_integration_with_execution(self, client):
        """Test WebSocket integration with code execution"""
        
        from backend.api.routers.websocket import connection_manager
        
        execution_id = "integration-test-123"
        
        # Test WebSocket connection
        with client.websocket_connect(f"/ws/code-execution/{execution_id}") as websocket:
            # Receive welcome message
            welcome = websocket.receive_json()
            assert welcome["type"] == "connection_established"
            assert welcome["execution_id"] == execution_id
            
            # Simulate sending execution updates through connection manager
            test_messages = [
                {"type": "execution_update", "status": "starting", "message": "Starting"},
                {"type": "execution_update", "status": "output", "content": "Test output"},
                {"type": "execution_finished", "message": "Completed"}
            ]
            
            # Send messages through connection manager
            for message in test_messages:
                await connection_manager.send_to_execution(execution_id, message)
            
            # Note: In a real test environment, you'd need proper async WebSocket testing
            # This demonstrates the integration pattern
    
    @pytest.mark.asyncio
    async def test_concurrent_executions_pipeline(self, client, consumer):
        """Test handling multiple concurrent executions"""
        
        captured_messages = []
        
        async def mock_send_message(queue, message):
            captured_messages.append((queue, message))
            # Process each message
            await consumer.process_code_execution_request(message)
        
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit, \
             patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_exec_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_conn_manager:
            
            mock_rabbit.send_message = mock_send_message
            mock_conn_manager.send_to_execution = AsyncMock()
            
            async def mock_execute_code(code, language, execution_id):
                # Simulate some processing time
                await asyncio.sleep(0.1)
                yield {"status": "completed", "execution_id": execution_id, "return_code": 0}
            
            mock_exec_service.execute_code = mock_execute_code
            
            # Submit multiple concurrent requests
            payloads = [
                {"code": "print('Execution 1')", "language": "python"},
                {"code": "print('Execution 2')", "language": "python"},
                {"code": "console.log('Execution 3');", "language": "javascript"}
            ]
            
            responses = []
            for payload in payloads:
                response = client.post("/api/code-execution/execute", json=payload)
                responses.append(response)
            
            # All requests should succeed
            assert all(r.status_code == 200 for r in responses)
            
            # Should have unique execution IDs
            execution_ids = [r.json()["execution_id"] for r in responses]
            assert len(set(execution_ids)) == 3
            
            # All messages should be processed
            assert len(captured_messages) == 3
    
    def test_api_validation_integration(self, client):
        """Test API validation integration"""
        
        # Test various validation scenarios
        test_cases = [
            # Valid cases
            ({"code": "print('valid')"}, 200),
            ({"tabs": [{"name": "Test", "content": "print('valid')"}]}, 200),
            
            # Invalid cases
            ({}, 400),  # No code or tabs
            ({"tabs": []}, 400),  # Empty tabs
            ({"tabs": [{"name": "Empty", "content": ""}]}, 400),  # Only empty tabs
        ]
        
        for payload, expected_status in test_cases:
            if expected_status == 200:
                with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
                    mock_rabbit.send_message = AsyncMock()
                    response = client.post("/api/code-execution/execute", json=payload)
            else:
                response = client.post("/api/code-execution/execute", json=payload)
            
            assert response.status_code == expected_status
    
    @pytest.mark.asyncio
    async def test_service_health_integration(self, client):
        """Test service health check integration"""
        
        # Test healthy state
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_connection = AsyncMock()
            mock_connection.is_closed = False
            mock_rabbit.get_connection = AsyncMock(return_value=mock_connection)
            
            response = client.get("/api/code-execution/health")
            assert response.status_code == 200
            
            data = response.json()
            assert data["status"] == "healthy"
            assert data["services"]["rabbitmq"] == "healthy"
        
        # Test unhealthy state
        with patch('backend.api.routers.code_execution.rabbit') as mock_rabbit:
            mock_rabbit.get_connection = AsyncMock(side_effect=Exception("Connection failed"))
            
            response = client.get("/api/code-execution/health")
            assert response.status_code == 200
            
            data = response.json()
            assert data["status"] == "unhealthy"


class TestDockerDeployment:
    """Tests for Docker deployment and service orchestration"""

    def test_docker_compose_configuration(self):
        """Test docker-compose.yml configuration"""
        import yaml

        with open('docker-compose.yml', 'r') as f:
            compose_config = yaml.safe_load(f)

        # Verify required services are defined
        required_services = ['postgres', 'rabbitmq', 'backend', 'frontend', 'redis']
        assert 'services' in compose_config

        for service in required_services:
            assert service in compose_config['services'], f"Service {service} not found in docker-compose.yml"

        # Verify backend service configuration
        backend_service = compose_config['services']['backend']
        assert 'build' in backend_service
        assert 'ports' in backend_service
        assert '8000:8000' in backend_service['ports']
        assert 'depends_on' in backend_service
        assert 'postgres' in backend_service['depends_on']
        assert 'rabbitmq' in backend_service['depends_on']

        # Verify frontend service configuration
        frontend_service = compose_config['services']['frontend']
        assert 'build' in frontend_service
        assert 'ports' in frontend_service
        assert '3000:3000' in frontend_service['ports']

        # Verify RabbitMQ service configuration
        rabbitmq_service = compose_config['services']['rabbitmq']
        assert 'image' in rabbitmq_service
        assert 'rabbitmq:3-management' in rabbitmq_service['image']
        assert 'ports' in rabbitmq_service
        assert '5672:5672' in rabbitmq_service['ports']
        assert '15672:15672' in rabbitmq_service['ports']

        # Verify volumes are defined
        assert 'volumes' in compose_config
        required_volumes = ['postgres_data', 'rabbitmq_data', 'redis_data']
        for volume in required_volumes:
            assert volume in compose_config['volumes']

    def test_backend_dockerfile_exists(self):
        """Test that backend Dockerfile exists and has correct structure"""
        import os

        assert os.path.exists('Dockerfile.backend'), "Backend Dockerfile not found"

        with open('Dockerfile.backend', 'r') as f:
            dockerfile_content = f.read()

        # Verify key instructions are present
        assert 'FROM python:3.12-slim' in dockerfile_content
        assert 'WORKDIR /app' in dockerfile_content
        assert 'COPY pyproject.toml poetry.lock' in dockerfile_content
        assert 'RUN poetry install' in dockerfile_content
        assert 'EXPOSE 8000' in dockerfile_content
        assert 'CMD ["python", "run_backend.py"]' in dockerfile_content
        assert 'HEALTHCHECK' in dockerfile_content

    def test_frontend_dockerfile_exists(self):
        """Test that frontend Dockerfile exists and has correct structure"""
        import os

        dockerfile_path = 'front-ai-control/Dockerfile'
        assert os.path.exists(dockerfile_path), "Frontend Dockerfile not found"

        with open(dockerfile_path, 'r') as f:
            dockerfile_content = f.read()

        # Verify key instructions are present
        assert 'FROM node:18-alpine' in dockerfile_content
        assert 'WORKDIR /app' in dockerfile_content
        assert 'COPY package*.json' in dockerfile_content
        assert 'RUN npm ci' in dockerfile_content
        assert 'RUN npm run build' in dockerfile_content
        assert 'EXPOSE 3000' in dockerfile_content
        assert 'HEALTHCHECK' in dockerfile_content

    @pytest.mark.integration
    def test_docker_build_backend(self):
        """Test building backend Docker image"""
        import subprocess
        import os

        # This test requires Docker to be available
        try:
            result = subprocess.run(
                ['docker', 'build', '-f', 'Dockerfile.backend', '-t', 'ai-control-backend-test', '.'],
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )

            assert result.returncode == 0, f"Docker build failed: {result.stderr}"

            # Cleanup
            subprocess.run(['docker', 'rmi', 'ai-control-backend-test'],
                         capture_output=True)

        except (subprocess.TimeoutExpired, FileNotFoundError):
            pytest.skip("Docker not available or build timeout")

    @pytest.mark.integration
    def test_docker_build_frontend(self):
        """Test building frontend Docker image"""
        import subprocess
        import os

        try:
            result = subprocess.run(
                ['docker', 'build', '-f', 'front-ai-control/Dockerfile',
                 '-t', 'ai-control-frontend-test', 'front-ai-control/'],
                capture_output=True,
                text=True,
                timeout=300
            )

            assert result.returncode == 0, f"Docker build failed: {result.stderr}"

            # Cleanup
            subprocess.run(['docker', 'rmi', 'ai-control-frontend-test'],
                         capture_output=True)

        except (subprocess.TimeoutExpired, FileNotFoundError):
            pytest.skip("Docker not available or build timeout")

    @pytest.mark.integration
    def test_docker_compose_validation(self):
        """Test docker-compose configuration validation"""
        import subprocess

        try:
            # Validate docker-compose.yml syntax
            result = subprocess.run(
                ['docker-compose', 'config'],
                capture_output=True,
                text=True,
                timeout=30
            )

            assert result.returncode == 0, f"docker-compose config validation failed: {result.stderr}"

        except (subprocess.TimeoutExpired, FileNotFoundError):
            pytest.skip("docker-compose not available")

    def test_environment_variables_configuration(self):
        """Test that required environment variables are configured"""
        import yaml

        with open('docker-compose.yml', 'r') as f:
            compose_config = yaml.safe_load(f)

        backend_env = compose_config['services']['backend']['environment']

        # Verify database environment variables
        db_vars = ['DB__HOST', 'DB__PORT', 'DB__USER', 'DB__PASSWORD', 'DB__DB_NAME']
        for var in db_vars:
            assert var in backend_env, f"Database environment variable {var} not configured"

        # Verify RabbitMQ environment variables
        rabbitmq_vars = ['RABBITMQ__HOST', 'RABBITMQ__PORT', 'RABBITMQ__USER', 'RABBITMQ__PASSWORD']
        for var in rabbitmq_vars:
            assert var in backend_env, f"RabbitMQ environment variable {var} not configured"

        # Verify security environment variables
        security_vars = ['SECURITY__SECRET_KEY', 'SECURITY__REFRESH_SECRET_KEY']
        for var in security_vars:
            assert var in backend_env, f"Security environment variable {var} not configured"

    def test_service_dependencies(self):
        """Test that service dependencies are correctly configured"""
        import yaml

        with open('docker-compose.yml', 'r') as f:
            compose_config = yaml.safe_load(f)

        # Backend should depend on postgres and rabbitmq
        backend_deps = compose_config['services']['backend']['depends_on']
        assert 'postgres' in backend_deps
        assert 'rabbitmq' in backend_deps

        # Frontend should depend on backend
        frontend_deps = compose_config['services']['frontend']['depends_on']
        assert 'backend' in frontend_deps

        # Verify health check conditions
        postgres_condition = backend_deps['postgres']
        rabbitmq_condition = backend_deps['rabbitmq']
        assert postgres_condition['condition'] == 'service_healthy'
        assert rabbitmq_condition['condition'] == 'service_healthy'

    def test_health_checks_configuration(self):
        """Test that health checks are properly configured"""
        import yaml

        with open('docker-compose.yml', 'r') as f:
            compose_config = yaml.safe_load(f)

        services_with_health_checks = ['postgres', 'rabbitmq', 'backend', 'frontend', 'redis']

        for service in services_with_health_checks:
            service_config = compose_config['services'][service]
            assert 'healthcheck' in service_config, f"Health check not configured for {service}"

            health_check = service_config['healthcheck']
            assert 'test' in health_check
            assert 'interval' in health_check
            assert 'timeout' in health_check
            assert 'retries' in health_check
