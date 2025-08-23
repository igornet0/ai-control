"""
API роутер для системы поиска по всем данным
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
from core.database.models.search_model import SearchIndexType, SearchResultType
from backend.api.services.search_service import SearchService


# Pydantic модели для запросов
class SearchRequest(BaseModel):
    """Запрос на поиск"""
    query_text: str = Field(..., description="Текст поиска")
    entity_types: Optional[List[str]] = Field(None, description="Типы сущностей для поиска")
    date_from: Optional[datetime] = Field(None, description="Дата начала")
    date_to: Optional[datetime] = Field(None, description="Дата окончания")
    tags: Optional[List[str]] = Field(None, description="Теги для фильтрации")
    page: int = Field(1, ge=1, description="Номер страницы")
    per_page: int = Field(20, ge=1, le=100, description="Количество на странице")


class SavedSearchCreateRequest(BaseModel):
    """Запрос на создание сохраненного поиска"""
    name: str = Field(..., description="Название поиска")
    query_text: str = Field(..., description="Текст поиска")
    entity_types: Optional[List[str]] = Field(None, description="Типы сущностей")
    date_from: Optional[datetime] = Field(None, description="Дата начала")
    date_to: Optional[datetime] = Field(None, description="Дата окончания")
    tags: Optional[List[str]] = Field(None, description="Теги")
    description: Optional[str] = Field(None, description="Описание")
    is_public: bool = Field(False, description="Публичный поиск")
    is_default: bool = Field(False, description="Поиск по умолчанию")


class EntityIndexRequest(BaseModel):
    """Запрос на индексацию сущности"""
    entity_type: SearchIndexType = Field(..., description="Тип сущности")
    entity_id: int = Field(..., description="ID сущности")
    title: str = Field(..., description="Заголовок")
    content: Optional[str] = Field(None, description="Содержимое")
    keywords: Optional[List[str]] = Field(None, description="Ключевые слова")
    tags: Optional[List[str]] = Field(None, description="Теги")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Метаданные")
    permissions: Optional[Dict[str, Any]] = Field(None, description="Права доступа")


# Pydantic модели для ответов
class SearchResultResponse(BaseModel):
    """Ответ с результатом поиска"""
    id: int
    result_type: SearchResultType
    result_id: int
    relevance_score: float
    rank_position: int
    title: str
    snippet: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class SearchQueryResponse(BaseModel):
    """Ответ с информацией о поисковом запросе"""
    id: int
    query_uuid: str
    user_id: int
    query_text: str
    entity_types: List[str]
    date_from: Optional[datetime]
    date_to: Optional[datetime]
    tags: List[str]
    results_count: int
    execution_time_ms: int
    is_saved: bool
    is_shared: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SavedSearchResponse(BaseModel):
    """Ответ с информацией о сохраненном поиске"""
    id: int
    saved_search_uuid: str
    user_id: int
    name: str
    description: Optional[str]
    query_text: str
    entity_types: List[str]
    date_from: Optional[datetime]
    date_to: Optional[datetime]
    tags: List[str]
    is_public: bool
    is_default: bool
    usage_count: int
    last_used: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SearchIndexResponse(BaseModel):
    """Ответ с информацией об индексе поиска"""
    id: int
    index_uuid: str
    entity_type: SearchIndexType
    entity_id: int
    title: str
    content: Optional[str]
    keywords: List[str]
    tags: List[str]
    relevance_score: float
    view_count: int
    last_accessed: Optional[datetime]
    indexed_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SearchSuggestionResponse(BaseModel):
    """Ответ с поисковой подсказкой"""
    id: int
    suggestion_text: str
    suggestion_type: str
    usage_count: int
    last_used: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SearchAnalyticsResponse(BaseModel):
    """Ответ с аналитикой поиска"""
    id: int
    date: datetime
    total_queries: int
    unique_users: int
    avg_results_per_query: float
    avg_execution_time_ms: float
    popular_queries: Dict[str, int]
    popular_entity_types: Dict[str, int]
    queries_with_results: int
    queries_without_results: int
    created_at: datetime

    class Config:
        from_attributes = True


class PopularSearchResponse(BaseModel):
    """Ответ с популярным поиском"""
    query: str
    count: int


class SearchStatsResponse(BaseModel):
    """Ответ со статистикой поиска"""
    total_queries: int
    total_results: int
    avg_results_per_query: float
    avg_execution_time_ms: float
    popular_searches: List[PopularSearchResponse]
    top_entity_types: Dict[str, int]


# Создаем роутер
router = APIRouter(prefix="/search", tags=["Search"])


# Зависимости
async def get_search_service(session: AsyncSession = Depends(get_session)) -> SearchService:
    """Получение сервиса поиска"""
    return SearchService(session)


# Эндпоинты для поиска
@router.post("/", response_model=List[SearchResultResponse])
async def search(
    request: SearchRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: SearchService = Depends(get_search_service)
):
    """Поиск по всем данным"""
    try:
        results, total_count, search_query = await service.search(
            query_text=request.query_text,
            user_id=current_user_id,
            entity_types=request.entity_types,
            date_from=request.date_from,
            date_to=request.date_to,
            tags=request.tags,
            page=request.page,
            per_page=request.per_page
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/suggestions", response_model=List[SearchSuggestionResponse])
async def get_search_suggestions(
    query_text: str = Query(..., description="Текст для подсказок"),
    limit: int = Query(10, ge=1, le=50, description="Количество подсказок"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: SearchService = Depends(get_search_service)
):
    """Получение поисковых подсказок"""
    try:
        suggestions = await service.get_search_suggestions(
            query_text=query_text,
            user_id=current_user_id,
            limit=limit
        )
        return suggestions
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history", response_model=List[SearchQueryResponse])
async def get_search_history(
    limit: int = Query(20, ge=1, le=100, description="Количество записей"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: SearchService = Depends(get_search_service)
):
    """Получение истории поиска пользователя"""
    try:
        history = await service.get_search_history(
            user_id=current_user_id,
            limit=limit
        )
        return history
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для сохраненных поисков
@router.post("/saved", response_model=SavedSearchResponse)
async def save_search(
    request: SavedSearchCreateRequest,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: SearchService = Depends(get_search_service)
):
    """Сохранение поиска"""
    try:
        saved_search = await service.save_search(
            user_id=current_user_id,
            name=request.name,
            query_text=request.query_text,
            entity_types=request.entity_types,
            date_from=request.date_from,
            date_to=request.date_to,
            tags=request.tags,
            description=request.description,
            is_public=request.is_public,
            is_default=request.is_default
        )
        return saved_search
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/saved", response_model=List[SavedSearchResponse])
async def get_saved_searches(
    include_public: bool = Query(True, description="Включать публичные поиски"),
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: SearchService = Depends(get_search_service)
):
    """Получение сохраненных поисков"""
    try:
        saved_searches = await service.get_saved_searches(
            user_id=current_user_id,
            include_public=include_public
        )
        return saved_searches
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/saved/{saved_search_id}")
async def delete_saved_search(
    saved_search_id: int,
    current_user_id: int = 1,  # TODO: Получать из аутентификации
    service: SearchService = Depends(get_search_service)
):
    """Удаление сохраненного поиска"""
    try:
        success = await service.delete_saved_search(
            saved_search_id=saved_search_id,
            user_id=current_user_id
        )
        if not success:
            raise HTTPException(status_code=404, detail="Saved search not found")
        return {"message": "Saved search deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для индексации
@router.post("/index", response_model=SearchIndexResponse)
async def index_entity(
    request: EntityIndexRequest,
    service: SearchService = Depends(get_search_service)
):
    """Индексация сущности для поиска"""
    try:
        search_index = await service.index_entity(
            entity_type=request.entity_type,
            entity_id=request.entity_id,
            title=request.title,
            content=request.content,
            keywords=request.keywords,
            tags=request.tags,
            metadata=request.metadata,
            permissions=request.permissions
        )
        return search_index
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/index/{entity_type}/{entity_id}")
async def remove_entity_index(
    entity_type: SearchIndexType,
    entity_id: int,
    service: SearchService = Depends(get_search_service)
):
    """Удаление индекса сущности"""
    try:
        success = await service.remove_entity_index(
            entity_type=entity_type,
            entity_id=entity_id
        )
        if not success:
            raise HTTPException(status_code=404, detail="Search index not found")
        return {"message": "Search index removed successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Эндпоинты для аналитики
@router.get("/analytics", response_model=List[SearchAnalyticsResponse])
async def get_search_analytics(
    date_from: Optional[datetime] = Query(None, description="Дата начала"),
    date_to: Optional[datetime] = Query(None, description="Дата окончания"),
    service: SearchService = Depends(get_search_service)
):
    """Получение аналитики поиска"""
    try:
        analytics = await service.get_search_analytics(
            date_from=date_from,
            date_to=date_to
        )
        return analytics
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/popular", response_model=List[PopularSearchResponse])
async def get_popular_searches(
    days: int = Query(7, ge=1, le=365, description="Количество дней"),
    limit: int = Query(10, ge=1, le=50, description="Количество результатов"),
    service: SearchService = Depends(get_search_service)
):
    """Получение популярных поисков"""
    try:
        popular_searches = await service.get_popular_searches(
            days=days,
            limit=limit
        )
        return popular_searches
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats", response_model=SearchStatsResponse)
async def get_search_stats(
    days: int = Query(30, ge=1, le=365, description="Количество дней"),
    service: SearchService = Depends(get_search_service)
):
    """Получение общей статистики поиска"""
    try:
        # Получаем аналитику за указанный период
        date_from = datetime.utcnow() - timedelta(days=days)
        analytics = await service.get_search_analytics(date_from=date_from)
        
        # Вычисляем общую статистику
        total_queries = sum(a.total_queries for a in analytics)
        total_results = sum(a.queries_with_results for a in analytics)
        avg_results_per_query = sum(a.avg_results_per_query for a in analytics) / len(analytics) if analytics else 0
        avg_execution_time_ms = sum(a.avg_execution_time_ms for a in analytics) / len(analytics) if analytics else 0
        
        # Получаем популярные поиски
        popular_searches = await service.get_popular_searches(days=days, limit=10)
        
        # Объединяем популярные типы сущностей
        top_entity_types = {}
        for a in analytics:
            for entity_type, count in a.popular_entity_types.items():
                top_entity_types[entity_type] = top_entity_types.get(entity_type, 0) + count
        
        return SearchStatsResponse(
            total_queries=total_queries,
            total_results=total_results,
            avg_results_per_query=avg_results_per_query,
            avg_execution_time_ms=avg_execution_time_ms,
            popular_searches=popular_searches,
            top_entity_types=top_entity_types
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# WebSocket эндпоинт для реального времени
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int = 1  # TODO: Получать из аутентификации
):
    """WebSocket эндпоинт для поиска в реальном времени"""
    await websocket.accept()
    try:
        while True:
            # Получаем сообщение от клиента
            data = await websocket.receive_text()
            message = {"user_id": user_id, "data": data}

            # Отправляем ответ обратно (здесь можно добавить логику обработки)
            await websocket.send_text(f"Search message received: {data}")
    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected from search")
    except Exception as e:
        print(f"Search WebSocket error: {e}")
        await websocket.close()
