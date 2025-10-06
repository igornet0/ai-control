"""
KPI domain entity.
Represents a KPI in the system with business logic and validation.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class KPIType(str, Enum):
    """KPI type enumeration."""
    
    NUMERIC = "numeric"
    PERCENTAGE = "percentage"
    CURRENCY = "currency"
    RATIO = "ratio"
    COUNTER = "counter"
    TREND = "trend"


class KPITrend(str, Enum):
    """KPI trend enumeration."""
    
    UP = "up"
    DOWN = "down"
    STABLE = "stable"
    UNKNOWN = "unknown"


class KPIStatus(str, Enum):
    """KPI status enumeration."""
    
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    SUCCESS = "success"
    ERROR = "error"


class KPICreatedEvent(DomainEvent):
    """Event raised when a KPI is created."""
    
    def __init__(self, kpi_id: UUID, name: str, created_by: UUID, kpi_type: KPIType):
        super().__init__(
            event_type="kpi_created",
            aggregate_id=str(kpi_id),
            aggregate_type="KPI",
            data={
                "kpi_id": str(kpi_id),
                "name": name,
                "created_by": str(created_by),
                "kpi_type": kpi_type.value,
            }
        )


class KPIUpdatedEvent(DomainEvent):
    """Event raised when a KPI is updated."""
    
    def __init__(self, kpi_id: UUID, updated_by: UUID):
        super().__init__(
            event_type="kpi_updated",
            aggregate_id=str(kpi_id),
            aggregate_type="KPI",
            data={
                "kpi_id": str(kpi_id),
                "updated_by": str(updated_by),
            }
        )


class KPICalculatedEvent(DomainEvent):
    """Event raised when a KPI is calculated."""
    
    def __init__(self, kpi_id: UUID, value: float, status: KPIStatus, calculated_by: UUID):
        super().__init__(
            event_type="kpi_calculated",
            aggregate_id=str(kpi_id),
            aggregate_type="KPI",
            data={
                "kpi_id": str(kpi_id),
                "value": value,
                "status": status.value,
                "calculated_by": str(calculated_by),
            }
        )


class KPI(KPI):
    """KPI domain entity."""
    
    # Basic information
    name: str = Field(..., min_length=1, max_length=255, description="KPI name")
    description: Optional[str] = Field(default=None, description="KPI description")
    formula: str = Field(..., min_length=1, description="KPI formula")
    data_source: Dict[str, Any] = Field(..., description="Data source configuration")
    
    # KPI configuration
    target_value: Optional[float] = Field(default=None, description="Target value")
    previous_period_days: int = Field(default=30, ge=1, description="Previous period in days")
    refresh_interval: int = Field(default=3600, ge=0, description="Refresh interval in seconds")
    category: str = Field(default="general", description="KPI category")
    unit: Optional[str] = Field(default=None, description="KPI unit")
    kpi_type: KPIType = Field(default=KPIType.NUMERIC, description="KPI type")
    
    # Status
    is_active: bool = Field(default=True, description="Active status")
    
    # User and organizational context
    created_by: UUID = Field(..., description="KPI creator ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    # Calculation metadata
    last_calculation: Optional[datetime] = Field(default=None, description="Last calculation time")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate KPI name."""
        if not v.strip():
            raise ValidationError(
                field="name",
                value=v,
                reason="KPI name cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("formula")
    def validate_formula(cls, v):
        """Validate KPI formula."""
        if not v.strip():
            raise ValidationError(
                field="formula",
                value=v,
                reason="KPI formula cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("data_source")
    def validate_data_source(cls, v):
        """Validate data source configuration."""
        if not v:
            raise ValidationError(
                field="data_source",
                value=v,
                reason="Data source configuration cannot be empty"
            )
        
        # Check required fields
        required_fields = ["type", "connection"]
        for field in required_fields:
            if field not in v:
                raise ValidationError(
                    field="data_source",
                    value=v,
                    reason=f"Data source configuration must contain '{field}' field"
                )
        
        return v
    
    @validator("target_value")
    def validate_target_value(cls, v):
        """Validate target value."""
        if v is not None and v < 0:
            raise ValidationError(
                field="target_value",
                value=v,
                reason="Target value cannot be negative"
            )
        return v
    
    @validator("refresh_interval")
    def validate_refresh_interval(cls, v):
        """Validate refresh interval."""
        if v < 0:
            raise ValidationError(
                field="refresh_interval",
                value=v,
                reason="Refresh interval cannot be negative"
            )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the KPI."""
        # Check if formula contains valid syntax
        if not self._is_valid_formula(self.formula):
            raise BusinessRuleViolation(
                "KPI formula contains invalid syntax",
                {"formula": self.formula}
            )
        
        # Check if data source configuration is valid
        if not self._is_valid_data_source(self.data_source):
            raise BusinessRuleViolation(
                "Data source configuration is invalid",
                {"data_source": self.data_source}
            )
    
    def _is_valid_formula(self, formula: str) -> bool:
        """Check if formula syntax is valid."""
        # Basic validation - check for common formula patterns
        valid_patterns = ["+", "-", "*", "/", "(", ")", "SUM", "AVG", "COUNT", "MAX", "MIN"]
        return any(pattern in formula for pattern in valid_patterns)
    
    def _is_valid_data_source(self, data_source: Dict[str, Any]) -> bool:
        """Check if data source configuration is valid."""
        valid_types = ["database", "api", "file", "datacode", "manual"]
        return data_source.get("type") in valid_types
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if KPI can be edited by user."""
        # Creator can always edit
        if user_id == self.created_by:
            return True
        
        # Add more business logic for organizational permissions
        return False
    
    def can_be_calculated_by(self, user_id: UUID) -> bool:
        """Check if KPI can be calculated by user."""
        # Any authenticated user can calculate if KPI is active
        return self.is_active
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if KPI can be deleted by user."""
        # Creator can always delete
        if user_id == self.created_by:
            return True
        
        # Add more business logic for organizational permissions
        return False
    
    def update_name(self, new_name: str, updated_by: UUID) -> None:
        """Update KPI name."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this KPI",
                {"user_id": str(updated_by), "kpi_id": str(self.id)}
            )
        
        self.name = new_name
        self.mark_as_updated()
        self.add_domain_event(KPIUpdatedEvent(self.id, updated_by))
    
    def update_description(self, new_description: Optional[str], updated_by: UUID) -> None:
        """Update KPI description."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this KPI",
                {"user_id": str(updated_by), "kpi_id": str(self.id)}
            )
        
        self.description = new_description
        self.mark_as_updated()
        self.add_domain_event(KPIUpdatedEvent(self.id, updated_by))
    
    def update_formula(self, new_formula: str, updated_by: UUID) -> None:
        """Update KPI formula."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this KPI",
                {"user_id": str(updated_by), "kpi_id": str(self.id)}
            )
        
        self.formula = new_formula
        self.mark_as_updated()
        self.add_domain_event(KPIUpdatedEvent(self.id, updated_by))
    
    def update_data_source(self, new_data_source: Dict[str, Any], updated_by: UUID) -> None:
        """Update KPI data source."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this KPI",
                {"user_id": str(updated_by), "kpi_id": str(self.id)}
            )
        
        self.data_source = new_data_source
        self.mark_as_updated()
        self.add_domain_event(KPIUpdatedEvent(self.id, updated_by))
    
    def update_target_value(self, new_target_value: Optional[float], updated_by: UUID) -> None:
        """Update KPI target value."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this KPI",
                {"user_id": str(updated_by), "kpi_id": str(self.id)}
            )
        
        self.target_value = new_target_value
        self.mark_as_updated()
        self.add_domain_event(KPIUpdatedEvent(self.id, updated_by))
    
    def set_active(self, is_active: bool, updated_by: UUID) -> None:
        """Set KPI active status."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this KPI",
                {"user_id": str(updated_by), "kpi_id": str(self.id)}
            )
        
        self.is_active = is_active
        self.mark_as_updated()
        self.add_domain_event(KPIUpdatedEvent(self.id, updated_by))
    
    def set_refresh_interval(self, interval: int, updated_by: UUID) -> None:
        """Set KPI refresh interval."""
        if not self.can_be_edited_by(updated_by):
            raise BusinessRuleViolation(
                f"User {updated_by} cannot edit this KPI",
                {"user_id": str(updated_by), "kpi_id": str(self.id)}
            )
        
        self.refresh_interval = interval
        self.mark_as_updated()
        self.add_domain_event(KPIUpdatedEvent(self.id, updated_by))
    
    def mark_as_calculated(self, calculated_by: UUID) -> None:
        """Mark KPI as calculated."""
        self.last_calculation = datetime.utcnow()
        self.mark_as_updated()
        self.add_domain_event(KPICalculatedEvent(self.id, 0.0, KPIStatus.NORMAL, calculated_by))
    
    def needs_calculation(self) -> bool:
        """Check if KPI needs calculation."""
        if not self.is_active:
            return False
        
        if self.last_calculation is None:
            return True
        
        time_since_calculation = (datetime.utcnow() - self.last_calculation).total_seconds()
        return time_since_calculation >= self.refresh_interval
    
    def is_numeric_type(self) -> bool:
        """Check if KPI is numeric type."""
        return self.kpi_type == KPIType.NUMERIC
    
    def is_percentage_type(self) -> bool:
        """Check if KPI is percentage type."""
        return self.kpi_type == KPIType.PERCENTAGE
    
    def is_currency_type(self) -> bool:
        """Check if KPI is currency type."""
        return self.kpi_type == KPIType.CURRENCY
    
    def is_ratio_type(self) -> bool:
        """Check if KPI is ratio type."""
        return self.kpi_type == KPIType.RATIO
    
    def is_counter_type(self) -> bool:
        """Check if KPI is counter type."""
        return self.kpi_type == KPIType.COUNTER
    
    def is_trend_type(self) -> bool:
        """Check if KPI is trend type."""
        return self.kpi_type == KPIType.TREND
    
    def get_formatted_value(self, value: float) -> str:
        """Get formatted value based on KPI type."""
        if self.kpi_type == KPIType.PERCENTAGE:
            return f"{value:.2f}%"
        elif self.kpi_type == KPIType.CURRENCY:
            return f"${value:,.2f}"
        elif self.kpi_type == KPIType.RATIO:
            return f"{value:.2f}:1"
        else:
            return f"{value:,.2f}"
    
    def get_data_source_type(self) -> str:
        """Get data source type."""
        return self.data_source.get("type", "unknown")
    
    def get_data_source_connection(self) -> str:
        """Get data source connection."""
        return self.data_source.get("connection", "")
    
    def set_data_source_field(self, key: str, value: Any) -> None:
        """Set data source field value."""
        self.data_source[key] = value
        self.mark_as_updated()
    
    def get_data_source_field(self, key: str, default: Any = None) -> Any:
        """Get data source field value."""
        return self.data_source.get(key, default)
    
    @classmethod
    def create(
        cls,
        name: str,
        formula: str,
        data_source: Dict[str, Any],
        created_by: UUID,
        description: Optional[str] = None,
        target_value: Optional[float] = None,
        previous_period_days: int = 30,
        refresh_interval: int = 3600,
        category: str = "general",
        unit: Optional[str] = None,
        kpi_type: KPIType = KPIType.NUMERIC,
        organization_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
    ) -> "KPI":
        """Create a new KPI."""
        kpi = cls(
            name=name,
            description=description,
            formula=formula,
            data_source=data_source,
            target_value=target_value,
            previous_period_days=previous_period_days,
            refresh_interval=refresh_interval,
            category=category,
            unit=unit,
            kpi_type=kpi_type,
            created_by=created_by,
            organization_id=organization_id,
            department_id=department_id,
        )
        
        # Validate business rules
        kpi.validate_business_rules()
        
        # Add domain event
        kpi.add_domain_event(KPICreatedEvent(kpi.id, name, created_by, kpi_type))
        
        return kpi
