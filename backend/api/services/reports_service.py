"""
Сервис для генерации отчетов по задачам и аналитики производительности
"""

import uuid
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload, joinedload
from enum import Enum
import logging

from core.database.models.task_model import (
    Task, TaskComment, TaskTimeLog, TaskDependency, TaskWatcher, TaskLabel,
    TaskStatus, TaskPriority, TaskType, TaskVisibility
)
from core.database.models.main_models import User, Organization, Department

logger = logging.getLogger(__name__)


class ReportType(str, Enum):
    """Типы отчетов"""
    TASK_SUMMARY = "task_summary"  # Сводка по задачам
    PERFORMANCE = "performance"  # Производительность команды
    TIME_TRACKING = "time_tracking"  # Учет времени
    USER_WORKLOAD = "user_workload"  # Нагрузка пользователей
    DEPARTMENT_ANALYTICS = "department_analytics"  # Аналитика по департаментам
    PROJECT_PROGRESS = "project_progress"  # Прогресс проектов
    TASK_COMPLETION = "task_completion"  # Выполнение задач


class ExportFormat(str, Enum):
    """Форматы экспорта"""
    JSON = "json"
    CSV = "csv"
    EXCEL = "excel"
    PDF = "pdf"


class ReportsService:
    """Сервис для работы с отчетами"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def generate_task_summary_report(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        user_id: Optional[int] = None,
        department_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        status_filter: Optional[List[TaskStatus]] = None,
        priority_filter: Optional[List[TaskPriority]] = None
    ) -> Dict[str, Any]:
        """Генерация сводного отчета по задачам"""
        
        # Базовый запрос
        query = select(Task).options(
            selectinload(Task.owner),
            selectinload(Task.executor),
            selectinload(Task.department),
            selectinload(Task.organization)
        )
        
        # Применяем фильтры
        filters = []
        
        if start_date:
            filters.append(Task.created_at >= start_date)
        if end_date:
            filters.append(Task.created_at <= end_date)
        if user_id:
            filters.append(or_(Task.owner_id == user_id, Task.executor_id == user_id))
        if department_id:
            filters.append(Task.department_id == department_id)
        if organization_id:
            filters.append(Task.organization_id == organization_id)
        if status_filter:
            filters.append(Task.status.in_([s.value for s in status_filter]))
        if priority_filter:
            filters.append(Task.priority.in_([p.value for p in priority_filter]))
        
        if filters:
            query = query.where(and_(*filters))
        
        result = await self.session.execute(query)
        tasks = result.scalars().all()
        
        # Собираем статистику
        total_tasks = len(tasks)
        
        # Группировка по статусам
        status_stats = {}
        for status in TaskStatus:
            count = len([t for t in tasks if t.status == status])
            status_stats[status.value] = {
                "count": count,
                "percentage": round((count / total_tasks * 100) if total_tasks > 0 else 0, 2)
            }
        
        # Группировка по приоритетам
        priority_stats = {}
        for priority in TaskPriority:
            count = len([t for t in tasks if t.priority == priority])
            priority_stats[priority.value] = {
                "count": count,
                "percentage": round((count / total_tasks * 100) if total_tasks > 0 else 0, 2)
            }
        
        # Группировка по типам
        type_stats = {}
        for task_type in TaskType:
            count = len([t for t in tasks if t.task_type == task_type])
            type_stats[task_type.value] = {
                "count": count,
                "percentage": round((count / total_tasks * 100) if total_tasks > 0 else 0, 2)
            }
        
        # Задачи с просроченными дедлайнами
        now = datetime.now()
        overdue_tasks = [
            t for t in tasks 
            if t.due_date and t.due_date < now and t.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
        ]
        
        # Средние метрики
        completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETED]
        avg_completion_time = None
        if completed_tasks:
            completion_times = [
                (t.completed_at - t.created_at).total_seconds() / 3600  # часы
                for t in completed_tasks if t.completed_at
            ]
            if completion_times:
                avg_completion_time = round(sum(completion_times) / len(completion_times), 2)
        
        return {
            "report_type": ReportType.TASK_SUMMARY,
            "generated_at": datetime.now(),
            "filters": {
                "start_date": start_date,
                "end_date": end_date,
                "user_id": user_id,
                "department_id": department_id,
                "organization_id": organization_id,
                "status_filter": [s.value for s in status_filter] if status_filter else None,
                "priority_filter": [p.value for p in priority_filter] if priority_filter else None
            },
            "summary": {
                "total_tasks": total_tasks,
                "overdue_tasks": len(overdue_tasks),
                "avg_completion_time_hours": avg_completion_time
            },
            "status_breakdown": status_stats,
            "priority_breakdown": priority_stats,
            "type_breakdown": type_stats,
            "overdue_details": [
                {
                    "id": t.id,
                    "title": t.title,
                    "due_date": t.due_date,
                    "days_overdue": (now - t.due_date).days,
                    "owner": t.owner.login if t.owner else None,
                    "executor": t.executor.login if t.executor else None
                }
                for t in overdue_tasks[:10]  # Показываем первые 10
            ]
        }
    
    async def generate_performance_report(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        department_id: Optional[int] = None,
        organization_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Генерация отчета по производительности"""
        
        # Запрос для получения пользователей с их задачами
        query = select(User).options(
            selectinload(User.executed_tasks),
            selectinload(User.task_time_logs)
        )
        
        filters = []
        if department_id:
            filters.append(User.department_id == department_id)
        if organization_id:
            filters.append(User.organization_id == organization_id)
        
        if filters:
            query = query.where(and_(*filters))
        
        result = await self.session.execute(query)
        users = result.scalars().all()
        
        user_stats = []
        
        for user in users:
            # Фильтруем задачи по датам
            user_tasks = user.executed_tasks
            if start_date or end_date:
                filtered_tasks = []
                for task in user_tasks:
                    if start_date and task.created_at < start_date:
                        continue
                    if end_date and task.created_at > end_date:
                        continue
                    filtered_tasks.append(task)
                user_tasks = filtered_tasks
            
            # Статистика по пользователю
            total_tasks = len(user_tasks)
            completed_tasks = len([t for t in user_tasks if t.status == TaskStatus.COMPLETED])
            in_progress_tasks = len([t for t in user_tasks if t.status == TaskStatus.IN_PROGRESS])
            overdue_tasks = len([
                t for t in user_tasks 
                if t.due_date and t.due_date < datetime.now() and t.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
            ])
            
            # Учет времени
            time_logs = user.task_time_logs
            if start_date or end_date:
                filtered_logs = []
                for log in time_logs:
                    if start_date and log.start_time < start_date:
                        continue
                    if end_date and log.start_time > end_date:
                        continue
                    filtered_logs.append(log)
                time_logs = filtered_logs
            
            total_hours = sum(log.hours for log in time_logs)
            
            # Вычисляем производительность
            completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
            avg_hours_per_task = (total_hours / total_tasks) if total_tasks > 0 else 0
            
            user_stats.append({
                "user_id": user.id,
                "username": user.login,
                "full_name": f"{user.first_name} {user.last_name}",
                "department": user.department.name if user.department else None,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "in_progress_tasks": in_progress_tasks,
                "overdue_tasks": overdue_tasks,
                "completion_rate": round(completion_rate, 2),
                "total_hours": round(total_hours, 2),
                "avg_hours_per_task": round(avg_hours_per_task, 2)
            })
        
        # Сортируем по производительности
        user_stats.sort(key=lambda x: x["completion_rate"], reverse=True)
        
        # Общая статистика
        total_all_tasks = sum(u["total_tasks"] for u in user_stats)
        total_completed = sum(u["completed_tasks"] for u in user_stats)
        total_hours_all = sum(u["total_hours"] for u in user_stats)
        
        return {
            "report_type": ReportType.PERFORMANCE,
            "generated_at": datetime.now(),
            "filters": {
                "start_date": start_date,
                "end_date": end_date,
                "department_id": department_id,
                "organization_id": organization_id
            },
            "overall_stats": {
                "total_tasks": total_all_tasks,
                "total_completed": total_completed,
                "overall_completion_rate": round((total_completed / total_all_tasks * 100) if total_all_tasks > 0 else 0, 2),
                "total_hours_logged": round(total_hours_all, 2),
                "avg_hours_per_user": round(total_hours_all / len(user_stats), 2) if user_stats else 0
            },
            "user_performance": user_stats
        }
    
    async def generate_time_tracking_report(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        user_id: Optional[int] = None,
        task_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Генерация отчета по учету времени"""
        
        query = select(TaskTimeLog).options(
            selectinload(TaskTimeLog.user),
            selectinload(TaskTimeLog.task)
        )
        
        filters = []
        if start_date:
            filters.append(TaskTimeLog.start_time >= start_date)
        if end_date:
            filters.append(TaskTimeLog.start_time <= end_date)
        if user_id:
            filters.append(TaskTimeLog.user_id == user_id)
        if task_id:
            filters.append(TaskTimeLog.task_id == task_id)
        
        if filters:
            query = query.where(and_(*filters))
        
        result = await self.session.execute(query)
        time_logs = result.scalars().all()
        
        # Группировка по пользователям
        user_time = {}
        task_time = {}
        daily_time = {}
        
        for log in time_logs:
            # По пользователям
            if log.user_id not in user_time:
                user_time[log.user_id] = {
                    "username": log.user.login,
                    "total_hours": 0,
                    "entries_count": 0
                }
            user_time[log.user_id]["total_hours"] += log.hours
            user_time[log.user_id]["entries_count"] += 1
            
            # По задачам
            if log.task_id not in task_time:
                task_time[log.task_id] = {
                    "task_title": log.task.title,
                    "total_hours": 0,
                    "entries_count": 0
                }
            task_time[log.task_id]["total_hours"] += log.hours
            task_time[log.task_id]["entries_count"] += 1
            
            # По дням
            day_key = log.start_time.date().isoformat()
            if day_key not in daily_time:
                daily_time[day_key] = 0
            daily_time[day_key] += log.hours
        
        # Сортируем по времени
        user_time_sorted = sorted(user_time.items(), key=lambda x: x[1]["total_hours"], reverse=True)
        task_time_sorted = sorted(task_time.items(), key=lambda x: x[1]["total_hours"], reverse=True)
        
        total_hours = sum(log.hours for log in time_logs)
        total_entries = len(time_logs)
        
        return {
            "report_type": ReportType.TIME_TRACKING,
            "generated_at": datetime.now(),
            "filters": {
                "start_date": start_date,
                "end_date": end_date,
                "user_id": user_id,
                "task_id": task_id
            },
            "summary": {
                "total_hours": round(total_hours, 2),
                "total_entries": total_entries,
                "avg_hours_per_entry": round(total_hours / total_entries, 2) if total_entries > 0 else 0
            },
            "time_by_user": [
                {
                    "user_id": user_id,
                    "username": data["username"],
                    "total_hours": round(data["total_hours"], 2),
                    "entries_count": data["entries_count"],
                    "avg_hours_per_entry": round(data["total_hours"] / data["entries_count"], 2)
                }
                for user_id, data in user_time_sorted[:20]  # Топ 20
            ],
            "time_by_task": [
                {
                    "task_id": task_id,
                    "task_title": data["task_title"],
                    "total_hours": round(data["total_hours"], 2),
                    "entries_count": data["entries_count"]
                }
                for task_id, data in task_time_sorted[:20]  # Топ 20
            ],
            "daily_breakdown": [
                {
                    "date": day,
                    "hours": round(hours, 2)
                }
                for day, hours in sorted(daily_time.items())
            ]
        }
    
    async def export_report_data(
        self,
        report_data: Dict[str, Any],
        format_type: ExportFormat
    ) -> Union[str, bytes, Dict[str, Any]]:
        """Экспорт данных отчета в различные форматы"""
        
        if format_type == ExportFormat.JSON:
            return report_data
        
        elif format_type == ExportFormat.CSV:
            return await self._export_to_csv(report_data)
        
        elif format_type == ExportFormat.EXCEL:
            return await self._export_to_excel(report_data)
        
        elif format_type == ExportFormat.PDF:
            return await self._export_to_pdf(report_data)
        
        else:
            raise ValueError(f"Unsupported export format: {format_type}")
    
    async def _export_to_csv(self, report_data: Dict[str, Any]) -> str:
        """Экспорт в CSV формат"""
        import csv
        import io
        
        output = io.StringIO()
        
        # Определяем структуру данных в зависимости от типа отчета
        report_type = report_data.get("report_type")
        
        if report_type == ReportType.TASK_SUMMARY:
            writer = csv.writer(output)
            writer.writerow(["Metric", "Value", "Percentage"])
            
            # Записываем статистику по статусам
            for status, data in report_data["status_breakdown"].items():
                writer.writerow([f"Status: {status}", data["count"], f"{data['percentage']}%"])
                
        elif report_type == ReportType.PERFORMANCE:
            writer = csv.writer(output)
            writer.writerow([
                "User ID", "Username", "Full Name", "Department",
                "Total Tasks", "Completed Tasks", "In Progress",
                "Overdue", "Completion Rate %", "Total Hours"
            ])
            
            for user in report_data["user_performance"]:
                writer.writerow([
                    user["user_id"], user["username"], user["full_name"],
                    user["department"], user["total_tasks"], user["completed_tasks"],
                    user["in_progress_tasks"], user["overdue_tasks"],
                    user["completion_rate"], user["total_hours"]
                ])
        
        elif report_type == ReportType.TIME_TRACKING:
            writer = csv.writer(output)
            writer.writerow(["User ID", "Username", "Total Hours", "Entries", "Avg Hours per Entry"])
            
            for user in report_data["time_by_user"]:
                writer.writerow([
                    user["user_id"], user["username"], user["total_hours"],
                    user["entries_count"], user["avg_hours_per_entry"]
                ])
        
        return output.getvalue()
    
    async def _export_to_excel(self, report_data: Dict[str, Any]) -> bytes:
        """Экспорт в Excel формат"""
        # Здесь должна быть реализация с openpyxl
        # Для упрощения возвращаем заглушку
        return b"Excel data would be generated here"
    
    async def _export_to_pdf(self, report_data: Dict[str, Any]) -> bytes:
        """Экспорт в PDF формат"""
        # Здесь должна быть реализация с reportlab
        # Для упрощения возвращаем заглушку
        return b"PDF data would be generated here"


class ReportGenerator:
    """Генератор отчетов с кэшированием"""
    
    def __init__(self):
        self._cache = {}
        self._cache_ttl = 300  # 5 минут
    
    async def get_or_generate_report(
        self,
        session: AsyncSession,
        report_type: ReportType,
        **kwargs
    ) -> Dict[str, Any]:
        """Получение отчета из кэша или генерация нового"""
        
        # Создаем ключ кэша
        cache_key = f"{report_type}:{hash(str(sorted(kwargs.items())))}"
        
        # Проверяем кэш
        if cache_key in self._cache:
            cached_data, timestamp = self._cache[cache_key]
            if datetime.now().timestamp() - timestamp < self._cache_ttl:
                logger.info(f"Returning cached report: {cache_key}")
                return cached_data
        
        # Генерируем новый отчет
        service = ReportsService(session)
        
        if report_type == ReportType.TASK_SUMMARY:
            report_data = await service.generate_task_summary_report(**kwargs)
        elif report_type == ReportType.PERFORMANCE:
            report_data = await service.generate_performance_report(**kwargs)
        elif report_type == ReportType.TIME_TRACKING:
            report_data = await service.generate_time_tracking_report(**kwargs)
        else:
            raise ValueError(f"Unsupported report type: {report_type}")
        
        # Сохраняем в кэш
        self._cache[cache_key] = (report_data, datetime.now().timestamp())
        logger.info(f"Generated and cached new report: {cache_key}")
        
        return report_data
    
    def clear_cache(self):
        """Очистка кэша"""
        self._cache.clear()
        logger.info("Report cache cleared")


# Глобальный экземпляр генератора отчетов
report_generator = ReportGenerator()
