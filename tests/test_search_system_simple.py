"""
Упрощенные функциональные тесты для системы поиска
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from typing import List, Dict, Any

from core.database.models.search_model import (
    SearchIndexType, SearchResultType,
    SearchIndex, SearchQuery, SearchResult, SavedSearch,
    SearchAnalytics, SearchSuggestion
)
from backend.api.services.search_service import SearchService


class TestSearchSystemSimple:
    """Упрощенные функциональные тесты системы поиска"""
    
    @pytest.fixture
    def mock_session(self):
        """Мок сессии базы данных"""
        session = MagicMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.scalar = AsyncMock()
        session.add = MagicMock()
        session.delete = AsyncMock()
        return session
    
    @pytest.fixture
    def search_service(self, mock_session):
        """Сервис поиска с мок сессией"""
        return SearchService(mock_session)
    
    def test_search_index_type_enum_values(self):
        """Тест значений enum SearchIndexType"""
        assert SearchIndexType.TASK == "task"
        assert SearchIndexType.EMAIL == "email"
        assert SearchIndexType.CHAT == "chat"
        assert SearchIndexType.DOCUMENT == "document"
        assert SearchIndexType.USER == "user"
        assert SearchIndexType.DASHBOARD == "dashboard"
        assert SearchIndexType.KPI == "kpi"
        assert SearchIndexType.VIDEO_CALL == "video_call"
        assert SearchIndexType.NOTIFICATION == "notification"
    
    def test_search_result_type_enum_values(self):
        """Тест значений enum SearchResultType"""
        assert SearchResultType.TASK == "task"
        assert SearchResultType.EMAIL == "email"
        assert SearchResultType.CHAT_MESSAGE == "chat_message"
        assert SearchResultType.DOCUMENT == "document"
        assert SearchResultType.USER == "user"
        assert SearchResultType.DASHBOARD == "dashboard"
        assert SearchResultType.KPI == "kpi"
        assert SearchResultType.VIDEO_CALL == "video_call"
        assert SearchResultType.NOTIFICATION == "notification"
    
    def test_enum_consistency(self):
        """Тест согласованности enum"""
        # Проверяем, что все значения уникальны
        index_types = [e.value for e in SearchIndexType]
        result_types = [e.value for e in SearchResultType]
        
        assert len(index_types) == len(set(index_types))
        assert len(result_types) == len(set(result_types))
        
        # Проверяем, что типы результатов соответствуют типам индексов
        index_type_set = set(index_types)
        result_type_set = set(result_types)
        
        # Некоторые типы результатов могут отличаться от типов индексов
        # (например, CHAT_MESSAGE vs CHAT)
        assert "task" in result_type_set
        assert "email" in result_type_set
        assert "document" in result_type_set
        assert "user" in result_type_set
        assert "dashboard" in result_type_set
        assert "kpi" in result_type_set
        assert "video_call" in result_type_set
        assert "notification" in result_type_set
    
    @pytest.mark.asyncio
    async def test_search_service_initialization(self, mock_session):
        """Тест инициализации SearchService"""
        service = SearchService(mock_session)
        assert service.session == mock_session
    
    @pytest.mark.asyncio
    async def test_generate_query_hash(self, search_service):
        """Тест генерации хеша запроса"""
        query_text = "test query"
        entity_types = ["task", "email"]
        date_from = datetime(2024, 1, 1)
        date_to = datetime(2024, 12, 31)
        tags = ["urgent", "important"]
        
        hash1 = search_service._generate_query_hash(query_text, entity_types, date_from, date_to, tags)
        hash2 = search_service._generate_query_hash(query_text, entity_types, date_from, date_to, tags)
        
        # Одинаковые параметры должны давать одинаковый хеш
        assert hash1 == hash2
        
        # Разные параметры должны давать разные хеши
        hash3 = search_service._generate_query_hash("different query", entity_types, date_from, date_to, tags)
        assert hash1 != hash3
    
    def test_tokenize_query(self, search_service):
        """Тест токенизации запроса"""
        # Простой запрос
        tokens = search_service._tokenize_query("test query")
        assert "test" in tokens
        assert "query" in tokens
        
        # Запрос с заглавными буквами
        tokens = search_service._tokenize_query("Test Query")
        assert "test" in tokens
        assert "query" in tokens
        
        # Запрос с цифрами и символами
        tokens = search_service._tokenize_query("test123 query!@#")
        assert "test123" in tokens
        assert "query" in tokens
        
        # Запрос с короткими словами (должны быть отфильтрованы)
        tokens = search_service._tokenize_query("a b c test query")
        assert "a" not in tokens
        assert "b" not in tokens
        assert "c" not in tokens
        assert "test" in tokens
        assert "query" in tokens
    
    def test_calculate_relevance_score(self, search_service):
        """Тест вычисления релевантности"""
        # Создаем мок SearchIndex
        mock_index = MagicMock()
        mock_index.title = "Test Task Title"
        mock_index.content = "This is a test task content"
        mock_index.keywords = ["test", "task", "important"]
        mock_index.tags = ["urgent", "project"]
        mock_index.updated_at = datetime.utcnow()
        mock_index.view_count = 50
        
        # Тест с точным совпадением в заголовке
        score1 = search_service._calculate_relevance_score(mock_index, "test task")
        assert score1 > 0
        
        # Тест с совпадением в ключевых словах
        score2 = search_service._calculate_relevance_score(mock_index, "important")
        assert score2 > 0
        
        # Тест с совпадением в тегах
        score3 = search_service._calculate_relevance_score(mock_index, "urgent")
        assert score3 > 0
        
        # Тест с отсутствием совпадений
        score4 = search_service._calculate_relevance_score(mock_index, "nonexistent")
        assert score4 >= 0  # Может быть 0 или небольшой бонус за время обновления
    
    def test_generate_snippet(self, search_service):
        """Тест генерации сниппета"""
        # Создаем мок SearchIndex с содержимым
        mock_index = MagicMock()
        mock_index.title = "Test Document"
        mock_index.content = "This is a very long document content that contains many words and should be truncated when generating a snippet for search results."
        
        # Тест с поиском по содержимому
        snippet1 = search_service._generate_snippet(mock_index, "long document")
        assert "long document" in snippet1.lower()
        assert len(snippet1) <= 200
        
        # Тест с поиском по заголовку (когда нет содержимого)
        mock_index.content = None
        snippet2 = search_service._generate_snippet(mock_index, "test")
        assert snippet2 == "Test Document"
        
        # Тест с отсутствием совпадений
        mock_index.content = "This is some content without the search terms"
        snippet3 = search_service._generate_snippet(mock_index, "nonexistent")
        assert len(snippet3) <= 200
    
    @pytest.mark.asyncio
    async def test_save_search(self, search_service, mock_session):
        """Тест сохранения поиска"""
        # Настраиваем моки
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        
        # Вызываем метод
        saved_search = await search_service.save_search(
            user_id=1,
            name="Test Search",
            query_text="test query",
            entity_types=["task", "email"],
            description="Test description",
            is_public=True,
            is_default=False
        )
        
        # Проверяем, что объект был создан
        assert isinstance(saved_search, SavedSearch)
        assert saved_search.name == "Test Search"
        assert saved_search.query_text == "test query"
        assert saved_search.user_id == 1
        assert saved_search.is_public == True
        assert saved_search.is_default == False
        
        # Проверяем, что был вызван commit
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_saved_searches(self, search_service, mock_session):
        """Тест получения сохраненных поисков"""
        # Создаем мок результаты
        mock_saved_search1 = MagicMock()
        mock_saved_search1.user_id = 1
        mock_saved_search1.is_public = False
        mock_saved_search1.usage_count = 5
        
        mock_saved_search2 = MagicMock()
        mock_saved_search2.user_id = 2
        mock_saved_search2.is_public = True
        mock_saved_search2.usage_count = 3
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_saved_search1, mock_saved_search2]
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        saved_searches = await search_service.get_saved_searches(user_id=1, include_public=True)
        
        # Проверяем результат
        assert len(saved_searches) == 2
        assert saved_searches[0] == mock_saved_search1
        assert saved_searches[1] == mock_saved_search2
    
    @pytest.mark.asyncio
    async def test_delete_saved_search_success(self, search_service, mock_session):
        """Тест успешного удаления сохраненного поиска"""
        # Настраиваем моки
        mock_saved_search = MagicMock()
        mock_saved_search.id = 1
        mock_saved_search.user_id = 1
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_saved_search
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await search_service.delete_saved_search(saved_search_id=1, user_id=1)
        
        # Проверяем результат
        assert result == True
        mock_session.delete.assert_called_once_with(mock_saved_search)
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_delete_saved_search_not_found(self, search_service, mock_session):
        """Тест удаления несуществующего сохраненного поиска"""
        # Настраиваем моки
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await search_service.delete_saved_search(saved_search_id=999, user_id=1)
        
        # Проверяем результат
        assert result == False
        mock_session.delete.assert_not_called()
        mock_session.commit.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_index_entity_new(self, search_service, mock_session):
        """Тест индексации новой сущности"""
        # Настраиваем моки
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        search_index = await search_service.index_entity(
            entity_type=SearchIndexType.TASK,
            entity_id=1,
            title="Test Task",
            content="Test content",
            keywords=["test", "task"],
            tags=["urgent"],
            metadata={"priority": "high"},
            permissions={"read": True}
        )
        
        # Проверяем результат
        assert isinstance(search_index, SearchIndex)
        assert search_index.entity_type == SearchIndexType.TASK
        assert search_index.entity_id == 1
        assert search_index.title == "Test Task"
        assert search_index.keywords == ["test", "task"]
        assert search_index.tags == ["urgent"]
        
        # Проверяем, что объект был добавлен
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_index_entity_existing(self, search_service, mock_session):
        """Тест обновления существующего индекса"""
        # Создаем мок существующего индекса
        mock_existing_index = MagicMock()
        mock_existing_index.title = "Old Title"
        mock_existing_index.content = "Old content"
        mock_existing_index.keywords = ["old"]
        mock_existing_index.tags = ["old_tag"]
        mock_existing_index.metadata = {}
        mock_existing_index.permissions = {}
        
        # Настраиваем моки
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_existing_index
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        search_index = await search_service.index_entity(
            entity_type=SearchIndexType.TASK,
            entity_id=1,
            title="New Title",
            content="New content",
            keywords=["new", "task"],
            tags=["new_tag"],
            metadata={"priority": "high"},
            permissions={"read": True}
        )
        
        # Проверяем, что существующий индекс был обновлен
        assert search_index == mock_existing_index
        assert mock_existing_index.title == "New Title"
        assert mock_existing_index.content == "New content"
        assert mock_existing_index.keywords == ["new", "task"]
        assert mock_existing_index.tags == ["new_tag"]
        
        # Проверяем, что был вызван commit
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_remove_entity_index_success(self, search_service, mock_session):
        """Тест успешного удаления индекса сущности"""
        # Создаем мок индекса
        mock_index = MagicMock()
        mock_index.id = 1
        
        # Настраиваем моки
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_index
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await search_service.remove_entity_index(
            entity_type=SearchIndexType.TASK,
            entity_id=1
        )
        
        # Проверяем результат
        assert result == True
        mock_session.delete.assert_called_once_with(mock_index)
        mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_remove_entity_index_not_found(self, search_service, mock_session):
        """Тест удаления несуществующего индекса"""
        # Настраиваем моки
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        result = await search_service.remove_entity_index(
            entity_type=SearchIndexType.TASK,
            entity_id=999
        )
        
        # Проверяем результат
        assert result == False
        mock_session.delete.assert_not_called()
        mock_session.commit.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_get_search_analytics(self, search_service, mock_session):
        """Тест получения аналитики поиска"""
        # Создаем мок результаты
        mock_analytics1 = MagicMock()
        mock_analytics1.date = datetime(2024, 1, 1)
        mock_analytics1.total_queries = 100
        
        mock_analytics2 = MagicMock()
        mock_analytics2.date = datetime(2024, 1, 2)
        mock_analytics2.total_queries = 150
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_analytics1, mock_analytics2]
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        analytics = await search_service.get_search_analytics()
        
        # Проверяем результат
        assert len(analytics) == 2
        assert analytics[0] == mock_analytics1
        assert analytics[1] == mock_analytics2
    
    @pytest.mark.asyncio
    async def test_get_popular_searches(self, search_service, mock_session):
        """Тест получения популярных поисков"""
        # Создаем мок результаты
        mock_row1 = ("test query", 10)
        mock_row2 = ("another query", 5)
        
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_row1, mock_row2]
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        popular_searches = await search_service.get_popular_searches(days=7, limit=10)
        
        # Проверяем результат
        assert len(popular_searches) == 2
        assert popular_searches[0]["query"] == "test query"
        assert popular_searches[0]["count"] == 10
        assert popular_searches[1]["query"] == "another query"
        assert popular_searches[1]["count"] == 5
    
    @pytest.mark.asyncio
    async def test_get_search_history(self, search_service, mock_session):
        """Тест получения истории поиска"""
        # Создаем мок результаты
        mock_query1 = MagicMock()
        mock_query1.id = 1
        mock_query1.query_text = "test query"
        
        mock_query2 = MagicMock()
        mock_query2.id = 2
        mock_query2.query_text = "another query"
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_query1, mock_query2]
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        history = await search_service.get_search_history(user_id=1, limit=20)
        
        # Проверяем результат
        assert len(history) == 2
        assert history[0] == mock_query1
        assert history[1] == mock_query2
    
    @pytest.mark.asyncio
    async def test_get_search_suggestions(self, search_service, mock_session):
        """Тест получения поисковых подсказок"""
        # Создаем мок результаты
        mock_suggestion1 = MagicMock()
        mock_suggestion1.suggestion_text = "test query suggestion"
        mock_suggestion1.usage_count = 5
        
        mock_suggestion2 = MagicMock()
        mock_suggestion2.suggestion_text = "another suggestion"
        mock_suggestion2.usage_count = 3
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_suggestion1, mock_suggestion2]
        mock_session.execute.return_value = mock_result
        
        # Вызываем метод
        suggestions = await search_service.get_search_suggestions(
            query_text="test",
            user_id=1,
            limit=10
        )
        
        # Проверяем результат
        assert len(suggestions) == 2
        assert suggestions[0] == mock_suggestion1
        assert suggestions[1] == mock_suggestion2
    
    def test_search_service_methods_exist(self, search_service):
        """Тест наличия всех методов в SearchService"""
        required_methods = [
            'search', 'get_search_suggestions', 'save_search',
            'get_saved_searches', 'delete_saved_search', 'index_entity',
            'remove_entity_index', 'get_search_analytics',
            'get_popular_searches', 'get_search_history'
        ]
        
        for method_name in required_methods:
            assert hasattr(search_service, method_name)
            method = getattr(search_service, method_name)
            assert callable(method)
    
    def test_search_service_private_methods_exist(self, search_service):
        """Тест наличия приватных методов в SearchService"""
        private_methods = [
            '_execute_search', '_save_search_results', '_update_analytics',
            '_generate_query_hash', '_tokenize_query', '_calculate_relevance_score',
            '_generate_snippet'
        ]
        
        for method_name in private_methods:
            assert hasattr(search_service, method_name)
            method = getattr(search_service, method_name)
            assert callable(method)
    
    def test_search_service_documentation(self, search_service):
        """Тест документации SearchService"""
        # Проверяем наличие документации для класса
        assert SearchService.__doc__ is not None
        
        # Проверяем наличие документации для методов
        public_methods = [
            'search', 'get_search_suggestions', 'save_search',
            'get_saved_searches', 'delete_saved_search', 'index_entity',
            'remove_entity_index', 'get_search_analytics',
            'get_popular_searches', 'get_search_history'
        ]
        
        for method_name in public_methods:
            method = getattr(search_service, method_name)
            assert method.__doc__ is not None
