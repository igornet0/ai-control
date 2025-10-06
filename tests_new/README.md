# AI Control System - Test Suite

This directory contains the comprehensive test suite for the AI Control System, organized according to Clean Architecture principles.

## Structure

```
tests_new/
├── unit/                          # Unit tests
│   ├── domain/                    # Domain layer tests
│   │   ├── user_management/       # User management domain tests
│   │   ├── task_management/       # Task management domain tests
│   │   ├── dashboard/             # Dashboard domain tests
│   │   ├── kpi/                   # KPI domain tests
│   │   └── ...                    # Other domain tests
│   ├── application/               # Application layer tests
│   │   ├── use_cases/             # Use case tests
│   │   └── dto/                   # DTO tests
│   └── infrastructure/            # Infrastructure layer tests
│       ├── auth/                  # Authentication tests
│       ├── database/              # Database tests
│       └── external_services/     # External service tests
├── integration/                   # Integration tests
│   ├── api/                       # API endpoint tests
│   ├── database/                  # Database integration tests
│   └── external/                  # External service integration tests
├── e2e/                          # End-to-end tests
│   ├── user_flows/               # User workflow tests
│   └── admin_flows/              # Admin workflow tests
├── conftest.py                   # Pytest configuration and fixtures
└── README.md                     # This file
```

## Test Categories

### Unit Tests
- **Domain Tests**: Test business logic, entities, value objects, and domain services
- **Application Tests**: Test use cases, DTOs, and application services
- **Infrastructure Tests**: Test repositories, external services, and infrastructure components

### Integration Tests
- **API Tests**: Test HTTP endpoints, request/response handling, and API contracts
- **Database Tests**: Test database operations, migrations, and data persistence
- **External Service Tests**: Test integration with external APIs and services

### End-to-End Tests
- **User Flow Tests**: Test complete user workflows from UI to database
- **Admin Flow Tests**: Test administrative operations and system management

## Running Tests

### Prerequisites
```bash
# Install dependencies
pip install -e ".[dev]"

# Install test dependencies
pip install pytest pytest-asyncio pytest-cov httpx
```

### Basic Commands
```bash
# Run all tests
make test-new

# Run unit tests only
make test-new-unit

# Run integration tests only
make test-new-integration

# Run tests with coverage
make test-new-coverage

# Run specific test categories
make test-new-auth    # Authentication tests
make test-new-api     # API tests
```

### Advanced Commands
```bash
# Run specific test file
pytest -c pytest_new.ini tests_new/unit/domain/user_management/test_user_entity.py

# Run tests with specific markers
pytest -c pytest_new.ini -m "unit and not slow"

# Run tests with verbose output
pytest -c pytest_new.ini -v

# Run tests in parallel (if pytest-xdist is installed)
pytest -c pytest_new.ini -n auto
```

## Test Configuration

### pytest_new.ini
The test configuration file includes:
- Test discovery patterns
- Markers for test categorization
- Async support configuration
- Coverage settings
- Environment variables for testing

### conftest.py
Contains shared fixtures and configuration:
- Database fixtures
- Mock services
- Test data fixtures
- Authentication fixtures

## Writing Tests

### Unit Test Example
```python
"""Tests for User entity."""

import pytest
from src.domain.user_management.entities.user import User
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.user_management.value_objects.email import Email

class TestUserEntity:
    """Test cases for User entity."""

    def test_create_user_success(self):
        """Test successful user creation."""
        # Arrange
        user_id = UserId.generate()
        email = Email("test@example.com")
        
        # Act
        user = User(id=user_id, email=email, ...)
        
        # Assert
        assert user.id == user_id
        assert user.email == email
```

### Integration Test Example
```python
"""Integration tests for User API endpoints."""

import pytest
from httpx import AsyncClient
from src.main import app

class TestUserAPI:
    """Integration tests for User API."""

    @pytest.mark.asyncio
    async def test_create_user_success(self, client: AsyncClient):
        """Test successful user creation via API."""
        # Arrange
        user_data = {
            "email": "test@example.com",
            "password": "SecurePassword123!",
            "first_name": "John",
            "last_name": "Doe"
        }
        
        # Act
        response = await client.post("/api/v1/users", json=user_data)
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == user_data["email"]
```

## Test Markers

Use markers to categorize and filter tests:

```python
@pytest.mark.unit
def test_user_creation():
    """Unit test for user creation."""
    pass

@pytest.mark.integration
def test_user_api():
    """Integration test for user API."""
    pass

@pytest.mark.slow
def test_large_dataset():
    """Slow running test."""
    pass

@pytest.mark.auth
def test_jwt_validation():
    """Authentication related test."""
    pass
```

## Mocking and Fixtures

### Using Fixtures
```python
def test_with_fixture(sample_user, mock_user_repository):
    """Test using fixtures."""
    # sample_user and mock_user_repository are available
    pass
```

### Creating Custom Fixtures
```python
@pytest.fixture
def custom_fixture():
    """Custom fixture for testing."""
    return {"key": "value"}
```

## Best Practices

### 1. Test Structure
- Follow AAA pattern: Arrange, Act, Assert
- Use descriptive test names
- Group related tests in classes
- Keep tests focused and simple

### 2. Mocking
- Mock external dependencies
- Use dependency injection for testability
- Avoid mocking the system under test

### 3. Data Management
- Use factories for test data creation
- Clean up test data after tests
- Use realistic test data

### 4. Assertions
- Use specific assertions
- Test both positive and negative cases
- Verify side effects and state changes

### 5. Performance
- Mark slow tests appropriately
- Use parallel execution when possible
- Optimize test database operations

## Coverage

The test suite aims for:
- **Unit Tests**: 90%+ coverage
- **Integration Tests**: 80%+ coverage
- **Overall**: 85%+ coverage

View coverage reports:
```bash
make test-new-coverage
# Open htmlcov/index.html in browser
```

## Continuous Integration

Tests are automatically run in CI/CD pipeline:
- Unit tests run on every commit
- Integration tests run on pull requests
- Full test suite runs on main branch

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure `src/` is in Python path
2. **Async Tests**: Use `@pytest.mark.asyncio` for async tests
3. **Database Tests**: Use test database configuration
4. **Mock Issues**: Verify mock setup and teardown

### Debug Mode
```bash
# Run tests with debug output
pytest -c pytest_new.ini -v -s --tb=long

# Run single test with debug
pytest -c pytest_new.ini tests_new/unit/domain/user_management/test_user_entity.py::TestUserEntity::test_create_user_success -v -s
```

## Contributing

When adding new tests:
1. Follow the existing structure and naming conventions
2. Add appropriate markers
3. Include docstrings
4. Update this README if needed
5. Ensure tests pass in CI/CD
