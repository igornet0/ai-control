"""
Widget type value object.
Represents the type of a widget.
"""

from enum import Enum
from src.domain.base import ValueObject


class WidgetType(Enum):
    """Widget type enumeration."""
    
    CHART = "chart"
    TABLE = "table"
    METRIC = "metric"
    TEXT = "text"
    IMAGE = "image"
    KPI = "kpi"
    TASK_LIST = "task_list"
    CALENDAR = "calendar"
    PROGRESS = "progress"
    PIE_CHART = "pie_chart"
    LINE_CHART = "line_chart"
    BAR_CHART = "bar_chart"


class WidgetTypeValue(ValueObject):
    """Widget type value object."""
    
    def __init__(self, value: WidgetType):
        if not isinstance(value, WidgetType):
            raise ValueError(f"Invalid widget type: {value}")
        super().__init__(value=value)
    
    @classmethod
    def from_string(cls, value: str) -> "WidgetTypeValue":
        """Create WidgetTypeValue from string."""
        try:
            widget_type = WidgetType(value.lower())
            return cls(widget_type)
        except ValueError:
            raise ValueError(f"Invalid widget type string: {value}")
    
    @classmethod
    def chart(cls) -> "WidgetTypeValue":
        """Create chart widget type."""
        return cls(WidgetType.CHART)
    
    @classmethod
    def table(cls) -> "WidgetTypeValue":
        """Create table widget type."""
        return cls(WidgetType.TABLE)
    
    @classmethod
    def metric(cls) -> "WidgetTypeValue":
        """Create metric widget type."""
        return cls(WidgetType.METRIC)
    
    @classmethod
    def kpi(cls) -> "WidgetTypeValue":
        """Create KPI widget type."""
        return cls(WidgetType.KPI)
    
    @classmethod
    def task_list(cls) -> "WidgetTypeValue":
        """Create task list widget type."""
        return cls(WidgetType.TASK_LIST)
    
    def is_chart(self) -> bool:
        """Check if widget type is a chart."""
        return self.value in [
            WidgetType.CHART,
            WidgetType.PIE_CHART,
            WidgetType.LINE_CHART,
            WidgetType.BAR_CHART
        ]
    
    def is_data_visualization(self) -> bool:
        """Check if widget type is for data visualization."""
        return self.value in [
            WidgetType.CHART,
            WidgetType.PIE_CHART,
            WidgetType.LINE_CHART,
            WidgetType.BAR_CHART,
            WidgetType.METRIC,
            WidgetType.KPI,
            WidgetType.PROGRESS
        ]
    
    def requires_data_source(self) -> bool:
        """Check if widget type requires a data source."""
        return self.value not in [WidgetType.TEXT, WidgetType.IMAGE]
    
    def __str__(self) -> str:
        """String representation."""
        return self.value.value
    
    def __repr__(self) -> str:
        """Representation."""
        return f"WidgetTypeValue({self.value.value})"
