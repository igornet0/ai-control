"""
KPI repository interface.
Defines the contract for KPI data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from uuid import UUID

from src.domain.kpi.entities.kpi import KPI, KPIType, KPIStatus
from src.domain.kpi.entities.kpi_calculation import KPICalculation, KPITrend


class KPIRepository(ABC):
    """Abstract KPI repository interface."""
    
    @abstractmethod
    async def create(self, kpi: KPI) -> KPI:
        """Create a new KPI."""
        pass
    
    @abstractmethod
    async def get_by_id(self, kpi_id: UUID) -> Optional[KPI]:
        """Get KPI by ID."""
        pass
    
    @abstractmethod
    async def update(self, kpi: KPI) -> KPI:
        """Update an existing KPI."""
        pass
    
    @abstractmethod
    async def delete(self, kpi_id: UUID) -> bool:
        """Delete a KPI."""
        pass
    
    @abstractmethod
    async def get_by_creator(self, created_by: UUID, limit: int = 100, offset: int = 0) -> List[KPI]:
        """Get KPIs by creator."""
        pass
    
    @abstractmethod
    async def get_by_type(self, kpi_type: KPIType, limit: int = 100, offset: int = 0) -> List[KPI]:
        """Get KPIs by type."""
        pass
    
    @abstractmethod
    async def get_by_category(self, category: str, limit: int = 100, offset: int = 0) -> List[KPI]:
        """Get KPIs by category."""
        pass
    
    @abstractmethod
    async def get_by_organization(self, organization_id: UUID, limit: int = 100, offset: int = 0) -> List[KPI]:
        """Get KPIs by organization."""
        pass
    
    @abstractmethod
    async def get_by_department(self, department_id: UUID, limit: int = 100, offset: int = 0) -> List[KPI]:
        """Get KPIs by department."""
        pass
    
    @abstractmethod
    async def get_active_kpis(self, limit: int = 100, offset: int = 0) -> List[KPI]:
        """Get active KPIs."""
        pass
    
    @abstractmethod
    async def get_kpis_needing_calculation(self, limit: int = 100, offset: int = 0) -> List[KPI]:
        """Get KPIs that need calculation."""
        pass
    
    @abstractmethod
    async def search_kpis(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[KPI]:
        """Search KPIs by query and filters."""
        pass
    
    @abstractmethod
    async def get_kpi_statistics(self, user_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Get KPI statistics for user or globally."""
        pass
    
    @abstractmethod
    async def count_kpis(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count KPIs matching filters."""
        pass
    
    @abstractmethod
    async def exists(self, kpi_id: UUID) -> bool:
        """Check if KPI exists."""
        pass


class KPICalculationRepository(ABC):
    """Abstract KPI calculation repository interface."""
    
    @abstractmethod
    async def create(self, calculation: KPICalculation) -> KPICalculation:
        """Create a new KPI calculation."""
        pass
    
    @abstractmethod
    async def get_by_id(self, calculation_id: UUID) -> Optional[KPICalculation]:
        """Get KPI calculation by ID."""
        pass
    
    @abstractmethod
    async def get_by_calculation_id(self, calculation_id: str) -> Optional[KPICalculation]:
        """Get KPI calculation by calculation ID."""
        pass
    
    @abstractmethod
    async def update(self, calculation: KPICalculation) -> KPICalculation:
        """Update an existing KPI calculation."""
        pass
    
    @abstractmethod
    async def delete(self, calculation_id: UUID) -> bool:
        """Delete a KPI calculation."""
        pass
    
    @abstractmethod
    async def get_by_kpi(self, kpi_id: UUID, limit: int = 100, offset: int = 0) -> List[KPICalculation]:
        """Get calculations by KPI ID."""
        pass
    
    @abstractmethod
    async def get_by_calculator(self, calculated_by: UUID, limit: int = 100, offset: int = 0) -> List[KPICalculation]:
        """Get calculations by calculator."""
        pass
    
    @abstractmethod
    async def get_latest_by_kpi(self, kpi_id: UUID) -> Optional[KPICalculation]:
        """Get latest calculation for KPI."""
        pass
    
    @abstractmethod
    async def get_by_status(self, status: KPIStatus, limit: int = 100, offset: int = 0) -> List[KPICalculation]:
        """Get calculations by status."""
        pass
    
    @abstractmethod
    async def get_by_trend(self, trend: KPITrend, limit: int = 100, offset: int = 0) -> List[KPICalculation]:
        """Get calculations by trend."""
        pass
    
    @abstractmethod
    async def get_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        limit: int = 100,
        offset: int = 0
    ) -> List[KPICalculation]:
        """Get calculations by date range."""
        pass
    
    @abstractmethod
    async def get_calculation_statistics(self, kpi_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Get calculation statistics."""
        pass
    
    @abstractmethod
    async def count_calculations(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count calculations matching filters."""
        pass
    
    @abstractmethod
    async def exists(self, calculation_id: UUID) -> bool:
        """Check if calculation exists."""
        pass
    
    @abstractmethod
    async def exists_by_calculation_id(self, calculation_id: str) -> bool:
        """Check if calculation exists by calculation ID."""
        pass
