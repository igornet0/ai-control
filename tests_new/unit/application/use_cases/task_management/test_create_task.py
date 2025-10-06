"""Tests for CreateTaskUseCase."""

import pytest
from unittest.mock import Mock, AsyncMock
from src.application.use_cases.task_management.create_task import CreateTaskUseCase
from src.application.dto.task_dto import CreateTaskRequest, TaskResponse
from src.domain.task_management.entities.task import Task
from src.domain.task_management.value_objects.task_id import TaskId
from src.domain.task_management.value_objects.task_status import TaskStatus
from src.domain.task_management.value_objects.task_priority import TaskPriority
from src.domain.user_management.value_objects.user_id import UserId
from src.domain.exceptions import EntityNotFound, ValidationError


class TestCreateTaskUseCase:
    """Test cases for CreateTaskUseCase."""

    @pytest.fixture
    def mock_task_repository(self):
        """Create mock task repository."""
        return AsyncMock()

    @pytest.fixture
    def mock_user_repository(self):
        """Create mock user repository."""
        return AsyncMock()

    @pytest.fixture
    def create_task_use_case(self, mock_task_repository, mock_user_repository):
        """Create CreateTaskUseCase instance with mocked dependencies."""
        return CreateTaskUseCase(
            task_repository=mock_task_repository,
            user_repository=mock_user_repository
        )

    @pytest.mark.asyncio
    async def test_create_task_success(self, create_task_use_case, mock_task_repository, mock_user_repository):
        """Test successful task creation."""
        # Arrange
        assignee_id = UserId.generate()
        creator_id = UserId.generate()
        
        request = CreateTaskRequest(
            title="Test Task",
            description="Test task description",
            assignee_id=str(assignee_id),
            creator_id=str(creator_id),
            priority="medium"
        )

        mock_user_repository.find_by_id.side_effect = [True, True]  # Both users exist
        mock_task_repository.save.return_value = None

        # Act
        result = await create_task_use_case.execute(request)

        # Assert
        assert isinstance(result, TaskResponse)
        assert result.title == "Test Task"
        assert result.description == "Test task description"
        assert result.assignee_id == str(assignee_id)
        assert result.creator_id == str(creator_id)
        assert result.priority == "medium"
        assert result.status == "todo"

        mock_user_repository.find_by_id.assert_any_call(assignee_id)
        mock_user_repository.find_by_id.assert_any_call(creator_id)
        mock_task_repository.save.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_task_assignee_not_found(self, create_task_use_case, mock_task_repository, mock_user_repository):
        """Test task creation with non-existent assignee."""
        # Arrange
        assignee_id = UserId.generate()
        creator_id = UserId.generate()
        
        request = CreateTaskRequest(
            title="Test Task",
            description="Test task description",
            assignee_id=str(assignee_id),
            creator_id=str(creator_id),
            priority="medium"
        )

        mock_user_repository.find_by_id.side_effect = [None, True]  # Assignee not found

        # Act & Assert
        with pytest.raises(EntityNotFound, match="User not found"):
            await create_task_use_case.execute(request)

        mock_user_repository.find_by_id.assert_any_call(assignee_id)
        mock_task_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_task_creator_not_found(self, create_task_use_case, mock_task_repository, mock_user_repository):
        """Test task creation with non-existent creator."""
        # Arrange
        assignee_id = UserId.generate()
        creator_id = UserId.generate()
        
        request = CreateTaskRequest(
            title="Test Task",
            description="Test task description",
            assignee_id=str(assignee_id),
            creator_id=str(creator_id),
            priority="medium"
        )

        mock_user_repository.find_by_id.side_effect = [True, None]  # Creator not found

        # Act & Assert
        with pytest.raises(EntityNotFound, match="User not found"):
            await create_task_use_case.execute(request)

        mock_user_repository.find_by_id.assert_any_call(assignee_id)
        mock_user_repository.find_by_id.assert_any_call(creator_id)
        mock_task_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_task_invalid_priority(self, create_task_use_case, mock_task_repository, mock_user_repository):
        """Test task creation with invalid priority."""
        # Arrange
        assignee_id = UserId.generate()
        creator_id = UserId.generate()
        
        request = CreateTaskRequest(
            title="Test Task",
            description="Test task description",
            assignee_id=str(assignee_id),
            creator_id=str(creator_id),
            priority="invalid_priority"
        )

        # Act & Assert
        with pytest.raises(ValidationError, match="Invalid priority"):
            await create_task_use_case.execute(request)

        mock_user_repository.find_by_id.assert_not_called()
        mock_task_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_task_empty_title(self, create_task_use_case, mock_task_repository, mock_user_repository):
        """Test task creation with empty title."""
        # Arrange
        assignee_id = UserId.generate()
        creator_id = UserId.generate()
        
        request = CreateTaskRequest(
            title="",
            description="Test task description",
            assignee_id=str(assignee_id),
            creator_id=str(creator_id),
            priority="medium"
        )

        # Act & Assert
        with pytest.raises(ValidationError, match="Title cannot be empty"):
            await create_task_use_case.execute(request)

        mock_user_repository.find_by_id.assert_not_called()
        mock_task_repository.save.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_task_high_priority(self, create_task_use_case, mock_task_repository, mock_user_repository):
        """Test successful high priority task creation."""
        # Arrange
        assignee_id = UserId.generate()
        creator_id = UserId.generate()
        
        request = CreateTaskRequest(
            title="Urgent Task",
            description="Urgent task description",
            assignee_id=str(assignee_id),
            creator_id=str(creator_id),
            priority="high"
        )

        mock_user_repository.find_by_id.side_effect = [True, True]  # Both users exist
        mock_task_repository.save.return_value = None

        # Act
        result = await create_task_use_case.execute(request)

        # Assert
        assert isinstance(result, TaskResponse)
        assert result.title == "Urgent Task"
        assert result.priority == "high"
        assert result.status == "todo"

        mock_user_repository.find_by_id.assert_any_call(assignee_id)
        mock_user_repository.find_by_id.assert_any_call(creator_id)
        mock_task_repository.save.assert_called_once()
