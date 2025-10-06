"""
KPI calculation domain entity.
Represents a KPI calculation result with business logic and validation.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import Entity, DomainEvent
from src.domain.exceptions import ValidationError, BusinessRuleViolation
from src.domain.kpi.entities.kpi import KPITrend, KPIStatus


class KPICalculationCreatedEvent(DomainEvent):
    """Event raised when a KPI calculation is created."""
    
    def __init__(self, calculation_id: UUID, kpi_id: UUID, value: float, status: KPIStatus, calculated_by: UUID):
        super().__init__(
            event_type="kpi_calculation_created",
            aggregate_id=str(calculation_id),
            aggregate_type="KPICalculation",
            data={
                "calculation_id": str(calculation_id),
                "kpi_id": str(kpi_id),
                "value": value,
                "status": status.value,
                "calculated_by": str(calculated_by),
            }
        )


class KPICalculation(KPICalculation):
    """KPI calculation domain entity."""
    
    # Basic information
    calculation_id: str = Field(..., description="Unique calculation ID")
    kpi_id: Optional[UUID] = Field(default=None, description="KPI ID")
    calculated_by: UUID = Field(..., description="User who calculated the KPI")
    
    # Calculation results
    value: float = Field(..., description="Calculated value")
    target_value: Optional[float] = Field(default=None, description="Target value")
    previous_value: Optional[float] = Field(default=None, description="Previous value")
    trend: KPITrend = Field(default=KPITrend.UNKNOWN, description="Value trend")
    change_percentage: Optional[float] = Field(default=None, description="Change percentage")
    status: KPIStatus = Field(default=KPIStatus.NORMAL, description="Calculation status")
    
    # Metadata
    calculated_at: datetime = Field(default_factory=datetime.utcnow, description="Calculation timestamp")
    calculation_metadata: Dict[str, Any] = Field(default_factory=dict, description="Calculation metadata")
    insights: Dict[str, Any] = Field(default_factory=dict, description="Calculation insights")
    
    @validator("calculation_id")
    def validate_calculation_id(cls, v):
        """Validate calculation ID."""
        if not v.strip():
            raise ValidationError(
                field="calculation_id",
                value=v,
                reason="Calculation ID cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("value")
    def validate_value(cls, v):
        """Validate calculated value."""
        if not isinstance(v, (int, float)):
            raise ValidationError(
                field="value",
                value=v,
                reason="Calculated value must be a number"
            )
        return float(v)
    
    @validator("change_percentage")
    def validate_change_percentage(cls, v):
        """Validate change percentage."""
        if v is not None and not isinstance(v, (int, float)):
            raise ValidationError(
                field="change_percentage",
                value=v,
                reason="Change percentage must be a number"
            )
        return float(v) if v is not None else v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the calculation."""
        # Check if change percentage is calculated correctly
        if self.previous_value is not None and self.change_percentage is not None:
            expected_change = ((self.value - self.previous_value) / self.previous_value) * 100
            if abs(expected_change - self.change_percentage) > 0.01:  # Allow small floating point differences
                raise BusinessRuleViolation(
                    "Change percentage does not match calculated value",
                    {
                        "value": self.value,
                        "previous_value": self.previous_value,
                        "change_percentage": self.change_percentage,
                        "expected_change": expected_change,
                    }
                )
        
        # Check if trend is calculated correctly
        if self.previous_value is not None:
            if self.value > self.previous_value and self.trend != KPITrend.UP:
                raise BusinessRuleViolation(
                    "Trend does not match calculated value",
                    {
                        "value": self.value,
                        "previous_value": self.previous_value,
                        "trend": self.trend.value,
                        "expected_trend": KPITrend.UP.value,
                    }
                )
            elif self.value < self.previous_value and self.trend != KPITrend.DOWN:
                raise BusinessRuleViolation(
                    "Trend does not match calculated value",
                    {
                        "value": self.value,
                        "previous_value": self.previous_value,
                        "trend": self.trend.value,
                        "expected_trend": KPITrend.DOWN.value,
                    }
                )
            elif self.value == self.previous_value and self.trend != KPITrend.STABLE:
                raise BusinessRuleViolation(
                    "Trend does not match calculated value",
                    {
                        "value": self.value,
                        "previous_value": self.previous_value,
                        "trend": self.trend.value,
                        "expected_trend": KPITrend.STABLE.value,
                    }
                )
    
    def calculate_change_percentage(self) -> Optional[float]:
        """Calculate change percentage from previous value."""
        if self.previous_value is None or self.previous_value == 0:
            return None
        
        return ((self.value - self.previous_value) / self.previous_value) * 100
    
    def calculate_trend(self) -> KPITrend:
        """Calculate trend from previous value."""
        if self.previous_value is None:
            return KPITrend.UNKNOWN
        
        if self.value > self.previous_value:
            return KPITrend.UP
        elif self.value < self.previous_value:
            return KPITrend.DOWN
        else:
            return KPITrend.STABLE
    
    def determine_status(self) -> KPIStatus:
        """Determine status based on value and target."""
        if self.target_value is None:
            return KPIStatus.NORMAL
        
        # Define thresholds (can be made configurable)
        warning_threshold = 0.1  # 10% deviation
        critical_threshold = 0.2  # 20% deviation
        
        deviation = abs(self.value - self.target_value) / self.target_value
        
        if deviation >= critical_threshold:
            return KPIStatus.CRITICAL
        elif deviation >= warning_threshold:
            return KPIStatus.WARNING
        elif self.value >= self.target_value:
            return KPIStatus.SUCCESS
        else:
            return KPIStatus.NORMAL
    
    def update_value(self, new_value: float, updated_by: UUID) -> None:
        """Update calculated value."""
        self.value = new_value
        self.mark_as_updated()
    
    def update_target_value(self, new_target_value: Optional[float], updated_by: UUID) -> None:
        """Update target value."""
        self.target_value = new_target_value
        self.mark_as_updated()
    
    def update_previous_value(self, new_previous_value: Optional[float], updated_by: UUID) -> None:
        """Update previous value."""
        self.previous_value = new_previous_value
        self.mark_as_updated()
    
    def update_trend(self, new_trend: KPITrend, updated_by: UUID) -> None:
        """Update trend."""
        self.trend = new_trend
        self.mark_as_updated()
    
    def update_status(self, new_status: KPIStatus, updated_by: UUID) -> None:
        """Update status."""
        self.status = new_status
        self.mark_as_updated()
    
    def add_insight(self, key: str, value: Any) -> None:
        """Add insight to calculation."""
        self.insights[key] = value
        self.mark_as_updated()
    
    def remove_insight(self, key: str) -> None:
        """Remove insight from calculation."""
        if key in self.insights:
            del self.insights[key]
            self.mark_as_updated()
    
    def add_metadata(self, key: str, value: Any) -> None:
        """Add metadata to calculation."""
        self.calculation_metadata[key] = value
        self.mark_as_updated()
    
    def remove_metadata(self, key: str) -> None:
        """Remove metadata from calculation."""
        if key in self.calculation_metadata:
            del self.calculation_metadata[key]
            self.mark_as_updated()
    
    def is_improvement(self) -> bool:
        """Check if this calculation shows improvement."""
        return self.trend == KPITrend.UP
    
    def is_decline(self) -> bool:
        """Check if this calculation shows decline."""
        return self.trend == KPITrend.DOWN
    
    def is_stable(self) -> bool:
        """Check if this calculation shows stability."""
        return self.trend == KPITrend.STABLE
    
    def is_above_target(self) -> bool:
        """Check if value is above target."""
        if self.target_value is None:
            return False
        return self.value > self.target_value
    
    def is_below_target(self) -> bool:
        """Check if value is below target."""
        if self.target_value is None:
            return False
        return self.value < self.target_value
    
    def is_at_target(self) -> bool:
        """Check if value is at target."""
        if self.target_value is None:
            return False
        return abs(self.value - self.target_value) < 0.01  # Allow small floating point differences
    
    def get_deviation_from_target(self) -> Optional[float]:
        """Get deviation from target as percentage."""
        if self.target_value is None or self.target_value == 0:
            return None
        
        return ((self.value - self.target_value) / self.target_value) * 100
    
    def get_insight(self, key: str, default: Any = None) -> Any:
        """Get insight value by key."""
        return self.insights.get(key, default)
    
    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Get metadata value by key."""
        return self.calculation_metadata.get(key, default)
    
    @classmethod
    def create(
        cls,
        calculation_id: str,
        value: float,
        calculated_by: UUID,
        kpi_id: Optional[UUID] = None,
        target_value: Optional[float] = None,
        previous_value: Optional[float] = None,
        calculation_metadata: Optional[Dict[str, Any]] = None,
        insights: Optional[Dict[str, Any]] = None,
    ) -> "KPICalculation":
        """Create a new KPI calculation."""
        calculation = cls(
            calculation_id=calculation_id,
            value=value,
            calculated_by=calculated_by,
            kpi_id=kpi_id,
            target_value=target_value,
            previous_value=previous_value,
            calculation_metadata=calculation_metadata or {},
            insights=insights or {},
        )
        
        # Calculate derived fields
        calculation.change_percentage = calculation.calculate_change_percentage()
        calculation.trend = calculation.calculate_trend()
        calculation.status = calculation.determine_status()
        
        # Validate business rules
        calculation.validate_business_rules()
        
        # Add domain event
        calculation.add_domain_event(KPICalculationCreatedEvent(
            calculation.id, kpi_id, value, calculation.status, calculated_by
        ))
        
        return calculation
