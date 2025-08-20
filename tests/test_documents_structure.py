"""
Структурные тесты для системы документооборота
"""
import pytest
import os
import ast
from pathlib import Path

class TestDocumentsStructure:
    """Тесты структуры системы документооборота"""
    
    def test_documents_router_file_exists(self):
        """Тест существования файла роутера документов"""
        router_path = "backend/api/routers/documents/router.py"
        assert os.path.exists(router_path), f"Router file not found: {router_path}"
    
    def test_documents_model_file_exists(self):
        """Тест существования файла моделей документов"""
        model_path = "core/database/models/document_model.py"
        assert os.path.exists(model_path), f"Model file not found: {model_path}"
    
    def test_documents_router_structure(self):
        """Тест структуры роутера документов"""
        router_path = "backend/api/routers/documents/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные компоненты
        assert 'router = APIRouter(prefix="/api/documents", tags=["documents"])' in content
        assert 'class DocumentCreateRequest(BaseModel):' in content
        assert 'class DocumentUpdateRequest(BaseModel):' in content
        assert 'class DocumentResponse(BaseModel):' in content
        assert '@router.post("/", response_model=DocumentResponse)' in content
        assert '@router.get("/", response_model=List[DocumentResponse])' in content
        assert '@router.get("/{document_id}", response_model=DocumentResponse)' in content
        assert '@router.put("/{document_id}", response_model=DocumentResponse)' in content
        assert '@router.delete("/{document_id}")' in content
    
    def test_documents_model_structure(self):
        """Тест структуры моделей документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные компоненты
        assert 'class DocumentStatus(str, Enum):' in content
        assert 'class DocumentType(str, Enum):' in content
        assert 'class DocumentPriority(str, Enum):' in content
        assert 'class DocumentVisibility(str, Enum):' in content
        assert 'class Document(Base):' in content
        assert 'class DocumentWorkflowStep(Base):' in content
        assert 'class DocumentSignature(Base):' in content
        assert 'class DocumentComment(Base):' in content
        assert 'class DocumentAttachment(Base):' in content
        assert 'class DocumentWatcher(Base):' in content
        assert 'class DocumentTemplate(Base):' in content
    
    def test_documents_endpoints_defined(self):
        """Тест определения эндпоинтов документов"""
        router_path = "backend/api/routers/documents/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных эндпоинтов
        endpoints = [
            "@router.post(\"/\", response_model=DocumentResponse)",
            "@router.get(\"/\", response_model=List[DocumentResponse])",
            "@router.get(\"/{document_id}\", response_model=DocumentResponse)",
            "@router.put(\"/{document_id}\", response_model=DocumentResponse)",
            "@router.delete(\"/{document_id}\")",
            "@router.post(\"/{document_id}/workflow\", response_model=Dict[str, Any])",
            "@router.post(\"/{document_id}/sign\", response_model=Dict[str, Any])",
            "@router.post(\"/{document_id}/comments\", response_model=Dict[str, Any])",
            "@router.get(\"/{document_id}/versions\", response_model=List[DocumentResponse])",
            "@router.post(\"/{document_id}/archive\")"
        ]
        
        for endpoint in endpoints:
            assert endpoint in content, f"Endpoint not found: {endpoint}"
    
    def test_documents_models_defined(self):
        """Тест определения моделей документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных моделей
        models = [
            "class Document(Base):",
            "class DocumentWorkflowStep(Base):",
            "class DocumentSignature(Base):",
            "class DocumentComment(Base):",
            "class DocumentAttachment(Base):",
            "class DocumentWatcher(Base):",
            "class DocumentTemplate(Base):"
        ]
        
        for model in models:
            assert model in content, f"Model not found: {model}"
    
    def test_documents_model_fields(self):
        """Тест полей моделей документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные поля Document
        document_fields = [
            "id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)",
            "title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)",
            "description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)",
            "document_type: Mapped[DocumentType] = mapped_column(SQLEnum(DocumentType), default=DocumentType.OTHER, index=True)",
            "status: Mapped[DocumentStatus] = mapped_column(SQLEnum(DocumentStatus), default=DocumentStatus.DRAFT, index=True)",
            "priority: Mapped[DocumentPriority] = mapped_column(SQLEnum(DocumentPriority), default=DocumentPriority.NORMAL, index=True)",
            "visibility: Mapped[DocumentVisibility] = mapped_column(SQLEnum(DocumentVisibility), default=DocumentVisibility.TEAM)",
            "version: Mapped[int] = mapped_column(Integer, default=1, index=True)",
            "is_latest: Mapped[bool] = mapped_column(Boolean, default=True, index=True)",
            "created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())",
            "updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())"
        ]
        
        for field in document_fields:
            assert field in content, f"Document field not found: {field}"
    
    def test_documents_enums(self):
        """Тест перечислений документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения enum DocumentStatus
        status_values = [
            'DRAFT = "draft"',
            'PENDING_REVIEW = "pending_review"',
            'IN_REVIEW = "in_review"',
            'APPROVED = "approved"',
            'REJECTED = "rejected"',
            'SIGNED = "signed"',
            'ARCHIVED = "archived"',
            'EXPIRED = "expired"'
        ]
        
        for value in status_values:
            assert value in content, f"DocumentStatus value not found: {value}"
        
        # Проверяем значения enum DocumentType
        type_values = [
            'CONTRACT = "contract"',
            'AGREEMENT = "agreement"',
            'POLICY = "policy"',
            'PROCEDURE = "procedure"',
            'REPORT = "report"',
            'MEMO = "memo"',
            'LETTER = "letter"',
            'FORM = "form"',
            'TEMPLATE = "template"',
            'OTHER = "other"'
        ]
        
        for value in type_values:
            assert value in content, f"DocumentType value not found: {value}"
    
    def test_documents_relationships(self):
        """Тест отношений моделей документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем основные отношения
        relationships = [
            "author: Mapped[\"User\"] = relationship(\"User\", back_populates=\"authored_documents\", foreign_keys=[author_id])",
            "owner: Mapped[\"User\"] = relationship(\"User\", back_populates=\"owned_documents\", foreign_keys=[owner_id])",
            "reviewer: Mapped[Optional[\"User\"]] = relationship(\"User\", back_populates=\"reviewed_documents\", foreign_keys=[reviewer_id])",
            "workflow_steps: Mapped[List[\"DocumentWorkflowStep\"]] = relationship(\"DocumentWorkflowStep\", back_populates=\"document\", cascade=\"all, delete-orphan\")",
            "signatures: Mapped[List[\"DocumentSignature\"]] = relationship(\"DocumentSignature\", back_populates=\"document\", cascade=\"all, delete-orphan\")",
            "comments: Mapped[List[\"DocumentComment\"]] = relationship(\"DocumentComment\", back_populates=\"document\", cascade=\"all, delete-orphan\")",
            "attachments: Mapped[List[\"DocumentAttachment\"]] = relationship(\"DocumentAttachment\", back_populates=\"document\", cascade=\"all, delete-orphan\")",
            "watchers: Mapped[List[\"DocumentWatcher\"]] = relationship(\"DocumentWatcher\", back_populates=\"document\", cascade=\"all, delete-orphan\")"
        ]
        
        for relationship in relationships:
            assert relationship in content, f"Relationship not found: {relationship}"
    
    def test_documents_table_names(self):
        """Тест имен таблиц документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем имена таблиц (SQLAlchemy автоматически генерирует имена из имен классов)
        table_references = [
            'ForeignKey("documents.id")',
            'ForeignKey("users.id")',
            'ForeignKey("organizations.id")',
            'ForeignKey("departments.id")'
        ]
        
        for table_ref in table_references:
            assert table_ref in content, f"Table reference not found: {table_ref}"
    
    def test_documents_foreign_keys(self):
        """Тест внешних ключей документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем внешние ключи
        foreign_keys = [
            'ForeignKey("users.id")',
            'ForeignKey("organizations.id")',
            'ForeignKey("departments.id")',
            'ForeignKey("documents.id")'
        ]
        
        for fk in foreign_keys:
            assert fk in content, f"Foreign key not found: {fk}"
    
    def test_documents_indexes(self):
        """Тест индексов документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем индексы
        indexes = [
            'index=True'
        ]
        
        for index in indexes:
            assert index in content, f"Index not found: {index}"
    
    def test_documents_defaults(self):
        """Тест значений по умолчанию документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения по умолчанию
        defaults = [
            'default=DocumentType.OTHER',
            'default=DocumentStatus.DRAFT',
            'default=DocumentPriority.NORMAL',
            'default=DocumentVisibility.TEAM',
            'default=1',
            'default=True'
        ]
        
        for default in defaults:
            assert default in content, f"Default value not found: {default}"
    
    def test_documents_imports_correct(self):
        """Тест корректности импортов в роутере документов"""
        router_path = "backend/api/routers/documents/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие необходимых импортов
        imports = [
            "from fastapi import APIRouter",
            "from backend.api.configuration.auth import verify_authorization",
            "from core.database.models.document_model import",
            "from core.database.models.main_models import User, Organization, Department"
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_documents_model_imports_correct(self):
        """Тест корректности импортов в моделях документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие необходимых импортов
        imports = [
            "from sqlalchemy import DateTime, ForeignKey",
            "from sqlalchemy.orm import Mapped, mapped_column, relationship",
            "from datetime import datetime",
            "from enum import Enum",
            "from core.database.base import Base"
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_documents_router_syntax_valid(self):
        """Тест валидности синтаксиса роутера документов"""
        router_path = "backend/api/routers/documents/router.py"
        
        try:
            with open(router_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Пытаемся распарсить файл
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in documents router: {e}")
    
    def test_documents_model_syntax_valid(self):
        """Тест валидности синтаксиса моделей документов"""
        model_path = "core/database/models/document_model.py"
        
        try:
            with open(model_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Пытаемся распарсить файл
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in documents models: {e}")
    
    def test_documents_directory_structure(self):
        """Тест структуры директорий документов"""
        # Проверяем существование директорий
        directories = [
            "backend/api/routers/documents",
            "core/database/models"
        ]
        
        for directory in directories:
            assert os.path.exists(directory), f"Directory not found: {directory}"
            assert os.path.isdir(directory), f"Not a directory: {directory}"
    
    def test_documents_files_readable(self):
        """Тест читаемости файлов документов"""
        files = [
            "backend/api/routers/documents/router.py",
            "core/database/models/document_model.py"
        ]
        
        for file_path in files:
            assert os.path.exists(file_path), f"File not found: {file_path}"
            assert os.access(file_path, os.R_OK), f"File not readable: {file_path}"
    
    def test_documents_router_has_docstrings(self):
        """Тест наличия документации в роутере документов"""
        router_path = "backend/api/routers/documents/router.py"
        
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие документации
        assert '"""API для управления документами и документооборота"""' in content or '"""\nAPI для управления документами и документооборота\n"""' in content
        assert '"""Запрос на создание документа"""' in content
        assert '"""Ответ с данными документа"""' in content
    
    def test_documents_model_has_docstrings(self):
        """Тест наличия документации в моделях документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие документации
        assert '"""Статусы документов"""' in content
        assert '"""Типы документов"""' in content
        assert '"""Приоритеты документов"""' in content
        assert '"""Видимость документов"""' in content
    
    def test_documents_model_completeness(self):
        """Тест полноты моделей документов"""
        model_path = "core/database/models/document_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, что все основные компоненты присутствуют
        components = [
            "class Document(Base):",
            "class DocumentWorkflowStep(Base):",
            "class DocumentSignature(Base):",
            "class DocumentComment(Base):",
            "class DocumentAttachment(Base):",
            "class DocumentWatcher(Base):",
            "class DocumentTemplate(Base):",
            "mapped_column(BigInteger, primary_key=True, autoincrement=True)",
            "relationship(",
            "ForeignKey(",
            "func.now()"
        ]
        
        for component in components:
            assert component in content, f"Component not found: {component}"
