"""
API для управления виджетами и шаблонами
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
import logging
from datetime import datetime

from backend.api.configuration.auth import verify_authorization, require_role
from backend.api.configuration.server import Server
from core.database.models.dashboard_model import (
    Widget, WidgetTemplate, DashboardWidget
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/widgets", tags=["widgets"])

# Pydantic модели для API

class WidgetCreateRequest(BaseModel):
    """Запрос на создание шаблона виджета"""
    name: str = Field(..., min_length=1, max_length=255, description="Название виджета")
    description: Optional[str] = Field(None, description="Описание виджета")
    widget_type: str = Field(..., description="Тип виджета (chart, table, kpi, text, etc.)")
    category: str = Field(..., description="Категория виджета (charts, tables, kpi, custom, etc.)")
    icon: Optional[str] = Field(None, description="Иконка виджета")
    default_config: Optional[Dict[str, Any]] = Field(None, description="Конфигурация по умолчанию")
    schema: Optional[Dict[str, Any]] = Field(None, description="JSON схема для конфигурации")
    is_system: bool = Field(default=False, description="Системный виджет")

class WidgetUpdateRequest(BaseModel):
    """Запрос на обновление шаблона виджета"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None)
    widget_type: Optional[str] = Field(None)
    category: Optional[str] = Field(None)
    icon: Optional[str] = Field(None)
    default_config: Optional[Dict[str, Any]] = Field(None)
    schema: Optional[Dict[str, Any]] = Field(None)
    is_active: Optional[bool] = Field(None)

class WidgetResponse(BaseModel):
    """Ответ с данными шаблона виджета"""
    id: int
    name: str
    description: Optional[str]
    widget_type: str
    category: str
    icon: Optional[str]
    default_config: Optional[Dict[str, Any]]
    schema: Optional[Dict[str, Any]]
    is_active: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime
    usage_count: int = 0

class WidgetTemplateCreateRequest(BaseModel):
    """Запрос на создание шаблона виджета"""
    name: str = Field(..., min_length=1, max_length=255, description="Название шаблона")
    description: Optional[str] = Field(None, description="Описание шаблона")
    widget_type: str = Field(..., description="Тип виджета")
    category: str = Field(..., description="Категория виджета")
    template_config: Dict[str, Any] = Field(..., description="Конфигурация шаблона")
    preview_image: Optional[str] = Field(None, description="Путь к изображению предпросмотра")
    is_public: bool = Field(default=False, description="Публичный шаблон")

class WidgetTemplateResponse(BaseModel):
    """Ответ с данными шаблона виджета"""
    id: int
    name: str
    description: Optional[str]
    widget_type: str
    category: str
    template_config: Dict[str, Any]
    preview_image: Optional[str]
    created_by: int
    is_public: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    creator_name: Optional[str] = None

# API эндпоинты

@router.post("/", response_model=WidgetResponse)
async def create_widget(
    request: WidgetCreateRequest,
    user = Depends(require_role("admin")),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Создание нового шаблона виджета (только для админов)
    """
    try:
        # Создаем виджет
        widget = Widget(
            name=request.name,
            description=request.description,
            widget_type=request.widget_type,
            category=request.category,
            icon=request.icon,
            default_config=request.default_config,
            schema=request.schema,
            is_system=request.is_system
        )
        
        session.add(widget)
        await session.commit()
        await session.refresh(widget)
        
        logger.info(f"Widget created: {widget.id} by user {user.id}")
        
        return WidgetResponse(
            id=widget.id,
            name=widget.name,
            description=widget.description,
            widget_type=widget.widget_type,
            category=widget.category,
            icon=widget.icon,
            default_config=widget.default_config,
            schema=widget.schema,
            is_active=widget.is_active,
            is_system=widget.is_system,
            created_at=widget.created_at,
            updated_at=widget.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating widget: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[WidgetResponse])
async def list_widgets(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db),
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    widget_type: Optional[str] = Query(None, description="Фильтр по типу"),
    is_active: Optional[bool] = Query(None, description="Фильтр по активности")
):
    """
    Получение списка шаблонов виджетов
    """
    try:
        # Базовый запрос
        query = select(Widget)
        
        # Фильтры
        if category:
            query = query.where(Widget.category == category)
        
        if widget_type:
            query = query.where(Widget.widget_type == widget_type)
        
        if is_active is not None:
            query = query.where(Widget.is_active == is_active)
        
        # Выполняем запрос
        result = await session.execute(query)
        widgets = result.scalars().all()
        
        # Формируем ответ
        widget_responses = []
        for widget in widgets:
            # Подсчитываем использование виджета
            usage_query = select(DashboardWidget).where(DashboardWidget.widget_id == widget.id)
            usage_result = await session.execute(usage_query)
            usage_count = len(usage_result.scalars().all())
            
            widget_responses.append(WidgetResponse(
                id=widget.id,
                name=widget.name,
                description=widget.description,
                widget_type=widget.widget_type,
                category=widget.category,
                icon=widget.icon,
                default_config=widget.default_config,
                schema=widget.schema,
                is_active=widget.is_active,
                is_system=widget.is_system,
                created_at=widget.created_at,
                updated_at=widget.updated_at,
                usage_count=usage_count
            ))
        
        return widget_responses
        
    except Exception as e:
        logger.error(f"Error listing widgets: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{widget_id}", response_model=WidgetResponse)
async def get_widget(
    widget_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение шаблона виджета по ID
    """
    try:
        query = select(Widget).where(Widget.id == widget_id)
        result = await session.execute(query)
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")
        
        # Подсчитываем использование виджета
        usage_query = select(DashboardWidget).where(DashboardWidget.widget_id == widget.id)
        usage_result = await session.execute(usage_query)
        usage_count = len(usage_result.scalars().all())
        
        return WidgetResponse(
            id=widget.id,
            name=widget.name,
            description=widget.description,
            widget_type=widget.widget_type,
            category=widget.category,
            icon=widget.icon,
            default_config=widget.default_config,
            schema=widget.schema,
            is_active=widget.is_active,
            is_system=widget.is_system,
            created_at=widget.created_at,
            updated_at=widget.updated_at,
            usage_count=usage_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting widget: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    widget_id: int,
    request: WidgetUpdateRequest,
    user = Depends(require_role("admin")),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Обновление шаблона виджета (только для админов)
    """
    try:
        query = select(Widget).where(Widget.id == widget_id)
        result = await session.execute(query)
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")
        
        # Обновляем поля
        if request.name is not None:
            widget.name = request.name
        if request.description is not None:
            widget.description = request.description
        if request.widget_type is not None:
            widget.widget_type = request.widget_type
        if request.category is not None:
            widget.category = request.category
        if request.icon is not None:
            widget.icon = request.icon
        if request.default_config is not None:
            widget.default_config = request.default_config
        if request.schema is not None:
            widget.schema = request.schema
        if request.is_active is not None:
            widget.is_active = request.is_active
        
        widget.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(widget)
        
        logger.info(f"Widget updated: {widget.id} by user {user.id}")
        
        return WidgetResponse(
            id=widget.id,
            name=widget.name,
            description=widget.description,
            widget_type=widget.widget_type,
            category=widget.category,
            icon=widget.icon,
            default_config=widget.default_config,
            schema=widget.schema,
            is_active=widget.is_active,
            is_system=widget.is_system,
            created_at=widget.created_at,
            updated_at=widget.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating widget: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{widget_id}")
async def delete_widget(
    widget_id: int,
    user = Depends(require_role("admin")),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Удаление шаблона виджета (только для админов)
    """
    try:
        query = select(Widget).where(Widget.id == widget_id)
        result = await session.execute(query)
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")
        
        # Проверяем, используется ли виджет
        usage_query = select(DashboardWidget).where(DashboardWidget.widget_id == widget.id)
        usage_result = await session.execute(usage_query)
        usage_count = len(usage_result.scalars().all())
        
        if usage_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete widget that is used in {usage_count} dashboards"
            )
        
        # Удаляем виджет
        await session.delete(widget)
        await session.commit()
        
        logger.info(f"Widget deleted: {widget_id} by user {user.id}")
        
        return {"message": "Widget deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting widget: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/categories/list")
async def get_widget_categories(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение списка категорий виджетов
    """
    try:
        query = select(Widget.category).distinct().where(Widget.is_active == True)
        result = await session.execute(query)
        categories = result.scalars().all()
        
        return {"categories": list(categories)}
        
    except Exception as e:
        logger.error(f"Error getting widget categories: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/types/list")
async def get_widget_types(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение списка типов виджетов
    """
    try:
        query = select(Widget.widget_type).distinct().where(Widget.is_active == True)
        result = await session.execute(query)
        types = result.scalars().all()
        
        return {"types": list(types)}
        
    except Exception as e:
        logger.error(f"Error getting widget types: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# API для шаблонов виджетов

@router.post("/templates", response_model=WidgetTemplateResponse)
async def create_widget_template(
    request: WidgetTemplateCreateRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Создание шаблона виджета
    """
    try:
        template = WidgetTemplate(
            name=request.name,
            description=request.description,
            widget_type=request.widget_type,
            category=request.category,
            template_config=request.template_config,
            preview_image=request.preview_image,
            created_by=user.id,
            is_public=request.is_public
        )
        
        session.add(template)
        await session.commit()
        await session.refresh(template)
        
        logger.info(f"Widget template created: {template.id} by user {user.id}")
        
        return WidgetTemplateResponse(
            id=template.id,
            name=template.name,
            description=template.description,
            widget_type=template.widget_type,
            category=template.category,
            template_config=template.template_config,
            preview_image=template.preview_image,
            created_by=template.created_by,
            is_public=template.is_public,
            is_active=template.is_active,
            created_at=template.created_at,
            updated_at=template.updated_at,
            creator_name=user.username
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating widget template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/templates", response_model=List[WidgetTemplateResponse])
async def list_widget_templates(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db),
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    widget_type: Optional[str] = Query(None, description="Фильтр по типу"),
    is_public: Optional[bool] = Query(None, description="Фильтр по публичности")
):
    """
    Получение списка шаблонов виджетов
    """
    try:
        # Базовый запрос
        query = select(WidgetTemplate).where(WidgetTemplate.is_active == True)
        
        # Фильтры
        if category:
            query = query.where(WidgetTemplate.category == category)
        
        if widget_type:
            query = query.where(WidgetTemplate.widget_type == widget_type)
        
        if is_public is not None:
            query = query.where(WidgetTemplate.is_public == is_public)
        
        # Показываем только публичные шаблоны или созданные пользователем
        query = query.where(
            or_(
                WidgetTemplate.is_public == True,
                WidgetTemplate.created_by == user.id
            )
        )
        
        # Выполняем запрос
        result = await session.execute(query)
        templates = result.scalars().all()
        
        # Формируем ответ
        template_responses = []
        for template in templates:
            template_responses.append(WidgetTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                widget_type=template.widget_type,
                category=template.category,
                template_config=template.template_config,
                preview_image=template.preview_image,
                created_by=template.created_by,
                is_public=template.is_public,
                is_active=template.is_active,
                created_at=template.created_at,
                updated_at=template.updated_at
            ))
        
        return template_responses
        
    except Exception as e:
        logger.error(f"Error listing widget templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/templates/{template_id}", response_model=WidgetTemplateResponse)
async def get_widget_template(
    template_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение шаблона виджета по ID
    """
    try:
        query = select(WidgetTemplate).where(WidgetTemplate.id == template_id)
        result = await session.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Widget template not found")
        
        # Проверяем права доступа
        if not template.is_public and template.created_by != user.id:
            raise HTTPException(status_code=403, detail="Access denied to widget template")
        
        return WidgetTemplateResponse(
            id=template.id,
            name=template.name,
            description=template.description,
            widget_type=template.widget_type,
            category=template.category,
            template_config=template.template_config,
            preview_image=template.preview_image,
            created_by=template.created_by,
            is_public=template.is_public,
            is_active=template.is_active,
            created_at=template.created_at,
            updated_at=template.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting widget template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
