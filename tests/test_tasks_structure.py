"""
Тесты для проверки структуры API задач
"""

import pytest
import os
import ast

class TestTasksStructure:
    """Тесты структуры API задач"""
    
    def test_tasks_router_file_exists(self):
        """Тест существования файла роутера задач"""
        router_path = "backend/api/routers/tasks/router.py"
        assert os.path.exists(router_path), f"Tasks router file not found: {router_path}"
    
    def test_tasks_model_file_exists(self):
        """Тест существования файла моделей задач"""
        model_path = "core/database/models/task_model.py"
        assert os.path.exists(model_path), f"Tasks model file not found: {model_path}"
    
    def test_tasks_router_structure(self):
        """Тест структуры роутера задач"""
        router_path = "backend/api/routers/tasks/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных импортов
        assert "from fastapi import APIRouter" in content
        assert "router = APIRouter" in content
        assert 'prefix="/api/tasks"' in content
        
        # Проверяем наличие основных классов
        assert "class TaskCreateRequest" in content
        assert "class TaskUpdateRequest" in content
        assert "class TaskResponse" in content
        assert "class TaskCommentCreateRequest" in content
        assert "class TaskTimeLogCreateRequest" in content
    
    def test_tasks_model_structure(self):
        """Тест структуры моделей задач"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных классов
        assert "class TaskStatus(str, Enum)" in content
        assert "class TaskPriority(str, Enum)" in content
        assert "class TaskType(str, Enum)" in content
        assert "class TaskVisibility(str, Enum)" in content
        assert "class Task(Base)" in content
        assert "class TaskComment(Base)" in content
        assert "class TaskTimeLog(Base)" in content
        assert "class TaskDependency(Base)" in content
        assert "class TaskWatcher(Base)" in content
        assert "class TaskLabel(Base)" in content
        assert "class TaskTemplate(Base)" in content
    
    def test_tasks_endpoints_defined(self):
        """Тест определения эндпоинтов задач"""
        router_path = "backend/api/routers/tasks/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных эндпоинтов
        endpoints = [
            "@router.post(\"/\", response_model=TaskResponse)",
            "@router.get(\"/\", response_model=List[TaskResponse])",
            "@router.get(\"/{task_id}\", response_model=TaskResponse)",
            "@router.put(\"/{task_id}\", response_model=TaskResponse)",
            "@router.delete(\"/{task_id}\")"
        ]
        
        for endpoint in endpoints:
            assert endpoint in content, f"Endpoint not found: {endpoint}"
    
    def test_tasks_models_defined(self):
        """Тест определения моделей задач"""
        router_path = "backend/api/routers/tasks/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие всех моделей
        models = [
            "TaskCreateRequest",
            "TaskUpdateRequest", 
            "TaskResponse",
            "TaskCommentCreateRequest",
            "TaskCommentResponse",
            "TaskTimeLogCreateRequest",
            "TaskTimeLogResponse",
            "TaskDependencyCreateRequest",
            "TaskDependencyResponse",
            "TaskWatcherCreateRequest",
            "TaskWatcherResponse",
            "TaskLabelCreateRequest",
            "TaskLabelResponse",
            "TaskTemplateCreateRequest",
            "TaskTemplateResponse"
        ]
        
        for model in models:
            assert f"class {model}" in content, f"Model not found: {model}"
    
    def test_tasks_model_fields(self):
        """Тест полей модели Task"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных полей в Task
        task_fields = [
            "id: Mapped[int]",
            "title: Mapped[str]",
            "description: Mapped[Optional[str]]",
            "status: Mapped[TaskStatus]",
            "priority: Mapped[TaskPriority]",
            "task_type: Mapped[TaskType]",
            "visibility: Mapped[TaskVisibility]",
            "parent_id: Mapped[Optional[int]]",
            "epic_id: Mapped[Optional[int]]",
            "created_at: Mapped[datetime]",
            "updated_at: Mapped[datetime]",
            "due_date: Mapped[Optional[datetime]]",
            "estimated_hours: Mapped[Optional[float]]",
            "actual_hours: Mapped[Optional[float]]",
            "progress_percentage: Mapped[int]",
            "owner_id: Mapped[int]",
            "executor_id: Mapped[Optional[int]]",
            "reviewer_id: Mapped[Optional[int]]"
        ]
        
        for field in task_fields:
            assert field in content, f"Field not found in Task model: {field}"
    
    def test_tasks_enums(self):
        """Тест перечислений задач"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения перечислений TaskStatus
        task_status_values = [
            "CREATED = \"created\"",
            "IN_PROGRESS = \"in_progress\"",
            "REVIEW = \"review\"",
            "COMPLETED = \"completed\"",
            "CANCELLED = \"cancelled\"",
            "ON_HOLD = \"on_hold\"",
            "BLOCKED = \"blocked\""
        ]
        
        for value in task_status_values:
            assert value in content, f"TaskStatus value not found: {value}"
        
        # Проверяем значения перечислений TaskPriority
        task_priority_values = [
            "LOW = \"low\"",
            "MEDIUM = \"medium\"",
            "HIGH = \"high\"",
            "CRITICAL = \"critical\"",
            "URGENT = \"urgent\""
        ]
        
        for value in task_priority_values:
            assert value in content, f"TaskPriority value not found: {value}"
        
        # Проверяем значения перечислений TaskType
        task_type_values = [
            "TASK = \"task\"",
            "BUG = \"bug\"",
            "FEATURE = \"feature\"",
            "STORY = \"story\"",
            "EPIC = \"epic\"",
            "SUBTASK = \"subtask\""
        ]
        
        for value in task_type_values:
            assert value in content, f"TaskType value not found: {value}"
        
        # Проверяем значения перечислений TaskVisibility
        task_visibility_values = [
            "PUBLIC = \"public\"",
            "PRIVATE = \"private\"",
            "TEAM = \"team\"",
            "DEPARTMENT = \"department\"",
            "ORGANIZATION = \"organization\""
        ]
        
        for value in task_visibility_values:
            assert value in content, f"TaskVisibility value not found: {value}"
    
    def test_tasks_relationships(self):
        """Тест связей моделей задач"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие связей
        relationships = [
            "owner: Mapped[\"User\"]",
            "executor: Mapped[Optional[\"User\"]]",
            "reviewer: Mapped[Optional[\"User\"]]",
            "parent: Mapped[Optional[\"Task\"]]",
            "subtasks: Mapped[List[\"Task\"]]",
            "epic: Mapped[Optional[\"Task\"]]",
            "epic_tasks: Mapped[List[\"Task\"]]",
            "organization: Mapped[Optional[\"Organization\"]]",
            "department: Mapped[Optional[\"Department\"]]",
            "comments: Mapped[List[\"TaskComment\"]]",
            "time_logs: Mapped[List[\"TaskTimeLog\"]]",
            "dependencies: Mapped[List[\"TaskDependency\"]]",
            "watchers: Mapped[List[\"TaskWatcher\"]]",
            "labels: Mapped[List[\"TaskLabel\"]]"
        ]
        
        for relationship in relationships:
            assert relationship in content, f"Relationship not found: {relationship}"
    
    def test_tasks_table_names(self):
        """Тест имен таблиц задач"""
        model_path = "core/database/models/task_model.py"
    
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
    
        # Проверяем имена таблиц (SQLAlchemy автоматически генерирует имена из имен классов)
        # В нашем случае используются стандартные имена таблиц
        table_references = [
            'ForeignKey("tasks.id")',
            'ForeignKey("task_columns.id")'
        ]
    
        for table_ref in table_references:
            assert table_ref in content, f"Table reference not found: {table_ref}"
    
    def test_tasks_foreign_keys(self):
        """Тест внешних ключей задач"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем внешние ключи
        foreign_keys = [
            'ForeignKey("users.id")',
            'ForeignKey("organizations.id")',
            'ForeignKey("departments.id")',
            'ForeignKey("tasks.id")'
        ]
        
        for fk in foreign_keys:
            assert fk in content, f"Foreign key not found: {fk}"
    
    def test_tasks_indexes(self):
        """Тест индексов задач"""
        model_path = "core/database/models/task_model.py"
    
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
    
        # Проверяем индексы
        indexes = [
            'index=True'
        ]
    
        for index in indexes:
            assert index in content, f"Index not found: {index}"
    
    def test_tasks_defaults(self):
        """Тест значений по умолчанию задач"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения по умолчанию
        defaults = [
            'default=TaskStatus.CREATED',
            'default=TaskPriority.MEDIUM',
            'default=TaskType.TASK',
            'default=TaskVisibility.TEAM',
            'default=0',
            'default=True'
        ]
        
        for default in defaults:
            assert default in content, f"Default value not found: {default}"
    
    def test_tasks_imports_correct(self):
        """Тест корректности импортов в роутере задач"""
        router_path = "backend/api/routers/tasks/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие необходимых импортов
        imports = [
            "from fastapi import APIRouter",
            "from backend.api.configuration.auth import verify_authorization",
            "from core.database.models.task_model import",
            "from core.database.models.main_models import User, Organization, Department"
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_tasks_model_imports_correct(self):
        """Тест корректности импортов в моделях задач"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие необходимых импортов
        imports = [
            "from typing import",
            "from sqlalchemy import",
            "from sqlalchemy.orm import Mapped, mapped_column, relationship",
            "from datetime import datetime",
            "from enum import Enum",
            "from core.database.base import Base"
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_tasks_router_syntax_valid(self):
        """Тест валидности синтаксиса роутера задач"""
        router_path = "backend/api/routers/tasks/router.py"
        
        try:
            with open(router_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Пытаемся распарсить файл
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in tasks router: {e}")
    
    def test_tasks_model_syntax_valid(self):
        """Тест валидности синтаксиса моделей задач"""
        model_path = "core/database/models/task_model.py"
        
        try:
            with open(model_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Пытаемся распарсить файл
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in tasks models: {e}")
    
    def test_tasks_directory_structure(self):
        """Тест структуры директорий задач"""
        # Проверяем существование директорий
        directories = [
            "backend/api/routers/tasks",
            "core/database/models"
        ]
        
        for directory in directories:
            assert os.path.exists(directory), f"Directory not found: {directory}"
            assert os.path.isdir(directory), f"Not a directory: {directory}"
    
    def test_tasks_files_readable(self):
        """Тест читаемости файлов задач"""
        files = [
            "backend/api/routers/tasks/router.py",
            "core/database/models/task_model.py"
        ]
        
        for file_path in files:
            assert os.path.exists(file_path), f"File not found: {file_path}"
            assert os.access(file_path, os.R_OK), f"File not readable: {file_path}"
    
    def test_tasks_router_has_docstrings(self):
        """Тест наличия документации в роутере задач"""
        router_path = "backend/api/routers/tasks/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие документации
        assert '"""API для управления задачами"""' in content or '"""\nAPI для управления задачами\n"""' in content
        assert '"""Запрос на создание задачи"""' in content
        assert '"""Ответ с данными задачи"""' in content
    
    def test_tasks_model_has_docstrings(self):
        """Тест наличия документации в моделях задач"""
        model_path = "core/database/models/task_model.py"
    
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
    
        # Проверяем наличие документации
        assert '"""Статусы задач"""' in content
        assert '"""Приоритеты задач"""' in content
        assert '"""Типы задач"""' in content
        assert '"""Видимость задач"""' in content
    
    def test_tasks_model_completeness(self):
        """Тест полноты моделей задач"""
        model_path = "core/database/models/task_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, что все основные компоненты присутствуют
        components = [
            "class Task(Base):",
            "class TaskComment(Base):",
            "class TaskTimeLog(Base):",
            "class TaskDependency(Base):",
            "class TaskWatcher(Base):",
            "class TaskLabel(Base):",
            "class TaskTemplate(Base):",
            "mapped_column(BigInteger, primary_key=True, autoincrement=True)",
            "relationship(",
            "ForeignKey(",
            "func.now()"
        ]
        
        for component in components:
            assert component in content, f"Component not found: {component}"
