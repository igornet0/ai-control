"""
Сервис для расчета и управления KPI
"""

import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from backend.services.datacode_service import datacode_service

logger = logging.getLogger(__name__)


class KPIType(Enum):
    """Типы KPI"""
    NUMERIC = "numeric"
    PERCENTAGE = "percentage"
    CURRENCY = "currency"
    RATIO = "ratio"
    COUNTER = "counter"
    TREND = "trend"


class KPITrend(Enum):
    """Тренды KPI"""
    UP = "up"
    DOWN = "down"
    STABLE = "stable"
    UNKNOWN = "unknown"


@dataclass
class KPICalculation:
    """Результат расчета KPI"""
    value: Union[float, int]
    target: Optional[Union[float, int]] = None
    previous_value: Optional[Union[float, int]] = None
    trend: KPITrend = KPITrend.UNKNOWN
    change_percentage: Optional[float] = None
    status: str = "normal"  # normal, warning, critical, success
    calculated_at: datetime = None
    metadata: Dict[str, Any] = None


class KPIService:
    """Сервис для расчета и управления KPI"""
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 300  # 5 минут по умолчанию
    
    async def calculate_kpi(
        self,
        formula: str,
        data_source: Dict[str, Any],
        target_value: Optional[Union[float, int]] = None,
        previous_period_days: int = 30
    ) -> KPICalculation:
        """
        Расчет KPI по формуле
        
        Args:
            formula: Формула расчета (может содержать DataCode)
            data_source: Источник данных
            target_value: Целевое значение
            previous_period_days: Количество дней для сравнения с предыдущим периодом
            
        Returns:
            Результат расчета KPI
        """
        try:
            # Получаем текущие данные
            current_data = await self._get_data_from_source(data_source)
            
            # Вычисляем текущее значение
            current_value = await self._evaluate_formula(formula, current_data)
            
            # Получаем данные предыдущего периода для сравнения
            previous_value = None
            if previous_period_days > 0:
                previous_data = await self._get_historical_data(
                    data_source, 
                    days_back=previous_period_days
                )
                if previous_data:
                    previous_value = await self._evaluate_formula(formula, previous_data)
            
            # Рассчитываем тренд и изменение
            trend, change_percentage = self._calculate_trend(current_value, previous_value)
            
            # Определяем статус
            status = self._determine_status(current_value, target_value, change_percentage)
            
            return KPICalculation(
                value=current_value,
                target=target_value,
                previous_value=previous_value,
                trend=trend,
                change_percentage=change_percentage,
                status=status,
                calculated_at=datetime.utcnow(),
                metadata={
                    "formula": formula,
                    "data_source": data_source,
                    "previous_period_days": previous_period_days
                }
            )
            
        except Exception as e:
            logger.error(f"Error calculating KPI: {e}")
            raise
    
    async def calculate_multiple_kpis(
        self,
        kpi_configs: List[Dict[str, Any]]
    ) -> List[KPICalculation]:
        """
        Расчет нескольких KPI одновременно
        
        Args:
            kpi_configs: Список конфигураций KPI
            
        Returns:
            Список результатов расчета
        """
        tasks = []
        for config in kpi_configs:
            task = self.calculate_kpi(
                formula=config["formula"],
                data_source=config["data_source"],
                target_value=config.get("target_value"),
                previous_period_days=config.get("previous_period_days", 30)
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Обрабатываем исключения
        kpi_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error calculating KPI {i}: {result}")
                # Возвращаем пустой результат с ошибкой
                kpi_results.append(KPICalculation(
                    value=0,
                    status="error",
                    calculated_at=datetime.utcnow(),
                    metadata={"error": str(result)}
                ))
            else:
                kpi_results.append(result)
        
        return kpi_results
    
    async def _get_data_from_source(self, data_source: Dict[str, Any]) -> Dict[str, Any]:
        """Получение данных из источника"""
        source_type = data_source.get("type")
        
        if source_type == "datacode":
            # Выполняем DataCode скрипт
            script = data_source.get("script", "")
            return await datacode_service.execute_script(script)
        
        elif source_type == "file":
            # Читаем данные из файла
            file_path = data_source.get("file_path")
            file_type = data_source.get("file_type", "csv")
            
            if file_type == "csv":
                # Создаем DataCode скрипт для чтения CSV
                script = f"""
# Загружаем CSV файл
global data = read_file("{file_path}")
global table_data = table(data)
print(table_data)
"""
                return await datacode_service.execute_script(script)
        
        elif source_type == "api":
            # Получаем данные через API
            # TODO: Реализовать HTTP клиент для API
            return {"data": []}
        
        elif source_type == "database":
            # Получаем данные из базы данных
            # TODO: Реализовать подключение к БД
            return {"data": []}
        
        else:
            raise ValueError(f"Unsupported data source type: {source_type}")
    
    async def _get_historical_data(
        self, 
        data_source: Dict[str, Any], 
        days_back: int
    ) -> Optional[Dict[str, Any]]:
        """Получение исторических данных"""
        try:
            # Добавляем параметр времени к источнику данных
            historical_source = data_source.copy()
            historical_source["date_from"] = (
                datetime.utcnow() - timedelta(days=days_back)
            ).isoformat()
            historical_source["date_to"] = (
                datetime.utcnow() - timedelta(days=days_back)
            ).isoformat()
            
            return await self._get_data_from_source(historical_source)
            
        except Exception as e:
            logger.warning(f"Could not get historical data: {e}")
            return None
    
    async def _evaluate_formula(self, formula: str, data: Dict[str, Any]) -> Union[float, int]:
        """Вычисление формулы"""
        try:
            # Если формула содержит DataCode
            if "global" in formula or "function" in formula:
                # Выполняем как DataCode скрипт
                script = f"""
{formula}
# Возвращаем результат
print(result)
"""
                result = await datacode_service.execute_script(script)
                
                # Извлекаем числовое значение из результата
                if isinstance(result, dict) and "output" in result:
                    # Пытаемся найти число в выводе
                    output_lines = result["output"].split('\n')
                    for line in output_lines:
                        try:
                            return float(line.strip())
                        except ValueError:
                            continue
                
                # Если не нашли число, возвращаем 0
                return 0
            
            else:
                # Простая математическая формула
                # Заменяем переменные на значения из данных
                formula_with_data = formula
                for key, value in data.items():
                    if isinstance(value, (int, float)):
                        formula_with_data = formula_with_data.replace(f"${key}", str(value))
                
                # Вычисляем формулу
                return eval(formula_with_data)
                
        except Exception as e:
            logger.error(f"Error evaluating formula '{formula}': {e}")
            return 0
    
    def _calculate_trend(
        self, 
        current_value: Union[float, int], 
        previous_value: Optional[Union[float, int]]
    ) -> tuple[KPITrend, Optional[float]]:
        """Расчет тренда и процентного изменения"""
        if previous_value is None or previous_value == 0:
            return KPITrend.UNKNOWN, None
        
        change_percentage = ((current_value - previous_value) / previous_value) * 100
        
        if change_percentage > 5:  # Порог для определения тренда
            trend = KPITrend.UP
        elif change_percentage < -5:
            trend = KPITrend.DOWN
        else:
            trend = KPITrend.STABLE
        
        return trend, change_percentage
    
    def _determine_status(
        self,
        current_value: Union[float, int],
        target_value: Optional[Union[float, int]],
        change_percentage: Optional[float]
    ) -> str:
        """Определение статуса KPI"""
        if target_value is not None:
            # Сравниваем с целевым значением
            if current_value >= target_value:
                return "success"
            elif current_value >= target_value * 0.8:  # 80% от цели
                return "warning"
            else:
                return "critical"
        
        # Если нет целевого значения, используем тренд
        if change_percentage is not None:
            if change_percentage > 10:
                return "success"
            elif change_percentage > -5:
                return "normal"
            else:
                return "warning"
        
        return "normal"
    
    def get_kpi_formula_templates(self) -> List[Dict[str, Any]]:
        """Получение шаблонов формул KPI"""
        return [
            {
                "name": "Сумма",
                "description": "Сумма всех значений",
                "formula": "sum(data)",
                "category": "aggregation"
            },
            {
                "name": "Среднее значение",
                "description": "Среднее арифметическое",
                "formula": "average(data)",
                "category": "aggregation"
            },
            {
                "name": "Количество",
                "description": "Количество записей",
                "formula": "count(data)",
                "category": "aggregation"
            },
            {
                "name": "Максимум",
                "description": "Максимальное значение",
                "formula": "max(data)",
                "category": "aggregation"
            },
            {
                "name": "Минимум",
                "description": "Минимальное значение",
                "formula": "min(data)",
                "category": "aggregation"
            },
            {
                "name": "Процент выполнения",
                "description": "Процент от целевого значения",
                "formula": "(current_value / target_value) * 100",
                "category": "percentage"
            },
            {
                "name": "Рост в процентах",
                "description": "Процентный рост по сравнению с предыдущим периодом",
                "formula": "((current_value - previous_value) / previous_value) * 100",
                "category": "trend"
            },
            {
                "name": "Конверсия",
                "description": "Процент конверсии",
                "formula": "(converted / total) * 100",
                "category": "conversion"
            },
            {
                "name": "ROI",
                "description": "Возврат инвестиций",
                "formula": "((revenue - cost) / cost) * 100",
                "category": "financial"
            },
            {
                "name": "Средний чек",
                "description": "Средний размер заказа",
                "formula": "total_revenue / number_of_orders",
                "category": "sales"
            }
        ]
    
    def validate_formula(self, formula: str) -> Dict[str, Any]:
        """Валидация формулы KPI"""
        try:
            # Проверяем базовый синтаксис
            if "global" in formula or "function" in formula:
                # DataCode формула
                return {
                    "valid": True,
                    "type": "datacode",
                    "message": "DataCode formula is valid"
                }
            else:
                # Простая математическая формула
                # Пытаемся скомпилировать
                compile(formula, '<string>', 'eval')
                return {
                    "valid": True,
                    "type": "math",
                    "message": "Mathematical formula is valid"
                }
                
        except Exception as e:
            return {
                "valid": False,
                "type": "unknown",
                "message": f"Formula validation failed: {str(e)}"
            }
    
    async def get_kpi_insights(self, kpi_calculation: KPICalculation) -> Dict[str, Any]:
        """Получение аналитических инсайтов по KPI"""
        insights = {
            "summary": "",
            "recommendations": [],
            "alerts": []
        }
        
        # Анализируем тренд
        if kpi_calculation.trend == KPITrend.UP:
            insights["summary"] = "KPI показывает положительную динамику"
            if kpi_calculation.change_percentage and kpi_calculation.change_percentage > 20:
                insights["recommendations"].append(
                    "Значительный рост KPI - рассмотрите возможность масштабирования успешных практик"
                )
        elif kpi_calculation.trend == KPITrend.DOWN:
            insights["summary"] = "KPI показывает отрицательную динамику"
            insights["alerts"].append(
                f"KPI снизился на {abs(kpi_calculation.change_percentage):.1f}% - требуется внимание"
            )
            insights["recommendations"].append(
                "Необходимо проанализировать причины снижения и принять корректирующие меры"
            )
        else:
            insights["summary"] = "KPI стабилен"
        
        # Анализируем статус
        if kpi_calculation.status == "critical":
            insights["alerts"].append("KPI находится в критической зоне")
            insights["recommendations"].append(
                "Требуются немедленные действия для улучшения показателей"
            )
        elif kpi_calculation.status == "warning":
            insights["alerts"].append("KPI требует внимания")
            insights["recommendations"].append(
                "Рекомендуется мониторинг и планирование улучшений"
            )
        elif kpi_calculation.status == "success":
            insights["recommendations"].append(
                "Отличные результаты! Рассмотрите возможность установки более амбициозных целей"
            )
        
        # Анализируем целевое значение
        if kpi_calculation.target is not None:
            if kpi_calculation.value >= kpi_calculation.target:
                insights["summary"] += " - цель достигнута"
            else:
                gap = kpi_calculation.target - kpi_calculation.value
                gap_percentage = (gap / kpi_calculation.target) * 100
                insights["summary"] += f" - до цели осталось {gap_percentage:.1f}%"
        
        return insights


# Создаем глобальный экземпляр сервиса
kpi_service = KPIService()
