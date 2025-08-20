"""
API для генерации отчетов и аналитики
"""

import uuid
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, Response
from pydantic import BaseModel, Field
import logging
from datetime import datetime, date

from backend.api.configuration.auth import verify_authorization, require_role
from backend.api.configuration.server import Server
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.services.reports_service import (
    ReportsService, ReportGenerator, ReportType, ExportFormat, report_generator
)
from core.database.models.task_model import TaskStatus, TaskPriority, TaskType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Pydantic модели для API

class ReportFilters(BaseModel):
    """Базовые фильтры для отчетов"""
    start_date: Optional[datetime] = Field(None, description="Дата начала периода")
    end_date: Optional[datetime] = Field(None, description="Дата окончания периода")
    user_id: Optional[int] = Field(None, description="ID пользователя")
    department_id: Optional[int] = Field(None, description="ID департамента")
    organization_id: Optional[int] = Field(None, description="ID организации")


class TaskSummaryFilters(ReportFilters):
    """Фильтры для сводного отчета по задачам"""
    status_filter: Optional[List[TaskStatus]] = Field(None, description="Фильтр по статусам")
    priority_filter: Optional[List[TaskPriority]] = Field(None, description="Фильтр по приоритетам")


class PerformanceFilters(BaseModel):
    """Фильтры для отчета по производительности"""
    start_date: Optional[datetime] = Field(None, description="Дата начала периода")
    end_date: Optional[datetime] = Field(None, description="Дата окончания периода")
    department_id: Optional[int] = Field(None, description="ID департамента")
    organization_id: Optional[int] = Field(None, description="ID организации")


class TimeTrackingFilters(BaseModel):
    """Фильтры для отчета по учету времени"""
    start_date: Optional[datetime] = Field(None, description="Дата начала периода")
    end_date: Optional[datetime] = Field(None, description="Дата окончания периода")
    user_id: Optional[int] = Field(None, description="ID пользователя")
    task_id: Optional[int] = Field(None, description="ID задачи")


class ExportRequest(BaseModel):
    """Запрос на экспорт отчета"""
    report_type: ReportType = Field(..., description="Тип отчета")
    format_type: ExportFormat = Field(..., description="Формат экспорта")
    filters: Optional[Dict[str, Any]] = Field(None, description="Фильтры для отчета")


class ReportResponse(BaseModel):
    """Ответ с данными отчета"""
    report_type: str
    generated_at: datetime
    filters: Dict[str, Any]
    data: Dict[str, Any]


# Вспомогательные функции

def can_access_reports(user: Dict[str, Any], organization_id: Optional[int] = None, department_id: Optional[int] = None) -> bool:
    """Проверка прав доступа к отчетам"""
    user_role = user.get("role", "")
    user_org_id = user.get("organization_id")
    user_dept_id = user.get("department_id")
    
    # Админы и CEO могут видеть все отчеты
    if user_role in ["admin", "CEO"]:
        return True
    
    # Менеджеры могут видеть отчеты своего департамента и организации
    if user_role == "manager":
        if organization_id and organization_id != user_org_id:
            return False
        if department_id and department_id != user_dept_id:
            return False
        return True
    
    # Обычные сотрудники могут видеть только свои отчеты
    if user_role == "employee":
        # Они не могут смотреть отчеты по другим пользователям
        return organization_id == user_org_id and department_id == user_dept_id
    
    return False


# API endpoints

@router.get("/task-summary", response_model=Dict[str, Any])
async def get_task_summary_report(
    start_date: Optional[datetime] = Query(None, description="Дата начала периода"),
    end_date: Optional[datetime] = Query(None, description="Дата окончания периода"),
    user_id: Optional[int] = Query(None, description="ID пользователя"),
    department_id: Optional[int] = Query(None, description="ID департамента"),
    organization_id: Optional[int] = Query(None, description="ID организации"),
    status_filter: Optional[List[str]] = Query(None, description="Фильтр по статусам"),
    priority_filter: Optional[List[str]] = Query(None, description="Фильтр по приоритетам"),
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение сводного отчета по задачам"""
    
    # Проверяем права доступа
    if not can_access_reports(user, organization_id, department_id):
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра отчетов")
    
    try:
        # Преобразуем строковые фильтры в enum
        status_enum_filter = None
        if status_filter:
            status_enum_filter = [TaskStatus(s) for s in status_filter if s in [e.value for e in TaskStatus]]
        
        priority_enum_filter = None
        if priority_filter:
            priority_enum_filter = [TaskPriority(p) for p in priority_filter if p in [e.value for e in TaskPriority]]
        
        # Генерируем отчет
        report_data = await report_generator.get_or_generate_report(
            session=session,
            report_type=ReportType.TASK_SUMMARY,
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
            department_id=department_id,
            organization_id=organization_id,
            status_filter=status_enum_filter,
            priority_filter=priority_enum_filter
        )
        
        return report_data
        
    except Exception as e:
        logger.error(f"Error generating task summary report: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при генерации отчета")


@router.get("/performance", response_model=Dict[str, Any])
async def get_performance_report(
    start_date: Optional[datetime] = Query(None, description="Дата начала периода"),
    end_date: Optional[datetime] = Query(None, description="Дата окончания периода"),
    department_id: Optional[int] = Query(None, description="ID департамента"),
    organization_id: Optional[int] = Query(None, description="ID организации"),
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение отчета по производительности"""
    
    # Проверяем права доступа
    if not can_access_reports(user, organization_id, department_id):
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра отчетов")
    
    try:
        report_data = await report_generator.get_or_generate_report(
            session=session,
            report_type=ReportType.PERFORMANCE,
            start_date=start_date,
            end_date=end_date,
            department_id=department_id,
            organization_id=organization_id
        )
        
        return report_data
        
    except Exception as e:
        logger.error(f"Error generating performance report: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при генерации отчета")


@router.get("/time-tracking", response_model=Dict[str, Any])
async def get_time_tracking_report(
    start_date: Optional[datetime] = Query(None, description="Дата начала периода"),
    end_date: Optional[datetime] = Query(None, description="Дата окончания периода"),
    user_id: Optional[int] = Query(None, description="ID пользователя"),
    task_id: Optional[int] = Query(None, description="ID задачи"),
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение отчета по учету времени"""
    
    # Если указан конкретный пользователь, проверяем права
    if user_id and user_id != user.get("id") and user.get("role") not in ["admin", "CEO", "manager"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра отчетов других пользователей")
    
    try:
        report_data = await report_generator.get_or_generate_report(
            session=session,
            report_type=ReportType.TIME_TRACKING,
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
            task_id=task_id
        )
        
        return report_data
        
    except Exception as e:
        logger.error(f"Error generating time tracking report: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при генерации отчета")


@router.post("/export")
async def export_report(
    export_request: ExportRequest,
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Экспорт отчета в различные форматы"""
    
    try:
        # Генерируем отчет
        report_data = await report_generator.get_or_generate_report(
            session=session,
            report_type=export_request.report_type,
            **(export_request.filters or {})
        )
        
        # Экспортируем данные
        service = ReportsService(session)
        exported_data = await service.export_report_data(report_data, export_request.format_type)
        
        # Определяем MIME type и имя файла
        if export_request.format_type == ExportFormat.JSON:
            media_type = "application/json"
            filename = f"report_{export_request.report_type.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        elif export_request.format_type == ExportFormat.CSV:
            media_type = "text/csv"
            filename = f"report_{export_request.report_type.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        elif export_request.format_type == ExportFormat.EXCEL:
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"report_{export_request.report_type.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        elif export_request.format_type == ExportFormat.PDF:
            media_type = "application/pdf"
            filename = f"report_{export_request.report_type.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        else:
            raise HTTPException(status_code=400, detail="Неподдерживаемый формат экспорта")
        
        # Возвращаем файл
        return Response(
            content=exported_data if isinstance(exported_data, (str, bytes)) else str(exported_data),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error exporting report: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при экспорте отчета")


@router.get("/types")
async def get_report_types(
    user: dict = Depends(verify_authorization)
):
    """Получение списка доступных типов отчетов"""
    
    return {
        "report_types": [
            {
                "value": rt.value,
                "label": {
                    ReportType.TASK_SUMMARY: "Сводка по задачам",
                    ReportType.PERFORMANCE: "Производительность команды",
                    ReportType.TIME_TRACKING: "Учет времени",
                    ReportType.USER_WORKLOAD: "Нагрузка пользователей",
                    ReportType.DEPARTMENT_ANALYTICS: "Аналитика по департаментам",
                    ReportType.PROJECT_PROGRESS: "Прогресс проектов",
                    ReportType.TASK_COMPLETION: "Выполнение задач"
                }.get(rt, rt.value)
            }
            for rt in ReportType
        ],
        "export_formats": [
            {
                "value": ef.value,
                "label": {
                    ExportFormat.JSON: "JSON",
                    ExportFormat.CSV: "CSV (Excel)",
                    ExportFormat.EXCEL: "Excel (.xlsx)",
                    ExportFormat.PDF: "PDF"
                }.get(ef, ef.value)
            }
            for ef in ExportFormat
        ]
    }


@router.get("/dashboard-data")
async def get_reports_dashboard_data(
    user: dict = Depends(verify_authorization),
    session: AsyncSession = Depends(Server.get_db)
):
    """Получение данных для дашборда отчетов"""
    
    try:
        # Получаем краткую статистику для дашборда
        current_user_org = user.get("organization_id")
        current_user_dept = user.get("department_id")
        
        # Генерируем базовые отчеты
        task_summary = await report_generator.get_or_generate_report(
            session=session,
            report_type=ReportType.TASK_SUMMARY,
            organization_id=current_user_org,
            department_id=current_user_dept
        )
        
        performance = await report_generator.get_or_generate_report(
            session=session,
            report_type=ReportType.PERFORMANCE,
            organization_id=current_user_org,
            department_id=current_user_dept
        )
        
        return {
            "task_summary": {
                "total_tasks": task_summary["summary"]["total_tasks"],
                "overdue_tasks": task_summary["summary"]["overdue_tasks"],
                "status_breakdown": task_summary["status_breakdown"]
            },
            "performance": {
                "overall_stats": performance["overall_stats"],
                "top_performers": performance["user_performance"][:5]  # Топ 5 исполнителей
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard data: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении данных дашборда")


@router.delete("/cache")
async def clear_reports_cache(
    user: dict = Depends(require_role(["admin", "CEO"]))
):
    """Очистка кэша отчетов (только для администраторов)"""
    
    try:
        report_generator.clear_cache()
        return {"message": "Кэш отчетов очищен"}
        
    except Exception as e:
        logger.error(f"Error clearing reports cache: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при очистке кэша")
