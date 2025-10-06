"""
KPI type value object.
Represents the type of a KPI.
"""

from enum import Enum
from src.domain.base import ValueObject


class KPIType(Enum):
    """KPI type enumeration."""
    
    NUMERICAL = "numerical"
    PERCENTAGE = "percentage"
    RATIO = "ratio"
    COUNT = "count"
    AVERAGE = "average"
    SUM = "sum"
    MIN = "min"
    MAX = "max"
    TREND = "trend"
    BOOLEAN = "boolean"


class KPITypeValue(ValueObject):
    """KPI type value object."""
    
    def __init__(self, value: KPIType):
        if not isinstance(value, KPIType):
            raise ValueError(f"Invalid KPI type: {value}")
        super().__init__(value=value)
    
    @classmethod
    def from_string(cls, value: str) -> "KPITypeValue":
        """Create KPITypeValue from string."""
        try:
            kpi_type = KPIType(value.lower())
            return cls(kpi_type)
        except ValueError:
            raise ValueError(f"Invalid KPI type string: {value}")
    
    @classmethod
    def numerical(cls) -> "KPITypeValue":
        """Create numerical KPI type."""
        return cls(KPIType.NUMERICAL)
    
    @classmethod
    def percentage(cls) -> "KPITypeValue":
        """Create percentage KPI type."""
        return cls(KPIType.PERCENTAGE)
    
    @classmethod
    def ratio(cls) -> "KPITypeValue":
        """Create ratio KPI type."""
        return cls(KPIType.RATIO)
    
    @classmethod
    def count(cls) -> "KPITypeValue":
        """Create count KPI type."""
        return cls(KPIType.COUNT)
    
    @classmethod
    def average(cls) -> "KPITypeValue":
        """Create average KPI type."""
        return cls(KPIType.AVERAGE)
    
    @classmethod
    def trend(cls) -> "KPITypeValue":
        """Create trend KPI type."""
        return cls(KPIType.TREND)
    
    def is_numerical(self) -> bool:
        """Check if KPI type is numerical."""
        return self.value in [
            KPIType.NUMERICAL,
            KPIType.COUNT,
            KPIType.AVERAGE,
            KPIType.SUM,
            KPIType.MIN,
            KPIType.MAX
        ]
    
    def is_percentage(self) -> bool:
        """Check if KPI type is percentage."""
        return self.value == KPIType.PERCENTAGE
    
    def is_ratio(self) -> bool:
        """Check if KPI type is ratio."""
        return self.value == KPIType.RATIO
    
    def is_boolean(self) -> bool:
        """Check if KPI type is boolean."""
        return self.value == KPIType.BOOLEAN
    
    def has_trend(self) -> bool:
        """Check if KPI type supports trend analysis."""
        return self.value == KPIType.TREND
    
    def get_default_unit(self) -> str:
        """Get default unit for KPI type."""
        unit_mapping = {
            KPIType.NUMERICAL: "",
            KPIType.PERCENTAGE: "%",
            KPIType.RATIO: ":1",
            KPIType.COUNT: "",
            KPIType.AVERAGE: "",
            KPIType.SUM: "",
            KPIType.MIN: "",
            KPIType.MAX: "",
            KPIType.TREND: "",
            KPIType.BOOLEAN: "",
        }
        return unit_mapping[self.value]
    
    def __str__(self) -> str:
        """String representation."""
        return self.value.value
    
    def __repr__(self) -> str:
        """Representation."""
        return f"KPITypeValue({self.value.value})"
