"""
API для личного кабинета и управления виджетами
"""

import uuid
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
import logging
from datetime import datetime

from backend.api.configuration.auth import verify_authorization, require_role
from backend.api.configuration.server import Server
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.services.widget_service import PersonalDashboardService, WidgetService
from core.database.models.personal_dashboard_model import (
    WidgetCategory, WidgetType, PersonalWidget, QuickAction, UserPreference
)
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload, joinedload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/personal-dashboard", tags=["personal-dashboard"])

# Pydantic модели для API

class WidgetCreateRequest(BaseModel):
    """Запрос на создание виджета"""
    name: str = Field(..., min_length=1, max_length=255, description="Название виджета")
    widget_type: WidgetType = Field(..., description="Тип виджета")
    category: WidgetCategory = Field(..., description="Категория виджета")
    config: Optional[Dict[str, Any]] = Field(None, description="Конфигурация виджета")
    position_x: int = Field(0, ge=0, description="Позиция X")
    position_y: int = Field(0, ge=0, description="Позиция Y")
    width: int = Field(6, ge=1, le=12, description="Ширина виджета")
    height: int = Field(4, ge=1, le=20, description="Высота виджета")


class WidgetUpdateRequest(BaseModel):
    """Запрос на обновление виджета"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    config: Optional[Dict[str, Any]] = Field(None)
    position_x: Optional[int] = Field(None, ge=0)
    position_y: Optional[int] = Field(None, ge=0)
    width: Optional[int] = Field(None, ge=1, le=12)
    height: Optional[int] = Field(None, ge=1, le=20)
    is_visible: Optional[bool] = Field(None)
    is_minimized: Optional[bool] = Field(None)
    is_pinned: Optional[bool] = Field(None)


class WidgetPositionUpdateRequest(BaseModel):
    """Запрос на обновление позиции виджета"""
    position_x: int = Field(..., ge=0)
    position_y: int = Field(..., ge=0)
    width: Optional[int] = Field(None, ge=1, le=12)
    height: Optional[int] = Field(None, ge=1, le=20)


class QuickActionCreateRequest(BaseModel):
    """Запрос на создание быстрого действия"""
    name: str = Field(..., min_length=1, max_length=255, description="Название действия")
    description: Optional[str] = Field(None, description="Описание действия")
    icon: Optional[str] = Field(None, description="Иконка действия")
    action_type: str = Field(..., description="Тип действия")
    action_config: Dict[str, Any] = Field(..., description="Конфигурация действия")


class QuickActionUpdateRequest(BaseModel):
    """Запрос на обновление быстрого действия"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None)
    icon: Optional[str] = Field(None)
    action_type: Optional[str] = Field(None)
    action_config: Optional[Dict[str, Any]] = Field(None)
    position: Optional[int] = Field(None, ge=0)
    is_visible: Optional[bool] = Field(None)
    is_pinned: Optional[bool] = Field(None)


class UserPreferencesUpdateRequest(BaseModel):
    """Запрос на обновление пользовательских предпочтений"""
    # Настройки интерфейса
    ui_theme: Optional[str] = Field(None, description="Тема интерфейса")
    ui_density: Optional[str] = Field(None, description="Плотность интерфейса")
    ui_animations: Optional[bool] = Field(None, description="Анимации интерфейса")
    ui_sounds: Optional[bool] = Field(None, description="Звуки интерфейса")
    
    # Настройки дашборда
    dashboard_layout: Optional[str] = Field(None, description="Макет дашборда")
    dashboard_columns: Optional[int] = Field(None, ge=1, le=24, description="Количество колонок")
    dashboard_auto_refresh: Optional[bool] = Field(None, description="Автообновление дашборда")
    dashboard_refresh_interval: Optional[int] = Field(None, ge=30, description="Интервал обновления")
    
    # Настройки уведомлений
    notification_email: Optional[bool] = Field(None, description="Email уведомления")
    notification_push: Optional[bool] = Field(None, description="Push уведомления")
    notification_sound: Optional[bool] = Field(None, description="Звуковые уведомления")
    notification_frequency: Optional[str] = Field(None, description="Частота уведомлений")
    
    # Настройки приватности
    profile_visibility: Optional[str] = Field(None, description="Видимость профиля")
    activity_visibility: Optional[str] = Field(None, description="Видимость активности")
    status_visibility: Optional[str] = Field(None, description="Видимость статуса")


class DashboardLayoutUpdateRequest(BaseModel):
    """Запрос на обновление макета дашборда"""
    theme: Optional[str] = Field(None, description="Тема дашборда")
    layout_config: Optional[Dict[str, Any]] = Field(None, description="Конфигурация макета")
    sidebar_config: Optional[Dict[str, Any]] = Field(None, description="Конфигурация боковой панели")
    header_config: Optional[Dict[str, Any]] = Field(None, description="Конфигурация заголовка")
    show_sidebar: Optional[bool] = Field(None, description="Показать боковую панель")
    show_header: Optional[bool] = Field(None, description="Показать заголовок")
    show_footer: Optional[bool] = Field(None, description="Показать подвал")
    compact_mode: Optional[bool] = Field(None, description="Компактный режим")


class OverviewCardLayoutRequest(BaseModel):
    """Запрос на обновление расположения карточек обзора"""
    card_id: str = Field(..., description="ID карточки (priorities, overdue, upcoming, projects, notes, checklist, time-management)")
    position: int = Field(..., description="Позиция карточки в сетке (0-7)")
    visible: bool = Field(True, description="Видимость карточки")


class OverviewLayoutUpdateRequest(BaseModel):
    """Запрос на обновление layout карточек обзора"""
    cards: List[OverviewCardLayoutRequest] = Field(..., description="Список карточек с их позициями")


class WidgetResponse(BaseModel):
    """Ответ с данными виджета"""
    id: int
    name: str
    widget_type: str
    category: str
    position_x: int
    position_y: int
    width: int
    height: int
    config: Optional[Dict[str, Any]]
    is_visible: bool
    is_minimized: bool
    is_pinned: bool
    data: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class QuickActionResponse(BaseModel):
    """Ответ с данными быстрого действия"""
    id: int
    name: str
    description: Optional[str]
    icon: Optional[str]
    action_type: str
    action_config: Dict[str, Any]
    position: int
    is_visible: bool
    is_pinned: bool
    usage_count: int
    last_used: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class DashboardLayoutResponse(BaseModel):
    """Ответ с макетом дашборда"""
    dashboard: Dict[str, Any]
    widgets: List[WidgetResponse]
    quick_actions: List[QuickActionResponse]
    preferences: Dict[str, Any]


# Вспомогательные функции

def can_access_widget(user, widget_user_id: int) -> bool:
    """Проверка прав доступа к виджету"""
    user_role = getattr(user, "role", "")
    current_user_id = user.id
    
    # Пользователь может управлять только своими виджетами
    if user_role in ["admin", "CEO"]:
        return True
    
    return current_user_id == widget_user_id


# API endpoints

@router.get("/layout", response_model=DashboardLayoutResponse)
async def get_dashboard_layout(
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение макета личного кабинета"""
    
    try:
        service = PersonalDashboardService(session)
        layout_data = await service.get_dashboard_layout(user.id)
        
        return DashboardLayoutResponse(**layout_data)
        
    except Exception as e:
        logger.error(f"Error getting dashboard layout: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении макета дашборда")


@router.put("/layout", response_model=DashboardLayoutResponse)
async def update_dashboard_layout(
    layout_update: DashboardLayoutUpdateRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Обновление макета личного кабинета"""
    
    try:
        service = PersonalDashboardService(session)
        widget_service = WidgetService(session)
        
        # Получаем личный кабинет
        dashboard = await widget_service.get_personal_dashboard(user.id)
        if not dashboard:
            dashboard = await service.initialize_user_dashboard(user.id)
        
        # Обновляем настройки дашборда
        update_data = layout_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(dashboard, key):
                setattr(dashboard, key, value)
        
        dashboard.updated_at = datetime.now()
        await session.commit()
        
        # Возвращаем обновленный макет
        layout_data = await service.get_dashboard_layout(user.id)
        return DashboardLayoutResponse(**layout_data)
        
    except Exception as e:
        logger.error(f"Error updating dashboard layout: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при обновлении макета дашборда")


@router.post("/widgets", response_model=WidgetResponse)
async def create_widget(
    widget_request: WidgetCreateRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Создание нового виджета"""
    
    try:
        service = WidgetService(session)
        
        # Получаем личный кабинет
        dashboard = await service.get_personal_dashboard(user.id)
        if not dashboard:
            dashboard_service = PersonalDashboardService(session)
            dashboard = await dashboard_service.initialize_user_dashboard(user.id)
        
        # Создаем виджет
        widget = await service.create_widget(
            dashboard_id=dashboard.id,
            name=widget_request.name,
            widget_type=widget_request.widget_type,
            category=widget_request.category,
            config=widget_request.config,
            position_x=widget_request.position_x,
            position_y=widget_request.position_y,
            width=widget_request.width,
            height=widget_request.height
        )
        
        # Получаем данные виджета
        widget_data = await service.get_widget_data(widget.id)
        
        return WidgetResponse(
            id=widget.id,
            name=widget.name,
            widget_type=widget.widget_type,
            category=widget.category,
            position_x=widget.position_x,
            position_y=widget.position_y,
            width=widget.width,
            height=widget.height,
            config=widget.config,
            is_visible=widget.is_visible,
            is_minimized=widget.is_minimized,
            is_pinned=widget.is_pinned,
            data=widget_data,
            created_at=widget.created_at,
            updated_at=widget.updated_at
        )
        
    except Exception as e:
        logger.error(f"Error creating widget: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при создании виджета")


@router.get("/widgets/{widget_id}", response_model=WidgetResponse)
async def get_widget(
    widget_id: int,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение виджета по ID"""
    
    try:
        service = WidgetService(session)
        
        # Получаем виджет
        result = await session.execute(
            select(PersonalWidget)
            .options(selectinload(PersonalWidget.dashboard))
            .where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Виджет не найден")
        
        # Проверяем права доступа
        if not can_access_widget(user, widget.dashboard.user_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав для доступа к виджету")
        
        # Получаем данные виджета
        widget_data = await service.get_widget_data(widget.id)
        
        return WidgetResponse(
            id=widget.id,
            name=widget.name,
            widget_type=widget.widget_type,
            category=widget.category,
            position_x=widget.position_x,
            position_y=widget.position_y,
            width=widget.width,
            height=widget.height,
            config=widget.config,
            is_visible=widget.is_visible,
            is_minimized=widget.is_minimized,
            is_pinned=widget.is_pinned,
            data=widget_data,
            created_at=widget.created_at,
            updated_at=widget.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting widget: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении виджета")


@router.put("/widgets/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    widget_id: int,
    widget_update: WidgetUpdateRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Обновление виджета"""
    
    try:
        service = WidgetService(session)
        
        # Получаем виджет
        result = await session.execute(
            select(PersonalWidget)
            .options(selectinload(PersonalWidget.dashboard))
            .where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Виджет не найден")
        
        # Проверяем права доступа
        if not can_access_widget(user, widget.dashboard.user_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования виджета")
        
        # Обновляем виджет
        update_data = widget_update.dict(exclude_unset=True)
        
        if "config" in update_data:
            await service.update_widget_config(widget_id, update_data["config"])
        
        if any(key in update_data for key in ["position_x", "position_y", "width", "height"]):
            await service.update_widget_position(
                widget_id=widget_id,
                position_x=update_data.get("position_x", widget.position_x),
                position_y=update_data.get("position_y", widget.position_y),
                width=update_data.get("width"),
                height=update_data.get("height")
            )
        
        # Обновляем остальные поля
        for key, value in update_data.items():
            if key not in ["config", "position_x", "position_y", "width", "height"]:
                if hasattr(widget, key):
                    setattr(widget, key, value)
        
        widget.updated_at = datetime.now()
        await session.commit()
        
        # Получаем обновленные данные
        updated_widget = await session.execute(
            select(PersonalWidget).where(PersonalWidget.id == widget_id)
        )
        updated_widget = updated_widget.scalar_one_or_none()
        
        widget_data = await service.get_widget_data(widget_id)
        
        return WidgetResponse(
            id=updated_widget.id,
            name=updated_widget.name,
            widget_type=updated_widget.widget_type,
            category=updated_widget.category,
            position_x=updated_widget.position_x,
            position_y=updated_widget.position_y,
            width=updated_widget.width,
            height=updated_widget.height,
            config=updated_widget.config,
            is_visible=updated_widget.is_visible,
            is_minimized=updated_widget.is_minimized,
            is_pinned=updated_widget.is_pinned,
            data=widget_data,
            created_at=updated_widget.created_at,
            updated_at=updated_widget.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating widget: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при обновлении виджета")


@router.delete("/widgets/{widget_id}")
async def delete_widget(
    widget_id: int,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Удаление виджета"""
    
    try:
        service = WidgetService(session)
        
        # Получаем виджет
        result = await session.execute(
            select(PersonalWidget)
            .options(selectinload(PersonalWidget.dashboard))
            .where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Виджет не найден")
        
        # Проверяем права доступа
        if not can_access_widget(user, widget.dashboard.user_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав для удаления виджета")
        
        # Удаляем виджет
        success = await service.delete_widget(widget_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Ошибка при удалении виджета")
        
        return {"message": "Виджет успешно удален"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting widget: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при удалении виджета")


@router.get("/widgets/{widget_id}/data")
async def get_widget_data(
    widget_id: int,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение данных виджета"""
    
    try:
        service = WidgetService(session)
        
        # Получаем виджет
        result = await session.execute(
            select(PersonalWidget)
            .options(selectinload(PersonalWidget.dashboard))
            .where(PersonalWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        
        if not widget:
            raise HTTPException(status_code=404, detail="Виджет не найден")
        
        # Проверяем права доступа
        if not can_access_widget(user, widget.dashboard.user_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав для доступа к данным виджета")
        
        # Получаем данные виджета
        widget_data = await service.get_widget_data(widget_id)
        
        return {"data": widget_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting widget data: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении данных виджета")


@router.post("/quick-actions", response_model=QuickActionResponse)
async def create_quick_action(
    action_request: QuickActionCreateRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Создание быстрого действия"""
    
    try:
        service = WidgetService(session)
        
        action = await service.create_quick_action(
            user_id=user.id,
            name=action_request.name,
            description=action_request.description,
            icon=action_request.icon,
            action_type=action_request.action_type,
            action_config=action_request.action_config
        )
        
        return QuickActionResponse(
            id=action.id,
            name=action.name,
            description=action.description,
            icon=action.icon,
            action_type=action.action_type,
            action_config=action.action_config,
            position=action.position,
            is_visible=action.is_visible,
            is_pinned=action.is_pinned,
            usage_count=action.usage_count,
            last_used=action.last_used,
            created_at=action.created_at,
            updated_at=action.updated_at
        )
        
    except Exception as e:
        logger.error(f"Error creating quick action: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при создании быстрого действия")


@router.get("/quick-actions", response_model=List[QuickActionResponse])
async def get_quick_actions(
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение быстрых действий пользователя"""
    
    try:
        service = WidgetService(session)
        actions = await service.get_user_quick_actions(user.id)
        
        return [
            QuickActionResponse(
                id=action.id,
                name=action.name,
                description=action.description,
                icon=action.icon,
                action_type=action.action_type,
                action_config=action.action_config,
                position=action.position,
                is_visible=action.is_visible,
                is_pinned=action.is_pinned,
                usage_count=action.usage_count,
                last_used=action.last_used,
                created_at=action.created_at,
                updated_at=action.updated_at
            )
            for action in actions
        ]
        
    except Exception as e:
        logger.error(f"Error getting quick actions: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении быстрых действий")


@router.put("/quick-actions/{action_id}", response_model=QuickActionResponse)
async def update_quick_action(
    action_id: int,
    action_update: QuickActionUpdateRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Обновление быстрого действия"""
    
    try:
        # Получаем действие
        result = await session.execute(
            select(QuickAction).where(
                and_(
                    QuickAction.id == action_id,
                    QuickAction.user_id == user.id
                )
            )
        )
        action = result.scalar_one_or_none()
        
        if not action:
            raise HTTPException(status_code=404, detail="Быстрое действие не найдено")
        
        # Обновляем действие
        update_data = action_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(action, key):
                setattr(action, key, value)
        
        action.updated_at = datetime.now()
        await session.commit()
        
        return QuickActionResponse(
            id=action.id,
            name=action.name,
            description=action.description,
            icon=action.icon,
            action_type=action.action_type,
            action_config=action.action_config,
            position=action.position,
            is_visible=action.is_visible,
            is_pinned=action.is_pinned,
            usage_count=action.usage_count,
            last_used=action.last_used,
            created_at=action.created_at,
            updated_at=action.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating quick action: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при обновлении быстрого действия")


@router.delete("/quick-actions/{action_id}")
async def delete_quick_action(
    action_id: int,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Удаление быстрого действия"""
    
    try:
        # Получаем действие
        result = await session.execute(
            select(QuickAction).where(
                and_(
                    QuickAction.id == action_id,
                    QuickAction.user_id == user.id
                )
            )
        )
        action = result.scalar_one_or_none()
        
        if not action:
            raise HTTPException(status_code=404, detail="Быстрое действие не найдено")
        
        # Удаляем действие
        await session.delete(action)
        await session.commit()
        
        return {"message": "Быстрое действие успешно удалено"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting quick action: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при удалении быстрого действия")


@router.put("/preferences")
async def update_user_preferences(
    preferences_update: UserPreferencesUpdateRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Обновление пользовательских предпочтений"""
    
    try:
        service = WidgetService(session)
        
        preferences = await service.update_user_preferences(
            user_id=user.id,
            preferences=preferences_update.dict(exclude_unset=True)
        )
        
        return {
            "message": "Предпочтения успешно обновлены",
            "preferences": {
                "ui_theme": preferences.ui_theme,
                "ui_density": preferences.ui_density,
                "ui_animations": preferences.ui_animations,
                "ui_sounds": preferences.ui_sounds,
                "dashboard_layout": preferences.dashboard_layout,
                "dashboard_columns": preferences.dashboard_columns,
                "dashboard_auto_refresh": preferences.dashboard_auto_refresh,
                "dashboard_refresh_interval": preferences.dashboard_refresh_interval,
                "notification_email": preferences.notification_email,
                "notification_push": preferences.notification_push,
                "notification_sound": preferences.notification_sound,
                "notification_frequency": preferences.notification_frequency,
                "profile_visibility": preferences.profile_visibility,
                "activity_visibility": preferences.activity_visibility,
                "status_visibility": preferences.status_visibility
            }
        }
        
    except Exception as e:
        logger.error(f"Error updating user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при обновлении предпочтений")


@router.get("/preferences")
async def get_user_preferences(
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение пользовательских предпочтений"""
    
    try:
        service = WidgetService(session)
        preferences = await service.get_user_preferences(user.id)
        
        if not preferences:
            return {"preferences": {}}
        
        return {
            "preferences": {
                "ui_theme": preferences.ui_theme,
                "ui_density": preferences.ui_density,
                "ui_animations": preferences.ui_animations,
                "ui_sounds": preferences.ui_sounds,
                "dashboard_layout": preferences.dashboard_layout,
                "dashboard_columns": preferences.dashboard_columns,
                "dashboard_auto_refresh": preferences.dashboard_auto_refresh,
                "dashboard_refresh_interval": preferences.dashboard_refresh_interval,
                "notification_email": preferences.notification_email,
                "notification_push": preferences.notification_push,
                "notification_sound": preferences.notification_sound,
                "notification_frequency": preferences.notification_frequency,
                "profile_visibility": preferences.profile_visibility,
                "activity_visibility": preferences.activity_visibility,
                "status_visibility": preferences.status_visibility
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении предпочтений")


@router.get("/widget-types")
async def get_widget_types():
    """Получение доступных типов виджетов"""
    
    return {
        "widget_types": [
            {
                "value": wt.value,
                "label": {
                    WidgetType.MINI_MAIL: "Мини-почта",
                    WidgetType.TODO_LIST: "Список дел",
                    WidgetType.CALENDAR: "Календарь событий",
                    WidgetType.NOTIFICATIONS: "Уведомления",
                    WidgetType.QUICK_ACTIONS: "Быстрые действия",
                    WidgetType.CHART: "График",
                    WidgetType.TABLE: "Таблица",
                    WidgetType.KPI: "KPI индикатор",
                    WidgetType.METRIC: "Метрика",
                    WidgetType.PROGRESS: "Прогресс-бар",
                    WidgetType.CHAT: "Чат",
                    WidgetType.MESSAGES: "Сообщения",
                    WidgetType.TEAM_STATUS: "Статус команды",
                    WidgetType.CUSTOM_HTML: "Пользовательский HTML",
                    WidgetType.EMBEDDED: "Встроенный контент",
                    WidgetType.API_DATA: "Данные из API"
                }.get(wt, wt.value)
            }
            for wt in WidgetType
        ],
        "widget_categories": [
            {
                "value": wc.value,
                "label": {
                    WidgetCategory.SYSTEM: "Системные",
                    WidgetCategory.PERSONAL: "Личные",
                    WidgetCategory.DASHBOARD: "Дашборды",
                    WidgetCategory.CUSTOM: "Пользовательские",
                    WidgetCategory.COMMUNICATION: "Коммуникация"
                }.get(wc, wc.value)
            }
            for wc in WidgetCategory
        ]
    }


@router.post("/initialize")
async def initialize_dashboard(
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Инициализация личного кабинета пользователя"""
    
    try:
        service = PersonalDashboardService(session)
        dashboard = await service.initialize_user_dashboard(user.id)
        
        return {
            "message": "Личный кабинет успешно инициализирован",
            "dashboard_id": dashboard.id
        }
        
    except Exception as e:
        logger.error(f"Error initializing dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при инициализации личного кабинета")


@router.get("/overview-layout")
async def get_overview_layout(
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение layout карточек обзора"""
    
    try:
        service = WidgetService(session)
        
        # Получаем настройки пользователя
        preferences = await service.get_user_preferences(user.id)
        
        # Дефолтный layout карточек обзора
        default_layout = {
            "priorities": {"position": 0, "visible": True},
            "overdue": {"position": 1, "visible": True},
            "upcoming": {"position": 2, "visible": True},
            "projects": {"position": 3, "visible": True},
            "notes": {"position": 4, "visible": True},
            "checklist": {"position": 5, "visible": True},
            "time-management": {"position": 6, "visible": True}
        }
        
        if preferences and hasattr(preferences, 'dashboard_layout') and preferences.dashboard_layout:
            # Если есть сохраненные настройки layout, используем их
            try:
                if isinstance(preferences.dashboard_layout, str):
                    import json
                    saved_layout = json.loads(preferences.dashboard_layout)
                else:
                    saved_layout = preferences.dashboard_layout
                
                if isinstance(saved_layout, dict) and "overview_cards" in saved_layout:
                    return {"layout": saved_layout["overview_cards"]}
            except:
                pass
        
        return {"layout": default_layout}
        
    except Exception as e:
        logger.error(f"Error getting overview layout: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении layout карточек")


@router.post("/overview-layout")
async def update_overview_layout(
    layout_update: OverviewLayoutUpdateRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Обновление layout карточек обзора"""
    
    try:
        service = WidgetService(session)
        
        # Получаем или создаем настройки пользователя
        preferences = await service.get_user_preferences(user.id)
        if not preferences:
            # Создаем новые настройки
            from core.database.models.personal_dashboard_model import UserPreference
            preferences = UserPreference(user_id=user.id)
            session.add(preferences)
            try:
                await session.flush()
            except Exception as e:
                # Если произошла ошибка дублирования, получаем существующую запись
                await session.rollback()
                preferences = await service.get_user_preferences(user.id)
                if not preferences:
                    raise e
        
        # Формируем новый layout из запроса
        layout_dict = {}
        for card in layout_update.cards:
            layout_dict[card.card_id] = {
                "position": card.position,
                "visible": card.visible
            }
        
        # Получаем текущий dashboard_layout или создаем новый
        current_layout = {}
        if preferences.dashboard_layout:
            try:
                if isinstance(preferences.dashboard_layout, str):
                    import json
                    current_layout = json.loads(preferences.dashboard_layout)
                else:
                    current_layout = preferences.dashboard_layout
            except:
                current_layout = {}
        
        # Обновляем секцию overview_cards
        current_layout["overview_cards"] = layout_dict
        
        # Сохраняем обновленный layout
        import json
        preferences.dashboard_layout = json.dumps(current_layout)
        preferences.updated_at = datetime.now()
        
        await session.commit()
        
        return {
            "message": "Layout карточек обзора успешно обновлен",
            "layout": layout_dict
        }
        
    except Exception as e:
        logger.error(f"Error updating overview layout: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при обновлении layout карточек")
