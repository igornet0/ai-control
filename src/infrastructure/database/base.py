"""
Database base classes and configuration.
Migrated from core/database/base.py with improvements.
"""

from sqlalchemy import MetaData, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

from src.infrastructure.config.settings import get_settings
from src.infrastructure.utils.case_converter import camel_case_to_snake_case


class Base(DeclarativeBase):
    """Base class for all database models."""
    
    __abstract__ = True

    # Common timestamp fields
    created: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Metadata configuration
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_N_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )

    @declared_attr.directive
    def __tablename__(cls) -> str:
        """Generate table name from class name."""
        return f"{camel_case_to_snake_case(cls.__name__)}s"
