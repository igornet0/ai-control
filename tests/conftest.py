"""
Pytest configuration and fixtures for the AI Control code execution system tests
"""

import pytest
import pytest_asyncio
import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock

# Add the project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def session():
    """Create a database session for testing"""
    from core.database import get_db_helper
    
    async with get_db_helper().get_session() as session:
        yield session


@pytest.fixture
def mock_rabbit():
    """Mock RabbitMQ connection for testing"""
    rabbit = MagicMock()
    rabbit.send_message = AsyncMock()
    rabbit.consume_messages = AsyncMock()
    rabbit.setup_dlx = AsyncMock()
    rabbit.get_connection = AsyncMock()
    rabbit.close = AsyncMock()
    
    # Mock connection object
    mock_connection = MagicMock()
    mock_connection.is_closed = False
    rabbit.get_connection.return_value = mock_connection
    
    return rabbit


@pytest.fixture
def mock_websocket():
    """Mock WebSocket connection for testing"""
    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_text = AsyncMock()
    ws.receive_text = AsyncMock()
    ws.receive_json = AsyncMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    return ws


@pytest.fixture
def sample_python_code():
    """Sample Python code for testing"""
    return """
print("Hello, World!")
result = 2 + 2
print(f"2 + 2 = {result}")

# Test with some computation
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f"Sum of {numbers} = {total}")
"""


@pytest.fixture
def sample_javascript_code():
    """Sample JavaScript code for testing"""
    return """
console.log("Hello from JavaScript!");
const result = 5 * 6;
console.log(`5 * 6 = ${result}`);

// Test with array operations
const numbers = [1, 2, 3, 4, 5];
const total = numbers.reduce((sum, num) => sum + num, 0);
console.log(`Sum of [${numbers.join(', ')}] = ${total}`);
"""


@pytest.fixture
def sample_tabs():
    """Sample tabs data for testing"""
    return [
        {
            "name": "Main",
            "content": "print('Main execution')\nresult = main_function()"
        },
        {
            "name": "Utils",
            "content": "def main_function():\n    return 'Function executed successfully'"
        },
        {
            "name": "Config",
            "content": "CONFIG = {\n    'debug': True,\n    'version': '1.0.0'\n}"
        }
    ]


@pytest.fixture
def sample_execution_message():
    """Sample RabbitMQ message for code execution"""
    return {
        "execution_id": "test-exec-123",
        "code": "print('Hello, World!')",
        "language": "python",
        "user_id": "test-user",
        "timestamp": "2024-01-01T00:00:00Z",
        "request_source": "test"
    }


@pytest.fixture
def sample_tabs_message():
    """Sample RabbitMQ message with tabs"""
    return {
        "execution_id": "test-tabs-456",
        "tabs": [
            {"name": "Tab 1", "content": "print('Tab 1 content')"},
            {"name": "Tab 2", "content": "print('Tab 2 content')"}
        ],
        "language": "python",
        "user_id": "test-user",
        "timestamp": "2024-01-01T00:00:00Z"
    }


@pytest.fixture
def mock_execution_results():
    """Mock execution results for testing"""
    return [
        {
            "execution_id": "test-exec-123",
            "status": "starting",
            "timestamp": "2024-01-01T00:00:00Z",
            "message": "Starting code execution"
        },
        {
            "execution_id": "test-exec-123",
            "status": "compiling",
            "timestamp": "2024-01-01T00:00:01Z",
            "message": "Compiling code"
        },
        {
            "execution_id": "test-exec-123",
            "status": "compilation_success",
            "timestamp": "2024-01-01T00:00:02Z",
            "message": "Code compiled successfully"
        },
        {
            "execution_id": "test-exec-123",
            "status": "executing",
            "timestamp": "2024-01-01T00:00:03Z",
            "message": "Executing code"
        },
        {
            "execution_id": "test-exec-123",
            "status": "output",
            "timestamp": "2024-01-01T00:00:04Z",
            "stream": "stdout",
            "content": "Hello, World!"
        },
        {
            "execution_id": "test-exec-123",
            "status": "output",
            "timestamp": "2024-01-01T00:00:05Z",
            "stream": "stdout",
            "content": "2 + 2 = 4"
        },
        {
            "execution_id": "test-exec-123",
            "status": "completed",
            "timestamp": "2024-01-01T00:00:06Z",
            "return_code": 0,
            "message": "Execution completed successfully"
        }
    ]


@pytest.fixture
def mock_error_execution_results():
    """Mock execution results with errors for testing"""
    return [
        {
            "execution_id": "test-error-789",
            "status": "starting",
            "timestamp": "2024-01-01T00:00:00Z",
            "message": "Starting code execution"
        },
        {
            "execution_id": "test-error-789",
            "status": "compilation_error",
            "timestamp": "2024-01-01T00:00:01Z",
            "error": "SyntaxError: invalid syntax",
            "line": 2,
            "column": 15
        }
    ]


# Pytest markers for different test categories
def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "docker: mark test as requiring Docker"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "rabbitmq: mark test as requiring RabbitMQ"
    )
    config.addinivalue_line(
        "markers", "websocket: mark test as testing WebSocket functionality"
    )


# Skip Docker tests if Docker is not available
def pytest_collection_modifyitems(config, items):
    """Modify test collection to handle Docker availability"""
    import subprocess
    
    # Check if Docker is available
    docker_available = True
    try:
        subprocess.run(['docker', '--version'], 
                      capture_output=True, 
                      check=True, 
                      timeout=10)
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        docker_available = False
    
    # Skip Docker tests if Docker is not available
    if not docker_available:
        skip_docker = pytest.mark.skip(reason="Docker not available")
        for item in items:
            if "docker" in item.keywords:
                item.add_marker(skip_docker)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Setup test environment"""
    # Set test environment variables
    os.environ['TESTING'] = 'true'
    os.environ['DB__HOST'] = 'localhost'
    os.environ['DB__PORT'] = '5432'
    os.environ['DB__USER'] = 'test_user'
    os.environ['DB__PASSWORD'] = 'test_password'
    os.environ['DB__DB_NAME'] = 'test_db'
    os.environ['RABBITMQ__HOST'] = 'localhost'
    os.environ['RABBITMQ__PORT'] = '5672'
    os.environ['RABBITMQ__USER'] = 'guest'
    os.environ['RABBITMQ__PASSWORD'] = 'guest'
    os.environ['SECURITY__SECRET_KEY'] = 'test-secret-key'
    os.environ['SECURITY__REFRESH_SECRET_KEY'] = 'test-refresh-secret-key'
    
    yield
    
    # Cleanup
    test_vars = [
        'TESTING', 'DB__HOST', 'DB__PORT', 'DB__USER', 'DB__PASSWORD', 
        'DB__DB_NAME', 'RABBITMQ__HOST', 'RABBITMQ__PORT', 'RABBITMQ__USER', 
        'RABBITMQ__PASSWORD', 'SECURITY__SECRET_KEY', 'SECURITY__REFRESH_SECRET_KEY'
    ]
    for var in test_vars:
        os.environ.pop(var, None)


@pytest.fixture
def temp_code_file():
    """Create a temporary code file for testing"""
    import tempfile
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("print('Hello from temp file')")
        temp_file_path = f.name
    
    yield temp_file_path
    
    # Cleanup
    try:
        os.unlink(temp_file_path)
    except OSError:
        pass


@pytest.fixture
def mock_subprocess():
    """Mock subprocess for testing code execution"""
    import subprocess
    from unittest.mock import patch
    
    mock_process = MagicMock()
    mock_process.returncode = 0
    mock_process.stdout.readline = AsyncMock(side_effect=[
        b"Hello, World!\n",
        b"2 + 2 = 4\n",
        b""  # End of output
    ])
    mock_process.stderr.readline = AsyncMock(return_value=b"")
    mock_process.wait = AsyncMock(return_value=0)
    mock_process.kill = MagicMock()
    
    with patch('asyncio.create_subprocess_exec', return_value=mock_process) as mock_exec:
        yield mock_exec, mock_process
