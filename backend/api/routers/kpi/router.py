"""
API для управления KPI
"""

import uuid
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
import logging
from datetime import datetime

from backend.api.configuration.auth import verify_authorization, require_role
from backend.api.configuration.server import Server
from backend.services.kpi_service import kpi_service, KPICalculation, KPITrend
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kpi", tags=["kpi"])

# Pydantic модели для API

class KPICreateRequest(BaseModel):
    """Запрос на создание KPI"""
    name: str = Field(..., min_length=1, max_length=255, description="Название KPI")
    description: Optional[str] = Field(None, description="Описание KPI")
    formula: str = Field(..., description="Формула расчета KPI")
    data_source: Dict[str, Any] = Field(..., description="Источник данных")
    target_value: Optional[Union[float, int]] = Field(None, description="Целевое значение")
    previous_period_days: int = Field(default=30, ge=0, description="Дни для сравнения")
    refresh_interval: int = Field(default=3600, ge=60, description="Интервал обновления в секундах")
    is_active: bool = Field(default=True, description="Активен ли KPI")
    category: str = Field(default="general", description="Категория KPI")
    unit: Optional[str] = Field(None, description="Единица измерения")

class KPIUpdateRequest(BaseModel):
    """Запрос на обновление KPI"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None)
    formula: Optional[str] = Field(None)
    data_source: Optional[Dict[str, Any]] = Field(None)
    target_value: Optional[Union[float, int]] = Field(None)
    previous_period_days: Optional[int] = Field(None, ge=0)
    refresh_interval: Optional[int] = Field(None, ge=60)
    is_active: Optional[bool] = Field(None)
    category: Optional[str] = Field(None)
    unit: Optional[str] = Field(None)

class KPIResponse(BaseModel):
    """Ответ с данными KPI"""
    id: int
    name: str
    description: Optional[str]
    formula: str
    data_source: Dict[str, Any]
    target_value: Optional[Union[float, int]]
    previous_period_days: int
    refresh_interval: int
    is_active: bool
    category: str
    unit: Optional[str]
    created_by: int
    created_at: datetime
    updated_at: datetime
    last_calculation: Optional[datetime] = None
    current_value: Optional[Union[float, int]] = None
    current_status: Optional[str] = None
    current_trend: Optional[str] = None

class KPICalculationRequest(BaseModel):
    """Запрос на расчет KPI"""
    kpi_id: Optional[int] = Field(None, description="ID существующего KPI")
    formula: Optional[str] = Field(None, description="Формула для расчета")
    data_source: Optional[Dict[str, Any]] = Field(None, description="Источник данных")
    target_value: Optional[Union[float, int]] = Field(None, description="Целевое значение")
    previous_period_days: int = Field(default=30, ge=0, description="Дни для сравнения")

class KPICalculationResponse(BaseModel):
    """Ответ с результатом расчета KPI"""
    calculation_id: str
    kpi_id: Optional[int]
    value: Union[float, int]
    target: Optional[Union[float, int]]
    previous_value: Optional[Union[float, int]]
    trend: str
    change_percentage: Optional[float]
    status: str
    calculated_at: datetime
    insights: Dict[str, Any]
    metadata: Dict[str, Any]

class KPIInsightsResponse(BaseModel):
    """Ответ с аналитическими инсайтами"""
    summary: str
    recommendations: List[str]
    alerts: List[str]
    trend_analysis: Dict[str, Any]
    performance_metrics: Dict[str, Any]

# API эндпоинты

@router.post("/", response_model=KPIResponse)
async def create_kpi(
    request: KPICreateRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Создание нового KPI
    """
    try:
        # Валидируем формулу
        validation_result = kpi_service.validate_formula(request.formula)
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid formula: {validation_result['message']}"
            )
        
        # TODO: Сохраняем KPI в базу данных
        # Пока что возвращаем заглушку
        kpi_id = uuid.uuid4().int % 1000000  # Временный ID
        
        logger.info(f"KPI created: {kpi_id} by user {user.id}")
        
        return KPIResponse(
            id=kpi_id,
            name=request.name,
            description=request.description,
            formula=request.formula,
            data_source=request.data_source,
            target_value=request.target_value,
            previous_period_days=request.previous_period_days,
            refresh_interval=request.refresh_interval,
            is_active=request.is_active,
            category=request.category,
            unit=request.unit,
            created_by=user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating KPI: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[KPIResponse])
async def list_kpis(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db),
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    is_active: Optional[bool] = Query(None, description="Фильтр по активности")
):
    """
    Получение списка KPI
    """
    try:
        # TODO: Получаем KPI из базы данных
        # Пока что возвращаем пустой список
        return []
        
    except Exception as e:
        logger.error(f"Error listing KPIs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kpi_id}", response_model=KPIResponse)
async def get_kpi(
    kpi_id: int,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение KPI по ID
    """
    try:
        # TODO: Получаем KPI из базы данных
        # Пока что возвращаем ошибку
        raise HTTPException(status_code=404, detail="KPI not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting KPI: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/calculate", response_model=KPICalculationResponse)
async def calculate_kpi(
    request: KPICalculationRequest,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Расчет KPI
    """
    try:
        # Определяем параметры для расчета
        if request.kpi_id:
            # TODO: Получаем KPI из базы данных
            raise HTTPException(status_code=404, detail="KPI not found")
        else:
            # Используем переданные параметры
            if not request.formula or not request.data_source:
                raise HTTPException(
                    status_code=400,
                    detail="Formula and data_source are required when kpi_id is not provided"
                )
            
            formula = request.formula
            data_source = request.data_source
            target_value = request.target_value
            previous_period_days = request.previous_period_days
        
        # Валидируем формулу
        validation_result = kpi_service.validate_formula(formula)
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid formula: {validation_result['message']}"
            )
        
        # Рассчитываем KPI
        kpi_calculation = await kpi_service.calculate_kpi(
            formula=formula,
            data_source=data_source,
            target_value=target_value,
            previous_period_days=previous_period_days
        )
        
        # Получаем инсайты
        insights = await kpi_service.get_kpi_insights(kpi_calculation)
        
        calculation_id = str(uuid.uuid4())
        
        logger.info(f"KPI calculated: {calculation_id} by user {user.id}")
        
        return KPICalculationResponse(
            calculation_id=calculation_id,
            kpi_id=request.kpi_id,
            value=kpi_calculation.value,
            target=kpi_calculation.target,
            previous_value=kpi_calculation.previous_value,
            trend=kpi_calculation.trend.value,
            change_percentage=kpi_calculation.change_percentage,
            status=kpi_calculation.status,
            calculated_at=kpi_calculation.calculated_at,
            insights=insights,
            metadata=kpi_calculation.metadata or {}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating KPI: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/calculate/batch", response_model=List[KPICalculationResponse])
async def calculate_multiple_kpis(
    requests: List[KPICalculationRequest],
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Расчет нескольких KPI одновременно
    """
    try:
        if not requests:
            raise HTTPException(status_code=400, detail="No KPI requests provided")
        
        # Подготавливаем конфигурации для массового расчета
        kpi_configs = []
        for req in requests:
            if req.kpi_id:
                # TODO: Получаем KPI из базы данных
                raise HTTPException(status_code=404, detail=f"KPI {req.kpi_id} not found")
            else:
                if not req.formula or not req.data_source:
                    raise HTTPException(
                        status_code=400,
                        detail="Formula and data_source are required when kpi_id is not provided"
                    )
                
                kpi_configs.append({
                    "formula": req.formula,
                    "data_source": req.data_source,
                    "target_value": req.target_value,
                    "previous_period_days": req.previous_period_days
                })
        
        # Рассчитываем все KPI
        kpi_calculations = await kpi_service.calculate_multiple_kpis(kpi_configs)
        
        # Формируем ответы
        responses = []
        for i, calculation in enumerate(kpi_calculations):
            if calculation.status == "error":
                # Пропускаем KPI с ошибками
                continue
            
            # Получаем инсайты
            insights = await kpi_service.get_kpi_insights(calculation)
            
            calculation_id = str(uuid.uuid4())
            
            responses.append(KPICalculationResponse(
                calculation_id=calculation_id,
                kpi_id=requests[i].kpi_id if i < len(requests) else None,
                value=calculation.value,
                target=calculation.target,
                previous_value=calculation.previous_value,
                trend=calculation.trend.value,
                change_percentage=calculation.change_percentage,
                status=calculation.status,
                calculated_at=calculation.calculated_at,
                insights=insights,
                metadata=calculation.metadata or {}
            ))
        
        logger.info(f"Multiple KPIs calculated: {len(responses)} by user {user.id}")
        
        return responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating multiple KPIs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/formulas/templates")
async def get_kpi_formula_templates(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение шаблонов формул KPI
    """
    try:
        templates = kpi_service.get_kpi_formula_templates()
        
        return {
            "templates": templates,
            "total_count": len(templates),
            "categories": list(set(template["category"] for template in templates))
        }
        
    except Exception as e:
        logger.error(f"Error getting KPI formula templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/formulas/validate")
async def validate_kpi_formula(
    formula: str = Query(..., description="Формула для валидации"),
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Валидация формулы KPI
    """
    try:
        validation_result = kpi_service.validate_formula(formula)
        
        return {
            "valid": validation_result["valid"],
            "type": validation_result["type"],
            "message": validation_result["message"]
        }
        
    except Exception as e:
        logger.error(f"Error validating KPI formula: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/insights/{calculation_id}", response_model=KPIInsightsResponse)
async def get_kpi_insights(
    calculation_id: str,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение аналитических инсайтов по KPI
    """
    try:
        # TODO: Получаем результат расчета из базы данных или кэша
        # Пока что возвращаем заглушку
        raise HTTPException(status_code=404, detail="Calculation not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting KPI insights: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/refresh/{kpi_id}")
async def refresh_kpi(
    kpi_id: int,
    background_tasks: BackgroundTasks,
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Принудительное обновление KPI
    """
    try:
        # TODO: Получаем KPI из базы данных
        # Пока что возвращаем ошибку
        raise HTTPException(status_code=404, detail="KPI not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing KPI: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/categories/list")
async def get_kpi_categories(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение списка категорий KPI
    """
    try:
        # TODO: Получаем категории из базы данных
        categories = [
            "general",
            "sales",
            "marketing",
            "finance",
            "operations",
            "customer",
            "employee",
            "performance"
        ]
        
        return {"categories": categories}
        
    except Exception as e:
        logger.error(f"Error getting KPI categories: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/status/summary")
async def get_kpi_status_summary(
    user = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """
    Получение сводки по статусам KPI
    """
    try:
        # TODO: Получаем статистику из базы данных
        summary = {
            "total_kpis": 0,
            "active_kpis": 0,
            "success_count": 0,
            "warning_count": 0,
            "critical_count": 0,
            "error_count": 0,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting KPI status summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
