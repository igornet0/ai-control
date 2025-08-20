import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from backend.api.services.rabbitmq_consumer import CodeExecutionConsumer


class TestRabbitMQConsumer:
    """Comprehensive tests for RabbitMQ code execution consumer"""
    
    @pytest.fixture
    def consumer(self):
        """Create a CodeExecutionConsumer instance for testing"""
        return CodeExecutionConsumer()
    
    @pytest.fixture
    def sample_message(self):
        """Sample message data for testing"""
        return {
            "execution_id": "test-exec-123",
            "code": "print('Hello, World!')",
            "language": "python",
            "tabs": [
                {"name": "Tab 1", "content": "print('Tab 1 content')"},
                {"name": "Tab 2", "content": "print('Tab 2 content')"}
            ],
            "user_id": "user-123",
            "timestamp": "2024-01-01T00:00:00Z"
        }
    
    @pytest.mark.asyncio
    async def test_process_code_execution_request_with_direct_code(self, consumer, sample_message):
        """Test processing message with direct code"""
        with patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_manager:
            
            # Mock the code execution service
            mock_execution_results = [
                {"status": "starting", "execution_id": "test-exec-123", "message": "Starting"},
                {"status": "output", "execution_id": "test-exec-123", "content": "Hello, World!", "stream": "stdout"},
                {"status": "completed", "execution_id": "test-exec-123", "return_code": 0}
            ]
            
            async def mock_execute_code(*args, **kwargs):
                for result in mock_execution_results:
                    yield result
            
            mock_service.execute_code = mock_execute_code
            mock_manager.send_to_execution = AsyncMock()
            
            # Process the message
            await consumer.process_code_execution_request(sample_message)
            
            # Verify WebSocket messages were sent
            assert mock_manager.send_to_execution.call_count >= 4  # Start + results + finish
            
            # Verify execution started message
            start_call = mock_manager.send_to_execution.call_args_list[0]
            start_message = start_call[0][1]
            assert start_message['type'] == 'execution_started'
            assert start_message['execution_id'] == 'test-exec-123'
    
    @pytest.mark.asyncio
    async def test_process_code_execution_request_with_tabs(self, consumer):
        """Test processing message with tabs instead of direct code"""
        message = {
            "execution_id": "test-tabs-123",
            "tabs": [
                {"name": "Main", "content": "print('Main tab')"},
                {"name": "Utils", "content": "def helper(): return 42"}
            ],
            "language": "python"
        }
        
        with patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_manager:
            
            mock_execution_results = [
                {"status": "starting", "execution_id": "test-tabs-123"},
                {"status": "completed", "execution_id": "test-tabs-123", "return_code": 0}
            ]
            
            async def mock_execute_code(code, language, execution_id):
                # Verify combined code contains both tabs
                assert "Main tab" in code
                assert "def helper(): return 42" in code
                assert "# === Main ===" in code
                assert "# === Utils ===" in code
                
                for result in mock_execution_results:
                    yield result
            
            mock_service.execute_code = mock_execute_code
            mock_manager.send_to_execution = AsyncMock()
            
            await consumer.process_code_execution_request(message)
            
            # Verify execution completed
            assert mock_manager.send_to_execution.call_count >= 2
    
    @pytest.mark.asyncio
    async def test_process_code_execution_request_no_code(self, consumer):
        """Test processing message with no code or tabs"""
        message = {
            "execution_id": "test-no-code-123",
            "language": "python"
        }
        
        with patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_manager:
            mock_manager.send_to_execution = AsyncMock()
            
            await consumer.process_code_execution_request(message)
            
            # Should send error message
            error_calls = [call for call in mock_manager.send_to_execution.call_args_list 
                          if call[0][1].get('type') == 'error']
            assert len(error_calls) > 0
            
            error_message = error_calls[0][0][1]
            assert 'No code provided' in error_message['message']
    
    @pytest.mark.asyncio
    async def test_process_code_execution_request_no_execution_id(self, consumer):
        """Test processing message without execution_id"""
        message = {
            "code": "print('test')",
            "language": "python"
        }
        
        with patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_manager:
            mock_manager.send_to_execution = AsyncMock()
            
            await consumer.process_code_execution_request(message)
            
            # Should not process without execution_id
            assert mock_manager.send_to_execution.call_count == 0
    
    @pytest.mark.asyncio
    async def test_process_code_execution_request_execution_error(self, consumer, sample_message):
        """Test handling of code execution errors"""
        with patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_manager:
            
            # Mock execution service to raise an exception
            async def mock_execute_code(*args, **kwargs):
                raise Exception("Execution failed")
                yield  # This won't be reached but needed for async generator
            
            mock_service.execute_code = mock_execute_code
            mock_manager.send_to_execution = AsyncMock()
            
            await consumer.process_code_execution_request(sample_message)
            
            # Should send error message to WebSocket
            error_calls = [call for call in mock_manager.send_to_execution.call_args_list 
                          if call[0][1].get('type') == 'execution_error']
            assert len(error_calls) > 0
            
            error_message = error_calls[0][0][1]
            assert 'Execution failed' in error_message['error']
    
    def test_combine_tab_code_empty_tabs(self, consumer):
        """Test combining empty tabs"""
        result = consumer._combine_tab_code([])
        assert result == ""
    
    def test_combine_tab_code_single_tab(self, consumer):
        """Test combining single tab"""
        tabs = [{"name": "Main", "content": "print('Hello')"}]
        result = consumer._combine_tab_code(tabs)
        
        assert "# Combined code from multiple tabs" in result
        assert "# === Main ===" in result
        assert "print('Hello')" in result
    
    def test_combine_tab_code_multiple_tabs(self, consumer):
        """Test combining multiple tabs"""
        tabs = [
            {"name": "Main", "content": "print('Main')"},
            {"name": "Utils", "content": "def helper():\n    return 42"},
            {"name": "Empty", "content": ""},  # Empty tab should be skipped
            {"name": "Config", "content": "CONFIG = {'debug': True}"}
        ]
        
        result = consumer._combine_tab_code(tabs)
        
        # Check structure
        assert "# Combined code from multiple tabs" in result
        assert "# === Main ===" in result
        assert "# === Utils ===" in result
        assert "# === Config ===" in result
        assert "# === Empty ===" not in result  # Empty tabs should be skipped
        
        # Check content
        assert "print('Main')" in result
        assert "def helper():" in result
        assert "return 42" in result
        assert "CONFIG = {'debug': True}" in result
        
        # Check separation
        lines = result.split('\n')
        main_index = next(i for i, line in enumerate(lines) if "# === Main ===" in line)
        utils_index = next(i for i, line in enumerate(lines) if "# === Utils ===" in line)
        assert utils_index > main_index  # Utils should come after Main
    
    def test_combine_tab_code_tabs_without_names(self, consumer):
        """Test combining tabs without names"""
        tabs = [
            {"content": "print('First')"},
            {"name": "", "content": "print('Second')"},
            {"content": "print('Third')"}
        ]
        
        result = consumer._combine_tab_code(tabs)
        
        # Should use default names
        assert "# === Tab 1 ===" in result
        assert "# === Tab 2 ===" in result
        assert "# === Tab 3 ===" in result
        
        assert "print('First')" in result
        assert "print('Second')" in result
        assert "print('Third')" in result
    
    @pytest.mark.asyncio
    async def test_start_consuming_already_running(self, consumer):
        """Test starting consumer when already running"""
        consumer.is_running = True
        
        with patch('backend.api.services.rabbitmq_consumer.rabbit') as mock_rabbit:
            await consumer.start_consuming()
            
            # Should not setup again if already running
            mock_rabbit.setup_dlx.assert_not_called()
            mock_rabbit.consume_messages.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_start_consuming_success(self, consumer):
        """Test successful consumer startup"""
        with patch('backend.api.services.rabbitmq_consumer.rabbit') as mock_rabbit:
            mock_rabbit.setup_dlx = AsyncMock()
            mock_rabbit.consume_messages = AsyncMock()
            
            # Mock consume_messages to prevent infinite loop
            async def mock_consume(*args, **kwargs):
                consumer.is_running = False  # Stop after first iteration
            
            mock_rabbit.consume_messages.side_effect = mock_consume
            
            await consumer.start_consuming()
            
            # Verify setup was called
            mock_rabbit.setup_dlx.assert_called_once()
            mock_rabbit.consume_messages.assert_called_once_with(
                queue="code_execution_queue",
                callback=consumer.process_code_execution_request,
                prefetch_count=1
            )
    
    @pytest.mark.asyncio
    async def test_start_consuming_error(self, consumer):
        """Test consumer startup error handling"""
        with patch('backend.api.services.rabbitmq_consumer.rabbit') as mock_rabbit:
            mock_rabbit.setup_dlx = AsyncMock(side_effect=Exception("Connection failed"))
            
            with pytest.raises(Exception, match="Connection failed"):
                await consumer.start_consuming()
            
            # Should reset running state on error
            assert not consumer.is_running
    
    @pytest.mark.asyncio
    async def test_stop_consuming(self, consumer):
        """Test stopping the consumer"""
        consumer.is_running = True
        
        with patch('backend.api.services.rabbitmq_consumer.rabbit') as mock_rabbit:
            mock_rabbit.close = AsyncMock()
            
            await consumer.stop_consuming()
            
            assert not consumer.is_running
            mock_rabbit.close.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_message_processing_with_special_characters(self, consumer):
        """Test processing messages with special characters and unicode"""
        message = {
            "execution_id": "test-unicode-123",
            "code": "print('Hello 世界! 🌍')\nprint('Special chars: àáâãäå')",
            "language": "python"
        }
        
        with patch('backend.api.services.rabbitmq_consumer.code_execution_service') as mock_service, \
             patch('backend.api.services.rabbitmq_consumer.connection_manager') as mock_manager:
            
            async def mock_execute_code(code, language, execution_id):
                # Verify unicode is preserved
                assert '世界' in code
                assert '🌍' in code
                assert 'àáâãäå' in code
                
                yield {"status": "completed", "execution_id": execution_id, "return_code": 0}
            
            mock_service.execute_code = mock_execute_code
            mock_manager.send_to_execution = AsyncMock()
            
            await consumer.process_code_execution_request(message)
            
            # Should complete successfully
            assert mock_manager.send_to_execution.call_count >= 2
