"""Integration tests for Task API endpoints."""

import pytest
from httpx import AsyncClient
from fastapi import FastAPI
from unittest.mock import AsyncMock, patch
from src.main import app
from src.domain.task_management.entities.task import Task
from src.domain.task_management.value_objects.task_id import TaskId
from src.domain.task_management.value_objects.task_status import TaskStatus
from src.domain.task_management.value_objects.task_priority import TaskPriority
from src.domain.user_management.value_objects.user_id import UserId


class TestTaskAPI:
    """Integration tests for Task API."""

    @pytest.fixture
    async def client(self):
        """Create test client."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    @pytest.fixture
    def mock_task(self):
        """Create mock task."""
        return Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test task description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO
        )

    @pytest.mark.asyncio
    async def test_create_task_success(self, client, mock_task):
        """Test successful task creation via API."""
        # Arrange
        task_data = {
            "title": "New Task",
            "description": "New task description",
            "assignee_id": str(mock_task.assignee_id),
            "creator_id": str(mock_task.creator_id),
            "priority": "high"
        }

        with patch("src.presentation.api.dependencies.get_create_task_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = {
                "id": str(mock_task.id),
                "title": task_data["title"],
                "description": task_data["description"],
                "assignee_id": task_data["assignee_id"],
                "creator_id": task_data["creator_id"],
                "priority": task_data["priority"],
                "status": "todo",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.post("/api/v1/tasks", json=task_data)

            # Assert
            assert response.status_code == 201
            data = response.json()
            assert data["title"] == task_data["title"]
            assert data["description"] == task_data["description"]
            assert data["assignee_id"] == task_data["assignee_id"]
            assert data["priority"] == task_data["priority"]

    @pytest.mark.asyncio
    async def test_create_task_validation_error(self, client):
        """Test task creation with validation error."""
        # Arrange
        task_data = {
            "title": "",  # Empty title
            "description": "Task description",
            "assignee_id": "invalid-uuid",
            "creator_id": "invalid-uuid",
            "priority": "invalid_priority"
        }

        # Act
        response = await client.post("/api/v1/tasks", json=task_data)

        # Assert
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_get_task_success(self, client, mock_task):
        """Test successful task retrieval via API."""
        # Arrange
        task_id = str(mock_task.id)

        with patch("src.presentation.api.dependencies.get_task_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = {
                "id": task_id,
                "title": mock_task.title,
                "description": mock_task.description,
                "assignee_id": str(mock_task.assignee_id),
                "creator_id": str(mock_task.creator_id),
                "priority": mock_task.priority.value,
                "status": mock_task.status.value,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.get(f"/api/v1/tasks/{task_id}")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == task_id
            assert data["title"] == mock_task.title

    @pytest.mark.asyncio
    async def test_get_task_not_found(self, client):
        """Test task retrieval with non-existent task."""
        # Arrange
        task_id = "non-existent-id"

        with patch("src.presentation.api.dependencies.get_task_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.side_effect = Exception("Task not found")
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.get(f"/api/v1/tasks/{task_id}")

            # Assert
            assert response.status_code == 500  # Internal server error

    @pytest.mark.asyncio
    async def test_get_tasks_success(self, client, mock_task):
        """Test successful tasks list retrieval via API."""
        # Arrange
        with patch("src.presentation.api.dependencies.get_tasks_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = [
                {
                    "id": str(mock_task.id),
                    "title": mock_task.title,
                    "description": mock_task.description,
                    "assignee_id": str(mock_task.assignee_id),
                    "creator_id": str(mock_task.creator_id),
                    "priority": mock_task.priority.value,
                    "status": mock_task.status.value,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                }
            ]
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.get("/api/v1/tasks")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["title"] == mock_task.title

    @pytest.mark.asyncio
    async def test_update_task_success(self, client, mock_task):
        """Test successful task update via API."""
        # Arrange
        task_id = str(mock_task.id)
        update_data = {
            "title": "Updated Task",
            "description": "Updated description",
            "priority": "low",
            "status": "in_progress"
        }

        with patch("src.presentation.api.dependencies.get_update_task_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = {
                "id": task_id,
                "title": update_data["title"],
                "description": update_data["description"],
                "assignee_id": str(mock_task.assignee_id),
                "creator_id": str(mock_task.creator_id),
                "priority": update_data["priority"],
                "status": update_data["status"],
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.put(f"/api/v1/tasks/{task_id}", json=update_data)

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["title"] == update_data["title"]
            assert data["description"] == update_data["description"]
            assert data["priority"] == update_data["priority"]
            assert data["status"] == update_data["status"]

    @pytest.mark.asyncio
    async def test_delete_task_success(self, client, mock_task):
        """Test successful task deletion via API."""
        # Arrange
        task_id = str(mock_task.id)

        with patch("src.presentation.api.dependencies.get_delete_task_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = None
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.delete(f"/api/v1/tasks/{task_id}")

            # Assert
            assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_get_tasks_by_assignee(self, client, mock_task):
        """Test getting tasks by assignee."""
        # Arrange
        assignee_id = str(mock_task.assignee_id)

        with patch("src.presentation.api.dependencies.get_tasks_use_case") as mock_use_case:
            mock_use_case_instance = AsyncMock()
            mock_use_case_instance.execute.return_value = [
                {
                    "id": str(mock_task.id),
                    "title": mock_task.title,
                    "description": mock_task.description,
                    "assignee_id": assignee_id,
                    "creator_id": str(mock_task.creator_id),
                    "priority": mock_task.priority.value,
                    "status": mock_task.status.value,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                }
            ]
            mock_use_case.return_value = mock_use_case_instance

            # Act
            response = await client.get(f"/api/v1/tasks?assignee_id={assignee_id}")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["assignee_id"] == assignee_id
