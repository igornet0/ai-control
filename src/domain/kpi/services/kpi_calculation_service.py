"""
KPI calculation domain service.
Handles complex business logic related to KPI calculations and analytics.
"""

from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta

from src.domain.base import DomainService
from src.domain.kpi.entities.kpi import KPI
from src.domain.kpi.entities.kpi_calculation import KPICalculation
from src.domain.kpi.repositories.kpi_repository import KPIRepository
from src.domain.kpi.value_objects.kpi_id import KPIId
from src.domain.kpi.value_objects.kpi_type import KPIType
from src.domain.exceptions import BusinessRuleViolation


class KPICalculationService(DomainService):
    """Domain service for KPI calculation operations."""
    
    def __init__(self, kpi_repository: KPIRepository):
        self._kpi_repository = kpi_repository
    
    async def execute(self, *args, **kwargs) -> any:
        """Execute the domain service."""
        pass
    
    async def calculate_kpi_value(
        self,
        kpi_id: KPIId,
        calculation_method: str = "default"
    ) -> KPICalculation:
        """Calculate current value for a KPI."""
        kpi = await self._kpi_repository.get_by_id(kpi_id)
        if not kpi:
            raise BusinessRuleViolation(
                "KPI not found",
                {"kpi_id": str(kpi_id.value)}
            )
        
        # Calculate value based on KPI type and method
        calculated_value = await self._perform_calculation(kpi, calculation_method)
        
        # Create calculation record
        calculation = KPICalculation(
            kpi_id=kpi_id,
            value=calculated_value,
            calculated_at=datetime.utcnow(),
            calculation_method=calculation_method,
        )
        
        return calculation
    
    async def calculate_kpi_trend(
        self,
        kpi_id: KPIId,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """Calculate trend for a KPI over a period."""
        kpi = await self._kpi_repository.get_by_id(kpi_id)
        if not kpi:
            raise BusinessRuleViolation(
                "KPI not found",
                {"kpi_id": str(kpi_id.value)}
            )
        
        # Get historical calculations
        historical_data = await self._get_historical_calculations(kpi_id, period_days)
        
        if len(historical_data) < 2:
            return {
                "trend": "insufficient_data",
                "change_percentage": 0.0,
                "data_points": len(historical_data)
            }
        
        # Calculate trend
        first_value = historical_data[0].value
        last_value = historical_data[-1].value
        
        if first_value == 0:
            change_percentage = 100.0 if last_value > 0 else 0.0
        else:
            change_percentage = ((last_value - first_value) / first_value) * 100
        
        # Determine trend direction
        if change_percentage > 5:
            trend = "increasing"
        elif change_percentage < -5:
            trend = "decreasing"
        else:
            trend = "stable"
        
        return {
            "trend": trend,
            "change_percentage": change_percentage,
            "first_value": first_value,
            "last_value": last_value,
            "data_points": len(historical_data),
            "period_days": period_days
        }
    
    async def calculate_kpi_performance(
        self,
        kpi_id: KPIId
    ) -> Dict[str, Any]:
        """Calculate performance metrics for a KPI."""
        kpi = await self._kpi_repository.get_by_id(kpi_id)
        if not kpi:
            raise BusinessRuleViolation(
                "KPI not found",
                {"kpi_id": str(kpi_id.value)}
            )
        
        current_value = kpi.current_value or 0
        target_value = kpi.target_value or 0
        
        if target_value == 0:
            return {
                "performance": "no_target",
                "achievement_percentage": 0.0,
                "current_value": current_value,
                "target_value": target_value
            }
        
        # Calculate achievement percentage
        achievement_percentage = (current_value / target_value) * 100
        
        # Determine performance level
        if achievement_percentage >= 100:
            performance = "exceeded"
        elif achievement_percentage >= 90:
            performance = "achieved"
        elif achievement_percentage >= 75:
            performance = "good"
        elif achievement_percentage >= 50:
            performance = "fair"
        else:
            performance = "poor"
        
        return {
            "performance": performance,
            "achievement_percentage": achievement_percentage,
            "current_value": current_value,
            "target_value": target_value,
            "gap": target_value - current_value
        }
    
    async def calculate_team_kpi_summary(
        self,
        user_ids: List[UUID]
    ) -> Dict[str, Any]:
        """Calculate KPI summary for a team."""
        team_kpis = []
        
        for user_id in user_ids:
            user_kpis = await self._kpi_repository.get_by_user(user_id)
            team_kpis.extend(user_kpis)
        
        if not team_kpis:
            return {
                "total_kpis": 0,
                "average_performance": 0.0,
                "performance_distribution": {}
            }
        
        # Calculate performance for each KPI
        performances = []
        performance_distribution = {
            "exceeded": 0,
            "achieved": 0,
            "good": 0,
            "fair": 0,
            "poor": 0,
            "no_target": 0
        }
        
        for kpi in team_kpis:
            performance = await self.calculate_kpi_performance(kpi.id)
            performances.append(performance)
            performance_distribution[performance["performance"]] += 1
        
        # Calculate average performance
        valid_performances = [p for p in performances if p["performance"] != "no_target"]
        average_performance = (
            sum(p["achievement_percentage"] for p in valid_performances) / len(valid_performances)
            if valid_performances else 0.0
        )
        
        return {
            "total_kpis": len(team_kpis),
            "average_performance": average_performance,
            "performance_distribution": performance_distribution,
            "kpis": [
                {
                    "kpi_id": str(kpi.id.value),
                    "name": kpi.name,
                    "performance": await self.calculate_kpi_performance(kpi.id)
                }
                for kpi in team_kpis
            ]
        }
    
    async def _perform_calculation(
        self,
        kpi: KPI,
        calculation_method: str
    ) -> float:
        """Perform the actual KPI calculation."""
        # This is a simplified implementation
        # In a real system, this would integrate with data sources
        
        if kpi.calculation_formula:
            # Use custom formula
            return await self._evaluate_formula(kpi.calculation_formula)
        
        # Default calculation based on KPI type
        if kpi.kpi_type.value == "count":
            return await self._calculate_count_kpi(kpi)
        elif kpi.kpi_type.value == "percentage":
            return await self._calculate_percentage_kpi(kpi)
        elif kpi.kpi_type.value == "average":
            return await self._calculate_average_kpi(kpi)
        else:
            # Return current value as fallback
            return kpi.current_value or 0.0
    
    async def _evaluate_formula(self, formula: str) -> float:
        """Evaluate a custom calculation formula."""
        # This is a placeholder for formula evaluation
        # In a real system, you would use a safe formula evaluator
        try:
            # Simple evaluation (not safe for production)
            return float(eval(formula))
        except:
            return 0.0
    
    async def _calculate_count_kpi(self, kpi: KPI) -> float:
        """Calculate count-based KPI."""
        # Placeholder implementation
        return 10.0
    
    async def _calculate_percentage_kpi(self, kpi: KPI) -> float:
        """Calculate percentage-based KPI."""
        # Placeholder implementation
        return 75.0
    
    async def _calculate_average_kpi(self, kpi: KPI) -> float:
        """Calculate average-based KPI."""
        # Placeholder implementation
        return 85.5
    
    async def _get_historical_calculations(
        self,
        kpi_id: KPIId,
        period_days: int
    ) -> List[KPICalculation]:
        """Get historical KPI calculations."""
        # This would need to be implemented in the repository
        # For now, return empty list
        return []
