"""Tests for Task entity."""

import pytest
from datetime import datetime, timedelta
from src.domain.task_management.entities.task import Task
from src.domain.task_management.value_objects.task_id import TaskId
from src.domain.task_management.value_objects.task_status import TaskStatus
from src.domain.task_management.value_objects.task_priority import TaskPriority
from src.domain.user_management.value_objects.user_id import UserId


class TestTaskEntity:
    """Test cases for Task entity."""

    def test_create_task_success(self):
        """Test successful task creation."""
        # Arrange
        task_id = TaskId.generate()
        title = "Test Task"
        description = "Test task description"
        assignee_id = UserId.generate()
        creator_id = UserId.generate()
        priority = TaskPriority.MEDIUM
        status = TaskStatus.TODO

        # Act
        task = Task(
            id=task_id,
            title=title,
            description=description,
            assignee_id=assignee_id,
            creator_id=creator_id,
            priority=priority,
            status=status
        )

        # Assert
        assert task.id == task_id
        assert task.title == title
        assert task.description == description
        assert task.assignee_id == assignee_id
        assert task.creator_id == creator_id
        assert task.priority == priority
        assert task.status == status
        assert task.created_at is not None
        assert task.updated_at is not None

    def test_task_equality(self):
        """Test task equality based on ID."""
        # Arrange
        task_id = TaskId.generate()
        assignee_id = UserId.generate()
        creator_id = UserId.generate()

        task1 = Task(
            id=task_id,
            title="Task 1",
            description="Description 1",
            assignee_id=assignee_id,
            creator_id=creator_id,
            priority=TaskPriority.HIGH,
            status=TaskStatus.TODO
        )

        task2 = Task(
            id=task_id,
            title="Task 2",
            description="Description 2",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.LOW,
            status=TaskStatus.IN_PROGRESS
        )

        # Act & Assert
        assert task1 == task2
        assert hash(task1) == hash(task2)

    def test_change_status(self):
        """Test task status change."""
        # Arrange
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO
        )

        # Act
        task.change_status(TaskStatus.IN_PROGRESS)

        # Assert
        assert task.status == TaskStatus.IN_PROGRESS

    def test_change_priority(self):
        """Test task priority change."""
        # Arrange
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO
        )

        # Act
        task.change_priority(TaskPriority.HIGH)

        # Assert
        assert task.priority == TaskPriority.HIGH

    def test_assign_task(self):
        """Test task assignment."""
        # Arrange
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO
        )
        new_assignee_id = UserId.generate()

        # Act
        task.assign(new_assignee_id)

        # Assert
        assert task.assignee_id == new_assignee_id

    def test_set_due_date(self):
        """Test setting due date."""
        # Arrange
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO
        )
        due_date = datetime.now() + timedelta(days=7)

        # Act
        task.set_due_date(due_date)

        # Assert
        assert task.due_date == due_date

    def test_add_tag(self):
        """Test adding tag to task."""
        # Arrange
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO
        )

        # Act
        task.add_tag("urgent")

        # Assert
        assert "urgent" in task.tags

    def test_remove_tag(self):
        """Test removing tag from task."""
        # Arrange
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO,
            tags=["urgent", "important"]
        )

        # Act
        task.remove_tag("urgent")

        # Assert
        assert "urgent" not in task.tags
        assert "important" in task.tags

    def test_is_overdue(self):
        """Test overdue task detection."""
        # Arrange
        past_date = datetime.now() - timedelta(days=1)
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO,
            due_date=past_date
        )

        # Act & Assert
        assert task.is_overdue() is True

    def test_is_not_overdue(self):
        """Test non-overdue task detection."""
        # Arrange
        future_date = datetime.now() + timedelta(days=1)
        task = Task(
            id=TaskId.generate(),
            title="Test Task",
            description="Test description",
            assignee_id=UserId.generate(),
            creator_id=UserId.generate(),
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO,
            due_date=future_date
        )

        # Act & Assert
        assert task.is_overdue() is False
