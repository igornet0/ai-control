"""
Pytest configuration and fixtures for the AI Control System tests.
Provides common test utilities and fixtures.
"""

import asyncio
import pytest
import os
import sys
from typing import AsyncGenerator, Generator
from uuid import uuid4
from unittest.mock import AsyncMock, Mock

from fastapi.testclient import TestClient
from httpx import AsyncClient

# Add src to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.main import app
from src.domain.user_management.entities.user import User
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.user_management.value_objects.email import Email
from src.domain.user_management.value_objects.password import Password
from src.domain.user_management.value_objects.role import Role


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def client() -> TestClient:
    """Create a test client for synchronous HTTP requests."""
    return TestClient(app)


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client for asynchronous HTTP requests."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_user() -> User:
    """Create a sample user for testing."""
    return User(
        id=UserId.generate(),
        email=Email("test@example.com"),
        password=Password("SecurePassword123!"),
        role=Role.USER,
        first_name="John",
        last_name="Doe"
    )


@pytest.fixture
def sample_admin() -> User:
    """Create a sample admin user for testing."""
    return User(
        id=UserId.generate(),
        email=Email("admin@example.com"),
        password=Password("SecurePassword123!"),
        role=Role.ADMIN,
        first_name="Admin",
        last_name="User"
    )


@pytest.fixture
def sample_manager() -> User:
    """Create a sample manager user for testing."""
    return User(
        id=UserId.generate(),
        email=Email("manager@example.com"),
        password=Password("SecurePassword123!"),
        role=Role.MANAGER,
        first_name="Manager",
        last_name="User"
    )


@pytest.fixture
def sample_user_data() -> dict:
    """Create sample user data for API testing."""
    return {
        "email": "test@example.com",
        "password": "SecurePassword123!",
        "first_name": "John",
        "last_name": "Doe",
        "role": "user"
    }


@pytest.fixture
def sample_organization_id() -> str:
    """Create a sample organization ID for testing."""
    return str(uuid4())


@pytest.fixture
def sample_department_id() -> str:
    """Create a sample department ID for testing."""
    return str(uuid4())


@pytest.fixture
def sample_manager_id() -> str:
    """Create a sample manager ID for testing."""
    return str(uuid4())


@pytest.fixture
def sample_user_id() -> str:
    """Create a sample user ID for testing."""
    return str(uuid4())


# Mock fixtures for testing
@pytest.fixture
def mock_user_repository():
    """Mock user repository for testing."""
    return AsyncMock()


@pytest.fixture
def mock_task_repository():
    """Mock task repository for testing."""
    return AsyncMock()


@pytest.fixture
def mock_auth_service():
    """Mock auth service for testing."""
    return AsyncMock()


@pytest.fixture
def mock_jwt_service():
    """Mock JWT service for testing."""
    return Mock()


@pytest.fixture
def mock_password_service():
    """Mock password service for testing."""
    return Mock()


# Authentication fixtures
@pytest.fixture
def valid_access_token():
    """Valid access token for testing."""
    return "valid-access-token"


@pytest.fixture
def valid_refresh_token():
    """Valid refresh token for testing."""
    return "valid-refresh-token"


@pytest.fixture
def invalid_token():
    """Invalid token for testing."""
    return "invalid-token"


# Test data fixtures
@pytest.fixture
def sample_task_data():
    """Sample task data for testing."""
    return {
        "title": "Test Task",
        "description": "Test task description",
        "assignee_id": str(uuid4()),
        "creator_id": str(uuid4()),
        "priority": "medium"
    }


@pytest.fixture
def sample_organization_data():
    """Sample organization data for testing."""
    return {
        "name": "Test Organization",
        "description": "Test organization description",
        "website": "https://test.com"
    }


@pytest.fixture
def sample_department_data():
    """Sample department data for testing."""
    return {
        "name": "Test Department",
        "description": "Test department description",
        "organization_id": str(uuid4())
    }


@pytest.fixture
def sample_dashboard_data():
    """Sample dashboard data for testing."""
    return {
        "name": "Test Dashboard",
        "description": "Test dashboard description",
        "user_id": str(uuid4())
    }


@pytest.fixture
def sample_kpi_data():
    """Sample KPI data for testing."""
    return {
        "name": "Test KPI",
        "description": "Test KPI description",
        "target_value": 100.0,
        "current_value": 75.0,
        "unit": "percentage"
    }


# Pytest markers
pytestmark = [
    pytest.mark.asyncio,
]
