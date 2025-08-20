"""
Тесты для проверки структуры KPI моделей
"""

import pytest
import os
import ast

class TestKPIModels:
    """Тесты структуры KPI моделей"""
    
    def test_kpi_model_file_exists(self):
        """Тест существования файла KPI моделей"""
        model_path = "core/database/models/kpi_model.py"
        assert os.path.exists(model_path), f"KPI model file not found: {model_path}"
    
    def test_kpi_model_structure(self):
        """Тест структуры KPI моделей"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных классов
        assert "class KPIType(str, Enum)" in content
        assert "class KPITrend(str, Enum)" in content
        assert "class KPIStatus(str, Enum)" in content
        assert "class KPI(Base)" in content
        assert "class KPICalculation(Base)" in content
        assert "class KPITemplate(Base)" in content
        assert "class KPINotification(Base)" in content
        assert "class KPISchedule(Base)" in content
    
    def test_kpi_model_imports(self):
        """Тест импортов в KPI моделях"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие необходимых импортов
        imports = [
            "from sqlalchemy import",
            "from sqlalchemy.orm import Mapped, mapped_column, relationship",
            "from datetime import datetime",
            "from enum import Enum",
            "from core.database.base import Base"
        ]
        
        for import_stmt in imports:
            assert import_stmt in content, f"Import not found: {import_stmt}"
    
    def test_kpi_model_syntax_valid(self):
        """Тест валидности синтаксиса KPI моделей"""
        model_path = "core/database/models/kpi_model.py"
        
        try:
            with open(model_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Пытаемся распарсить файл
            ast.parse(content)
        except SyntaxError as e:
            pytest.fail(f"Syntax error in KPI models: {e}")
    
    def test_kpi_model_has_docstrings(self):
        """Тест наличия документации в KPI моделях"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие документации
        assert '"""Модели базы данных для KPI"""' in content or '"""\nМодели базы данных для KPI\n"""' in content
        assert '"""Типы KPI"""' in content
        assert '"""Тренды KPI"""' in content
        assert '"""Статусы KPI"""' in content
        assert '"""Модель KPI"""' in content
    
    def test_kpi_model_fields(self):
        """Тест полей KPI моделей"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных полей в KPI
        kpi_fields = [
            "id: Mapped[int]",
            "name: Mapped[str]",
            "description: Mapped[Optional[str]]",
            "formula: Mapped[str]",
            "data_source: Mapped[Dict[str, Any]]",
            "target_value: Mapped[Optional[float]]",
            "is_active: Mapped[bool]",
            "category: Mapped[str]"
        ]
        
        for field in kpi_fields:
            assert field in content, f"Field not found in KPI model: {field}"
    
    def test_kpi_calculation_fields(self):
        """Тест полей KPICalculation"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие основных полей в KPICalculation
        calculation_fields = [
            "id: Mapped[int]",
            "calculation_id: Mapped[str]",
            "value: Mapped[float]",
            "target_value: Mapped[Optional[float]]",
            "previous_value: Mapped[Optional[float]]",
            "trend: Mapped[KPITrend]",
            "status: Mapped[KPIStatus]",
            "calculated_at: Mapped[datetime]"
        ]
        
        for field in calculation_fields:
            assert field in content, f"Field not found in KPICalculation model: {field}"
    
    def test_kpi_relationships(self):
        """Тест связей KPI моделей"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие связей
        relationships = [
            "created_by_user: Mapped[\"User\"]",
            "organization: Mapped[Optional[\"Organization\"]]",
            "department: Mapped[Optional[\"Department\"]]",
            "calculations: Mapped[List[\"KPICalculation\"]]",
            "kpi: Mapped[Optional[\"KPI\"]]",
            "calculated_by_user: Mapped[\"User\"]"
        ]
        
        for relationship in relationships:
            assert relationship in content, f"Relationship not found: {relationship}"
    
    def test_kpi_enums(self):
        """Тест перечислений KPI"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения перечислений
        kpi_type_values = [
            "NUMERIC = \"numeric\"",
            "PERCENTAGE = \"percentage\"",
            "CURRENCY = \"currency\"",
            "RATIO = \"ratio\"",
            "COUNTER = \"counter\"",
            "TREND = \"trend\""
        ]
        
        for value in kpi_type_values:
            assert value in content, f"KPIType value not found: {value}"
        
        kpi_trend_values = [
            "UP = \"up\"",
            "DOWN = \"down\"",
            "STABLE = \"stable\"",
            "UNKNOWN = \"unknown\""
        ]
        
        for value in kpi_trend_values:
            assert value in content, f"KPITrend value not found: {value}"
        
        kpi_status_values = [
            "NORMAL = \"normal\"",
            "WARNING = \"warning\"",
            "CRITICAL = \"critical\"",
            "SUCCESS = \"success\"",
            "ERROR = \"error\""
        ]
        
        for value in kpi_status_values:
            assert value in content, f"KPIStatus value not found: {value}"
    
    def test_kpi_table_names(self):
        """Тест имен таблиц KPI"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем имена таблиц
        table_names = [
            '__tablename__ = "kpis"',
            '__tablename__ = "kpi_calculations"',
            '__tablename__ = "kpi_templates"',
            '__tablename__ = "kpi_notifications"',
            '__tablename__ = "kpi_schedules"'
        ]
        
        for table_name in table_names:
            assert table_name in content, f"Table name not found: {table_name}"
    
    def test_kpi_foreign_keys(self):
        """Тест внешних ключей KPI"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем внешние ключи
        foreign_keys = [
            'ForeignKey("users.id")',
            'ForeignKey("organizations.id")',
            'ForeignKey("departments.id")',
            'ForeignKey("kpis.id")'
        ]
        
        for fk in foreign_keys:
            assert fk in content, f"Foreign key not found: {fk}"
    
    def test_kpi_indexes(self):
        """Тест индексов KPI"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем индексы
        indexes = [
            'index=True',
            'unique=True, index=True'
        ]
        
        for index in indexes:
            assert index in content, f"Index not found: {index}"
    
    def test_kpi_defaults(self):
        """Тест значений по умолчанию KPI"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем значения по умолчанию
        defaults = [
            'default=30',
            'default=3600',
            'default=True',
            'default="general"',
            'default=KPIType.NUMERIC',
            'default=KPITrend.UNKNOWN',
            'default=KPIStatus.NORMAL'
        ]
        
        for default in defaults:
            assert default in content, f"Default value not found: {default}"
    
    def test_kpi_metadata_fields(self):
        """Тест метаданных KPI"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем поля метаданных
        metadata_fields = [
            'created_at: Mapped[datetime]',
            'updated_at: Mapped[datetime]',
            'last_calculation: Mapped[Optional[datetime]]',
            'calculation_metadata: Mapped[Optional[Dict[str, Any]]]',
            'insights: Mapped[Optional[Dict[str, Any]]]'
        ]
        
        for field in metadata_fields:
            assert field in content, f"Metadata field not found: {field}"
    
    def test_kpi_file_readable(self):
        """Тест читаемости файла KPI моделей"""
        model_path = "core/database/models/kpi_model.py"
        
        assert os.path.exists(model_path), f"File not found: {model_path}"
        assert os.access(model_path, os.R_OK), f"File not readable: {model_path}"
    
    def test_kpi_model_completeness(self):
        """Тест полноты KPI моделей"""
        model_path = "core/database/models/kpi_model.py"
        
        with open(model_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, что все основные компоненты присутствуют
        components = [
            "class KPI(Base):",
            "class KPICalculation(Base):",
            "class KPITemplate(Base):",
            "class KPINotification(Base):",
            "class KPISchedule(Base):",
            "mapped_column(BigInteger, primary_key=True, autoincrement=True)",
            "relationship(",
            "ForeignKey(",
            "func.now()"
        ]
        
        for component in components:
            assert component in content, f"Component not found: {component}"
