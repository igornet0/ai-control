"""
Сервис для системы поиска по всем данным
"""
import asyncio
import hashlib
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, or_, func, desc, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database.models.search_model import (
    SearchIndex, SearchQuery, SearchResult, SavedSearch, 
    SearchAnalytics, SearchSuggestion,
    SearchIndexType, SearchResultType
)
from core.database.models.main_models import User


class SearchService:
    """Сервис для поиска по всем данным"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def search(
        self,
        query_text: str,
        user_id: int,
        entity_types: Optional[List[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        page: int = 1,
        per_page: int = 20,
        save_query: bool = True
    ) -> Tuple[List[SearchResult], int, SearchQuery]:
        """Поиск по всем данным"""
        start_time = datetime.utcnow()
        
        # Создаем поисковый запрос
        query_hash = self._generate_query_hash(query_text, entity_types, date_from, date_to, tags)
        
        search_query = SearchQuery(
            query_uuid=str(uuid.uuid4()),
            user_id=user_id,
            query_text=query_text,
            query_hash=query_hash,
            entity_types=entity_types or [],
            date_from=date_from,
            date_to=date_to,
            tags=tags or []
        )
        
        self.session.add(search_query)
        await self.session.flush()
        
        # Выполняем поиск
        results = await self._execute_search(
            query_text=query_text,
            user_id=user_id,
            entity_types=entity_types,
            date_from=date_from,
            date_to=date_to,
            tags=tags,
            page=page,
            per_page=per_page
        )
        
        # Сохраняем результаты
        await self._save_search_results(search_query, results)
        
        # Обновляем статистику запроса
        execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        search_query.results_count = len(results)
        search_query.execution_time_ms = execution_time
        
        if save_query:
            await self.session.commit()
        
        # Обновляем аналитику
        await self._update_analytics(search_query, results)
        
        return results, len(results), search_query
    
    async def get_search_suggestions(
        self,
        query_text: str,
        user_id: int,
        limit: int = 10
    ) -> List[SearchSuggestion]:
        """Получение поисковых подсказок"""
        # Ищем похожие запросы
        similar_queries = await self.session.execute(
            select(SearchSuggestion).where(
                and_(
                    SearchSuggestion.suggestion_text.ilike(f"%{query_text}%"),
                    SearchSuggestion.suggestion_type == "query"
                )
            ).order_by(desc(SearchSuggestion.usage_count)).limit(limit)
        )
        
        return similar_queries.scalars().all()
    
    async def save_search(
        self,
        user_id: int,
        name: str,
        query_text: str,
        entity_types: Optional[List[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        is_public: bool = False,
        is_default: bool = False
    ) -> SavedSearch:
        """Сохранение поиска"""
        # Если это поиск по умолчанию, сбрасываем другие
        if is_default:
            await self.session.execute(
                text("UPDATE saved_searches SET is_default = false WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
        
        saved_search = SavedSearch(
            saved_search_uuid=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            description=description,
            query_text=query_text,
            entity_types=entity_types or [],
            date_from=date_from,
            date_to=date_to,
            tags=tags or [],
            is_public=is_public,
            is_default=is_default
        )
        
        self.session.add(saved_search)
        await self.session.commit()
        
        return saved_search
    
    async def get_saved_searches(
        self,
        user_id: int,
        include_public: bool = True
    ) -> List[SavedSearch]:
        """Получение сохраненных поисков"""
        query = select(SavedSearch).where(
            or_(
                SavedSearch.user_id == user_id,
                and_(SavedSearch.is_public == True, include_public)
            )
        ).order_by(desc(SavedSearch.usage_count))
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def delete_saved_search(
        self,
        saved_search_id: int,
        user_id: int
    ) -> bool:
        """Удаление сохраненного поиска"""
        saved_search = await self.session.execute(
            select(SavedSearch).where(
                and_(
                    SavedSearch.id == saved_search_id,
                    SavedSearch.user_id == user_id
                )
            )
        )
        saved_search_obj = saved_search.scalar_one_or_none()
        
        if not saved_search_obj:
            return False
        
        await self.session.delete(saved_search_obj)
        await self.session.commit()
        
        return True
    
    async def index_entity(
        self,
        entity_type: SearchIndexType,
        entity_id: int,
        title: str,
        content: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        permissions: Optional[Dict[str, Any]] = None
    ) -> SearchIndex:
        """Индексация сущности для поиска"""
        # Проверяем, существует ли уже индекс
        existing = await self.session.execute(
            select(SearchIndex).where(
                and_(
                    SearchIndex.entity_type == entity_type,
                    SearchIndex.entity_id == entity_id
                )
            )
        )
        existing_obj = existing.scalar_one_or_none()
        
        if existing_obj:
            # Обновляем существующий индекс
            existing_obj.title = title
            existing_obj.content = content
            existing_obj.keywords = keywords or []
            existing_obj.tags = tags or []
            existing_obj.search_metadata = metadata or {}
            existing_obj.permissions = permissions or {}
            existing_obj.updated_at = datetime.utcnow()
            
            await self.session.commit()
            return existing_obj
        else:
            # Создаем новый индекс
            search_index = SearchIndex(
                index_uuid=str(uuid.uuid4()),
                entity_type=entity_type,
                entity_id=entity_id,
                title=title,
                content=content,
                keywords=keywords or [],
                tags=tags or [],
                search_metadata=metadata or {},
                permissions=permissions or {}
            )
            
            self.session.add(search_index)
            await self.session.commit()
            return search_index
    
    async def remove_entity_index(
        self,
        entity_type: SearchIndexType,
        entity_id: int
    ) -> bool:
        """Удаление индекса сущности"""
        search_index = await self.session.execute(
            select(SearchIndex).where(
                and_(
                    SearchIndex.entity_type == entity_type,
                    SearchIndex.entity_id == entity_id
                )
            )
        )
        search_index_obj = search_index.scalar_one_or_none()
        
        if not search_index_obj:
            return False
        
        await self.session.delete(search_index_obj)
        await self.session.commit()
        
        return True
    
    async def get_search_analytics(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[SearchAnalytics]:
        """Получение аналитики поиска"""
        query = select(SearchAnalytics)
        
        if date_from:
            query = query.where(SearchAnalytics.date >= date_from)
        if date_to:
            query = query.where(SearchAnalytics.date <= date_to)
        
        query = query.order_by(desc(SearchAnalytics.date))
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_popular_searches(
        self,
        days: int = 7,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Получение популярных поисков"""
        # Получаем популярные запросы за последние дни
        date_from = datetime.utcnow() - timedelta(days=days)
        
        result = await self.session.execute(
            select(
                SearchQuery.query_text,
                func.count(SearchQuery.id).label('count')
            ).where(
                SearchQuery.created_at >= date_from
            ).group_by(
                SearchQuery.query_text
            ).order_by(
                desc(text('count'))
            ).limit(limit)
        )
        
        return [{"query": row[0], "count": row[1]} for row in result.fetchall()]
    
    async def get_search_history(
        self,
        user_id: int,
        limit: int = 20
    ) -> List[SearchQuery]:
        """Получение истории поиска пользователя"""
        result = await self.session.execute(
            select(SearchQuery).where(
                SearchQuery.user_id == user_id
            ).order_by(
                desc(SearchQuery.created_at)
            ).limit(limit)
        )
        
        return result.scalars().all()
    
    async def _execute_search(
        self,
        query_text: str,
        user_id: int,
        entity_types: Optional[List[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        page: int = 1,
        per_page: int = 20
    ) -> List[SearchResult]:
        """Выполнение поиска"""
        # Базовый запрос
        query = select(SearchIndex)
        
        # Фильтры по типу сущности
        if entity_types:
            query = query.where(SearchIndex.entity_type.in_(entity_types))
        
        # Фильтры по дате
        if date_from:
            query = query.where(SearchIndex.updated_at >= date_from)
        if date_to:
            query = query.where(SearchIndex.updated_at <= date_to)
        
        # Фильтры по тегам
        if tags:
            for tag in tags:
                query = query.where(SearchIndex.tags.contains([tag]))
        
        # Поиск по тексту
        if query_text:
            search_terms = self._tokenize_query(query_text)
            search_conditions = []
            
            for term in search_terms:
                term_condition = or_(
                    SearchIndex.title.ilike(f"%{term}%"),
                    SearchIndex.content.ilike(f"%{term}%"),
                    SearchIndex.keywords.contains([term]),
                    SearchIndex.tags.contains([term])
                )
                search_conditions.append(term_condition)
            
            if search_conditions:
                query = query.where(or_(*search_conditions))
        
        # Подсчитываем общее количество
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await self.session.scalar(count_query)
        
        # Добавляем пагинацию и сортировку
        query = query.order_by(desc(SearchIndex.relevance_score), desc(SearchIndex.updated_at)).offset(
            (page - 1) * per_page
        ).limit(per_page)
        
        # Выполняем запрос
        result = await self.session.execute(query)
        search_indexes = result.scalars().all()
        
        # Преобразуем в результаты поиска
        search_results = []
        for i, search_index in enumerate(search_indexes):
            relevance_score = self._calculate_relevance_score(search_index, query_text)
            
            search_result = SearchResult(
                result_type=SearchResultType(search_index.entity_type.value),
                result_id=search_index.entity_id,
                relevance_score=relevance_score,
                rank_position=i + 1,
                title=search_index.title,
                snippet=self._generate_snippet(search_index, query_text),
                metadata=search_index.search_metadata
            )
            search_results.append(search_result)
        
        return search_results
    
    async def _save_search_results(
        self,
        search_query: SearchQuery,
        results: List[SearchResult]
    ):
        """Сохранение результатов поиска"""
        for result in results:
            result.query_id = search_query.id
            self.session.add(result)
    
    async def _update_analytics(
        self,
        search_query: SearchQuery,
        results: List[SearchResult]
    ):
        """Обновление аналитики поиска"""
        today = datetime.utcnow().date()
        
        # Получаем или создаем запись аналитики за сегодня
        analytics = await self.session.execute(
            select(SearchAnalytics).where(SearchAnalytics.date == today)
        )
        analytics_obj = analytics.scalar_one_or_none()
        
        if not analytics_obj:
            analytics_obj = SearchAnalytics(date=today)
            self.session.add(analytics_obj)
        
        # Обновляем статистику
        analytics_obj.total_queries += 1
        analytics_obj.avg_results_per_query = (
            (analytics_obj.avg_results_per_query * (analytics_obj.total_queries - 1) + len(results)) /
            analytics_obj.total_queries
        )
        analytics_obj.avg_execution_time_ms = (
            (analytics_obj.avg_execution_time_ms * (analytics_obj.total_queries - 1) + search_query.execution_time_ms) /
            analytics_obj.total_queries
        )
        
        if len(results) > 0:
            analytics_obj.queries_with_results += 1
        else:
            analytics_obj.queries_without_results += 1
        
        # Обновляем популярные запросы
        if search_query.query_text not in analytics_obj.popular_queries:
            analytics_obj.popular_queries[search_query.query_text] = 0
        analytics_obj.popular_queries[search_query.query_text] += 1
        
        # Обновляем популярные типы сущностей
        for result in results:
            entity_type = result.result_type.value
            if entity_type not in analytics_obj.popular_entity_types:
                analytics_obj.popular_entity_types[entity_type] = 0
            analytics_obj.popular_entity_types[entity_type] += 1
    
    def _generate_query_hash(
        self,
        query_text: str,
        entity_types: Optional[List[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        tags: Optional[List[str]] = None
    ) -> str:
        """Генерация хеша запроса для дедупликации"""
        query_string = f"{query_text}:{entity_types}:{date_from}:{date_to}:{tags}"
        return hashlib.sha256(query_string.encode()).hexdigest()
    
    def _tokenize_query(self, query_text: str) -> List[str]:
        """Токенизация поискового запроса"""
        # Простая токенизация по пробелам и специальным символам
        tokens = re.findall(r'\b\w+\b', query_text.lower())
        return [token for token in tokens if len(token) > 2]
    
    def _calculate_relevance_score(
        self,
        search_index: SearchIndex,
        query_text: str
    ) -> float:
        """Вычисление релевантности результата"""
        score = 0.0
        query_tokens = self._tokenize_query(query_text)
        
        # Поиск в заголовке (высокий вес)
        for token in query_tokens:
            if token in search_index.title.lower():
                score += 10.0
        
        # Поиск в содержимом (средний вес)
        if search_index.content:
            for token in query_tokens:
                if token in search_index.content.lower():
                    score += 5.0
        
        # Поиск в ключевых словах (высокий вес)
        for token in query_tokens:
            if token in [kw.lower() for kw in search_index.keywords]:
                score += 8.0
        
        # Поиск в тегах (средний вес)
        for token in query_tokens:
            if token in [tag.lower() for tag in search_index.tags]:
                score += 6.0
        
        # Бонус за недавнее обновление
        days_since_update = (datetime.utcnow() - search_index.updated_at).days
        if days_since_update < 7:
            score += 2.0
        elif days_since_update < 30:
            score += 1.0
        
        # Бонус за количество просмотров
        score += min(search_index.view_count / 100, 5.0)
        
        return score
    
    def _generate_snippet(
        self,
        search_index: SearchIndex,
        query_text: str,
        max_length: int = 200
    ) -> str:
        """Генерация сниппета для результата поиска"""
        if not search_index.content:
            return search_index.title[:max_length]
        
        query_tokens = self._tokenize_query(query_text)
        content = search_index.content.lower()
        
        # Ищем первое вхождение любого токена
        best_position = -1
        for token in query_tokens:
            pos = content.find(token)
            if pos != -1 and (best_position == -1 or pos < best_position):
                best_position = pos
        
        if best_position == -1:
            return search_index.content[:max_length]
        
        # Вырезаем фрагмент вокруг найденного токена
        start = max(0, best_position - 50)
        end = min(len(search_index.content), start + max_length)
        
        snippet = search_index.content[start:end]
        
        # Добавляем многоточие, если нужно
        if start > 0:
            snippet = "..." + snippet
        if end < len(search_index.content):
            snippet = snippet + "..."
        
        return snippet
