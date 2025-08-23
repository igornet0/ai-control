"""
Модели для системы поиска по всем данным
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, JSON, 
    ForeignKey, Index, UniqueConstraint, BigInteger, Float
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.declarative import declarative_base

from core.database.engine import Base


class SearchIndexType(str, Enum):
    """Типы индексов поиска"""
    TASK = "task"
    EMAIL = "email"
    CHAT = "chat"
    DOCUMENT = "document"
    USER = "user"
    DASHBOARD = "dashboard"
    KPI = "kpi"
    VIDEO_CALL = "video_call"
    NOTIFICATION = "notification"


class SearchResultType(str, Enum):
    """Типы результатов поиска"""
    TASK = "task"
    EMAIL = "email"
    CHAT_MESSAGE = "chat_message"
    DOCUMENT = "document"
    USER = "user"
    DASHBOARD = "dashboard"
    KPI = "kpi"
    VIDEO_CALL = "video_call"
    NOTIFICATION = "notification"


class SearchIndex(Base):
    """Индекс поиска"""
    __tablename__ = "search_indexes"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    index_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    
    # Основная информация
    entity_type: Mapped[SearchIndexType] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    
    # Поисковые данные
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    keywords: Mapped[List[str]] = mapped_column(JSON, default=list)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Метаданные
    search_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    permissions: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    # Рейтинг и статистика
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    last_accessed: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Временные метки
    indexed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_search_indexes_entity", "entity_type", "entity_id"),
        Index("idx_search_indexes_title", "title"),
        Index("idx_search_indexes_relevance", "relevance_score"),
        Index("idx_search_indexes_updated", "updated_at"),
        UniqueConstraint("entity_type", "entity_id", name="uq_search_index_entity"),
    )


class SearchQuery(Base):
    """История поисковых запросов"""
    __tablename__ = "search_queries"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    query_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    
    # Пользователь
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    
    # Запрос
    query_text: Mapped[str] = mapped_column(String(1000), nullable=False)
    query_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # для дедупликации
    
    # Фильтры
    entity_types: Mapped[List[str]] = mapped_column(JSON, default=list)
    date_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_to: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Результаты
    results_count: Mapped[int] = mapped_column(Integer, default=0)
    execution_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    
    # Статистика
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_search_queries_user", "user_id"),
        Index("idx_search_queries_hash", "query_hash"),
        Index("idx_search_queries_created", "created_at"),
        Index("idx_search_queries_saved", "is_saved"),
    )


class SearchResult(Base):
    """Результаты поиска"""
    __tablename__ = "search_results"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Связь с запросом
    query_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("search_queries.id"), nullable=False)
    
    # Результат
    result_type: Mapped[SearchResultType] = mapped_column(String(50), nullable=False)
    result_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    
    # Рейтинг
    relevance_score: Mapped[float] = mapped_column(Float, nullable=False)
    rank_position: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Метаданные
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    search_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Отношения
    query: Mapped["SearchQuery"] = relationship("SearchQuery", back_populates="results")
    
    __table_args__ = (
        Index("idx_search_results_query", "query_id"),
        Index("idx_search_results_type", "result_type", "result_id"),
        Index("idx_search_results_relevance", "relevance_score"),
        Index("idx_search_results_rank", "rank_position"),
    )


class SavedSearch(Base):
    """Сохраненные поиски"""
    __tablename__ = "saved_searches"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    saved_search_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    
    # Пользователь
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    
    # Название и описание
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Параметры поиска
    query_text: Mapped[str] = mapped_column(String(1000), nullable=False)
    entity_types: Mapped[List[str]] = mapped_column(JSON, default=list)
    date_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_to: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Настройки
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Статистика
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_saved_searches_user", "user_id"),
        Index("idx_saved_searches_public", "is_public"),
        Index("idx_saved_searches_default", "is_default"),
        Index("idx_saved_searches_usage", "usage_count"),
        Index("idx_saved_searches_uuid", "saved_search_uuid"),
    )


class SearchAnalytics(Base):
    """Аналитика поиска"""
    __tablename__ = "search_analytics"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Дата
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    # Статистика
    total_queries: Mapped[int] = mapped_column(Integer, default=0)
    unique_users: Mapped[int] = mapped_column(Integer, default=0)
    avg_results_per_query: Mapped[float] = mapped_column(Float, default=0.0)
    avg_execution_time_ms: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Популярные запросы
    popular_queries: Mapped[Dict[str, int]] = mapped_column(JSON, default=dict)
    popular_entity_types: Mapped[Dict[str, int]] = mapped_column(JSON, default=dict)
    
    # Конверсия
    queries_with_results: Mapped[int] = mapped_column(Integer, default=0)
    queries_without_results: Mapped[int] = mapped_column(Integer, default=0)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_search_analytics_date", "date"),
        UniqueConstraint("date", name="uq_search_analytics_date"),
    )


class SearchSuggestion(Base):
    """Поисковые подсказки"""
    __tablename__ = "search_suggestions"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Подсказка
    suggestion_text: Mapped[str] = mapped_column(String(500), nullable=False)
    suggestion_type: Mapped[str] = mapped_column(String(50), nullable=False)  # query, tag, entity
    
    # Статистика
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Метаданные
    search_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_search_suggestions_text", "suggestion_text"),
        Index("idx_search_suggestions_type", "suggestion_type"),
        Index("idx_search_suggestions_usage", "usage_count"),
        UniqueConstraint("suggestion_text", "suggestion_type", name="uq_search_suggestion"),
    )


# Добавляем отношения
SearchQuery.results = relationship("SearchResult", back_populates="query")
