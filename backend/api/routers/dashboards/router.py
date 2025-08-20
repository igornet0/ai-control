"""
API для управления дашбордами
"""

import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
import logging
from datetime import datetime

from backend.api.configuration.auth import verify_authorization, require_role
from backend.api.configuration.server import Server
from core.database.orm.orm_query_user import orm_get_user_by_id
from core.database.models.dashboard_model import (
    Dashboard, Widget, DashboardWidget, DashboardDataSource,
    WidgetTemplate, DashboardShare, DashboardVersion
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])

# Pydantic модели для API

class DashboardCreateRequest(BaseModel):
    """Запрос на создание дашборда"""
    name: str = Field(..., min_length=1, max_length=255, description="Название дашборда")
    description: Optional[str] = Field(None, description="Описание дашборда")
    theme: str = Field(default="default", description="Тема дашборда")
    is_public: bool = Field(default=False, description="Публичный дашборд")
    is_template: bool = Field(default=False, description="Шаблон дашборда")
    organization_id: Optional[int] = Field(None, description="ID организации")
    department_id: Optional[int] = Field(None, description="ID департамента")

class DashboardUpdateRequest(BaseModel):
    """Запрос на обновление дашборда"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None)
    theme: Optional[str] = Field(None)
    is_public: Optional[bool] = Field(None)
    is_template: Optional[bool] = Field(None)
    layout_config: Optional[Dict[str, Any]] = Field(None, description="Конфигурация расположения")

class DashboardResponse(BaseModel):
    """Ответ с данными дашборда"""
    id: int
    name: str
    description: Optional[str]
    theme: str
    is_public: bool
    is_template: bool
    layout_config: Optional[Dict[str, Any]]
    user_id: int
    organization_id: Optional[int]
    department_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    widgets_count: int = 0
    data_sources_count: int = 0

class WidgetCreateRequest(BaseModel):
    """Запрос на создание виджета на дашборде"""
    widget_id: int = Field(..., description="ID шаблона виджета")
    title: str = Field(..., min_length=1, max_length=255, description="Заголовок виджета")
    position_x: int = Field(default=0, ge=0, description="Позиция X")
    position_y: int = Field(default=0, ge=0, description="Позиция Y")
    width: int = Field(default=6, ge=1, le=12, description="Ширина (1-12)")
    height: int = Field(default=4, ge=1, le=12, description="Высота (1-12)")
    config: Optional[Dict[str, Any]] = Field(None, description="Конфигурация виджета")
    data_source_id: Optional[int] = Field(None, description="ID источника данных")
    refresh_interval: int = Field(default=0, ge=0, description="Интервал обновления в секундах")

class WidgetUpdateRequest(BaseModel):
    """Запрос на обновление виджета"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    position_x: Optional[int] = Field(None, ge=0)
    position_y: Optional[int] = Field(None, ge=0)
    width: Optional[int] = Field(None, ge=1, le=12)
    height: Optional[int] = Field(None, ge=1, le=12)
    config: Optional[Dict[str, Any]] = Field(None)
    data_source_id: Optional[int] = Field(None)
    is_visible: Optional[bool] = Field(None)
    refresh_interval: Optional[int] = Field(None, ge=0)

class WidgetResponse(BaseModel):
    """Ответ с данными виджета"""
    id: int
    dashboard_id: int
    widget_id: int
    title: str
    position_x: int
    position_y: int
    width: int
    height: int
    config: Optional[Dict[str, Any]]
    data_source_id: Optional[int]
    is_visible: bool
    refresh_interval: int
    last_refresh: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    widget_name: Optional[str] = None
    widget_type: Optional[str] = None
    widget_category: Optional[str] = None

# API эндпоинты

@router.post("/", response_model=DashboardResponse)
async def create_dashboard(
    request: DashboardCreateRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Создание нового дашборда
    """
    try:
        # Проверяем права доступа
        if request.organization_id and not await _can_manage_organization(user, request.organization_id, session):
            raise HTTPException(status_code=403, detail="Access denied to organization")
        
        if request.department_id and not await _can_manage_department(user, request.department_id, session):
            raise HTTPException(status_code=403, detail="Access denied to department")
        
        # Создаем дашборд
        dashboard = Dashboard(
            name=request.name,
            description=request.description,
            theme=request.theme,
            is_public=request.is_public,
            is_template=request.is_template,
            user_id=user.id,
            organization_id=request.organization_id,
            department_id=request.department_id
        )
        
        session.add(dashboard)
        await session.commit()
        await session.refresh(dashboard)
        
        logger.info(f"Dashboard created: {dashboard.id} by user {user.id}")
        
        return DashboardResponse(
            id=dashboard.id,
            name=dashboard.name,
            description=dashboard.description,
            theme=dashboard.theme,
            is_public=dashboard.is_public,
            is_template=dashboard.is_template,
            layout_config=dashboard.layout_config,
            user_id=dashboard.user_id,
            organization_id=dashboard.organization_id,
            department_id=dashboard.department_id,
            created_at=dashboard.created_at,
            updated_at=dashboard.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating dashboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[DashboardResponse])
async def list_dashboards(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organization_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    is_template: Optional[bool] = Query(None)
):
    """
    Получение списка дашбордов пользователя
    """
    try:
        # Базовый запрос
        query = select(Dashboard).where(
            or_(
                Dashboard.user_id == user.id,
                Dashboard.is_public == True
            )
        )
        
        # Фильтры
        if organization_id:
            query = query.where(Dashboard.organization_id == organization_id)
        
        if department_id:
            query = query.where(Dashboard.department_id == department_id)
        
        if is_template is not None:
            query = query.where(Dashboard.is_template == is_template)
        
        # Пагинация
        query = query.offset(skip).limit(limit)
        
        # Выполняем запрос
        result = await session.execute(query)
        dashboards = result.scalars().all()
        
        # Формируем ответ
        dashboard_responses = []
        for dashboard in dashboards:
            # Подсчитываем виджеты и источники данных
            widgets_count = len(dashboard.widgets) if dashboard.widgets else 0
            data_sources_count = len(dashboard.data_sources) if dashboard.data_sources else 0
            
            dashboard_responses.append(DashboardResponse(
                id=dashboard.id,
                name=dashboard.name,
                description=dashboard.description,
                theme=dashboard.theme,
                is_public=dashboard.is_public,
                is_template=dashboard.is_template,
                layout_config=dashboard.layout_config,
                user_id=dashboard.user_id,
                organization_id=dashboard.organization_id,
                department_id=dashboard.department_id,
                created_at=dashboard.created_at,
                updated_at=dashboard.updated_at,
                widgets_count=widgets_count,
                data_sources_count=data_sources_count
            ))
        
        return dashboard_responses
        
    except Exception as e:
        logger.error(f"Error listing dashboards: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение дашборда по ID
    """
    try:
        # Получаем дашборд с виджетами и источниками данных
        query = select(Dashboard).options(
            selectinload(Dashboard.widgets),
            selectinload(Dashboard.data_sources)
        ).where(Dashboard.id == dashboard_id)
        
        result = await session.execute(query)
        dashboard = result.scalar_one_or_none()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Проверяем права доступа
        if not await _can_access_dashboard(user, dashboard, session):
            raise HTTPException(status_code=403, detail="Access denied to dashboard")
        
        # Подсчитываем виджеты и источники данных
        widgets_count = len(dashboard.widgets) if dashboard.widgets else 0
        data_sources_count = len(dashboard.data_sources) if dashboard.data_sources else 0
        
        return DashboardResponse(
            id=dashboard.id,
            name=dashboard.name,
            description=dashboard.description,
            theme=dashboard.theme,
            is_public=dashboard.is_public,
            is_template=dashboard.is_template,
            layout_config=dashboard.layout_config,
            user_id=dashboard.user_id,
            organization_id=dashboard.organization_id,
            department_id=dashboard.department_id,
            created_at=dashboard.created_at,
            updated_at=dashboard.updated_at,
            widgets_count=widgets_count,
            data_sources_count=data_sources_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dashboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: int,
    request: DashboardUpdateRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Обновление дашборда
    """
    try:
        # Получаем дашборд
        query = select(Dashboard).where(Dashboard.id == dashboard_id)
        result = await session.execute(query)
        dashboard = result.scalar_one_or_none()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Проверяем права доступа
        if not await _can_edit_dashboard(user, dashboard, session):
            raise HTTPException(status_code=403, detail="Access denied to edit dashboard")
        
        # Обновляем поля
        if request.name is not None:
            dashboard.name = request.name
        if request.description is not None:
            dashboard.description = request.description
        if request.theme is not None:
            dashboard.theme = request.theme
        if request.is_public is not None:
            dashboard.is_public = request.is_public
        if request.is_template is not None:
            dashboard.is_template = request.is_template
        if request.layout_config is not None:
            dashboard.layout_config = request.layout_config
        
        dashboard.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(dashboard)
        
        logger.info(f"Dashboard updated: {dashboard.id} by user {user.id}")
        
        return DashboardResponse(
            id=dashboard.id,
            name=dashboard.name,
            description=dashboard.description,
            theme=dashboard.theme,
            is_public=dashboard.is_public,
            is_template=dashboard.is_template,
            layout_config=dashboard.layout_config,
            user_id=dashboard.user_id,
            organization_id=dashboard.organization_id,
            department_id=dashboard.department_id,
            created_at=dashboard.created_at,
            updated_at=dashboard.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating dashboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Удаление дашборда
    """
    try:
        # Получаем дашборд
        query = select(Dashboard).where(Dashboard.id == dashboard_id)
        result = await session.execute(query)
        dashboard = result.scalar_one_or_none()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Проверяем права доступа
        if not await _can_edit_dashboard(user, dashboard, session):
            raise HTTPException(status_code=403, detail="Access denied to delete dashboard")
        
        # Удаляем дашборд (каскадное удаление виджетов и источников данных)
        await session.delete(dashboard)
        await session.commit()
        
        logger.info(f"Dashboard deleted: {dashboard_id} by user {user.id}")
        
        return {"message": "Dashboard deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting dashboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{dashboard_id}/widgets", response_model=WidgetResponse)
async def add_widget_to_dashboard(
    dashboard_id: int,
    request: WidgetCreateRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Добавление виджета на дашборд
    """
    try:
        # Проверяем существование дашборда
        dashboard_query = select(Dashboard).where(Dashboard.id == dashboard_id)
        dashboard_result = await session.execute(dashboard_query)
        dashboard = dashboard_result.scalar_one_or_none()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Проверяем права доступа
        if not await _can_edit_dashboard(user, dashboard, session):
            raise HTTPException(status_code=403, detail="Access denied to edit dashboard")
        
        # Проверяем существование виджета
        widget_query = select(Widget).where(Widget.id == request.widget_id)
        widget_result = await session.execute(widget_query)
        widget = widget_result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Widget template not found")
        
        # Проверяем существование источника данных (если указан)
        if request.data_source_id:
            data_source_query = select(DashboardDataSource).where(
                and_(
                    DashboardDataSource.id == request.data_source_id,
                    DashboardDataSource.dashboard_id == dashboard_id
                )
            )
            data_source_result = await session.execute(data_source_query)
            data_source = data_source_result.scalar_one_or_none()
            
            if not data_source:
                raise HTTPException(status_code=404, detail="Data source not found")
        
        # Создаем виджет на дашборде
        dashboard_widget = DashboardWidget(
            dashboard_id=dashboard_id,
            widget_id=request.widget_id,
            title=request.title,
            position_x=request.position_x,
            position_y=request.position_y,
            width=request.width,
            height=request.height,
            config=request.config,
            data_source_id=request.data_source_id,
            refresh_interval=request.refresh_interval
        )
        
        session.add(dashboard_widget)
        await session.commit()
        await session.refresh(dashboard_widget)
        
        logger.info(f"Widget added to dashboard: {dashboard_widget.id} on dashboard {dashboard_id}")
        
        return WidgetResponse(
            id=dashboard_widget.id,
            dashboard_id=dashboard_widget.dashboard_id,
            widget_id=dashboard_widget.widget_id,
            title=dashboard_widget.title,
            position_x=dashboard_widget.position_x,
            position_y=dashboard_widget.position_y,
            width=dashboard_widget.width,
            height=dashboard_widget.height,
            config=dashboard_widget.config,
            data_source_id=dashboard_widget.data_source_id,
            is_visible=dashboard_widget.is_visible,
            refresh_interval=dashboard_widget.refresh_interval,
            last_refresh=dashboard_widget.last_refresh,
            created_at=dashboard_widget.created_at,
            updated_at=dashboard_widget.updated_at,
            widget_name=widget.name,
            widget_type=widget.widget_type,
            widget_category=widget.category
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding widget to dashboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{dashboard_id}/widgets", response_model=List[WidgetResponse])
async def list_dashboard_widgets(
    dashboard_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение списка виджетов дашборда
    """
    try:
        # Проверяем существование дашборда
        dashboard_query = select(Dashboard).where(Dashboard.id == dashboard_id)
        dashboard_result = await session.execute(dashboard_query)
        dashboard = dashboard_result.scalar_one_or_none()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Проверяем права доступа
        if not await _can_access_dashboard(user, dashboard, session):
            raise HTTPException(status_code=403, detail="Access denied to dashboard")
        
        # Получаем виджеты с информацией о шаблонах
        query = select(DashboardWidget).options(
            selectinload(DashboardWidget.widget)
        ).where(DashboardWidget.dashboard_id == dashboard_id)
        
        result = await session.execute(query)
        dashboard_widgets = result.scalars().all()
        
        # Формируем ответ
        widget_responses = []
        for dw in dashboard_widgets:
            widget_responses.append(WidgetResponse(
                id=dw.id,
                dashboard_id=dw.dashboard_id,
                widget_id=dw.widget_id,
                title=dw.title,
                position_x=dw.position_x,
                position_y=dw.position_y,
                width=dw.width,
                height=dw.height,
                config=dw.config,
                data_source_id=dw.data_source_id,
                is_visible=dw.is_visible,
                refresh_interval=dw.refresh_interval,
                last_refresh=dw.last_refresh,
                created_at=dw.created_at,
                updated_at=dw.updated_at,
                widget_name=dw.widget.name if dw.widget else None,
                widget_type=dw.widget.widget_type if dw.widget else None,
                widget_category=dw.widget.category if dw.widget else None
            ))
        
        return widget_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing dashboard widgets: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Вспомогательные функции для проверки прав доступа

async def _can_access_dashboard(user, dashboard, session):
    """Проверка права доступа к дашборду"""
    # Владелец всегда имеет доступ
    if dashboard.user_id == user.id:
        return True
    
    # Публичные дашборды доступны всем
    if dashboard.is_public:
        return True
    
    # Проверяем права через организацию/департамент
    if dashboard.organization_id and user.organization_id == dashboard.organization_id:
        return True
    
    if dashboard.department_id and user.department_id == dashboard.department_id:
        return True
    
    return False

async def _can_edit_dashboard(user, dashboard, session):
    """Проверка права редактирования дашборда"""
    # Владелец может редактировать
    if dashboard.user_id == user.id:
        return True
    
    # Админы могут редактировать все
    if user.role == "admin":
        return True
    
    # CEO может редактировать дашборды своей организации
    if user.role == "CEO" and dashboard.organization_id == user.organization_id:
        return True
    
    # Менеджеры могут редактировать дашборды своего департамента
    if user.role == "manager" and dashboard.department_id == user.department_id:
        return True
    
    return False

async def _can_manage_organization(user, organization_id, session):
    """Проверка права управления организацией"""
    if user.role == "admin":
        return True
    
    if user.role == "CEO" and user.organization_id == organization_id:
        return True
    
    return False

async def _can_manage_department(user, department_id, session):
    """Проверка права управления департаментом"""
    if user.role == "admin":
        return True
    
    if user.role == "CEO":
        # Получаем информацию о департаменте
        from core.database.models.main_models import Department
        dept_query = select(Department).where(Department.id == department_id)
        dept_result = await session.execute(dept_query)
        dept = dept_result.scalar_one_or_none()
        
        if dept and dept.organization_id == user.organization_id:
            return True
    
    if user.role == "manager" and user.department_id == department_id:
        return True
    
    return False
