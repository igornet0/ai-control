"""
KPI-related API schemas.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from .common_schemas import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema, BaseListResponseSchema, PaginationSchema


class KPICreateSchema(BaseCreateSchema):
    """KPI creation schema."""
    
    name: str = Field(..., min_length=1, max_length=100, description="KPI name")
    description: Optional[str] = Field(None, description="KPI description")
    kpi_type: str = Field(..., description="KPI type")
    formula: str = Field(..., description="KPI calculation formula")
    target_value: Optional[float] = Field(None, description="Target value")
    unit: Optional[str] = Field(None, description="KPI unit")
    user_id: str = Field(..., description="User ID")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    calculation_frequency: str = Field("daily", description="Calculation frequency")
    is_active: bool = Field(True, description="Whether KPI is active")


class KPIUpdateSchema(BaseUpdateSchema):
    """KPI update schema."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="KPI name")
    description: Optional[str] = Field(None, description="KPI description")
    kpi_type: Optional[str] = Field(None, description="KPI type")
    formula: Optional[str] = Field(None, description="KPI calculation formula")
    target_value: Optional[float] = Field(None, description="Target value")
    unit: Optional[str] = Field(None, description="KPI unit")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    calculation_frequency: Optional[str] = Field(None, description="Calculation frequency")
    is_active: Optional[bool] = Field(None, description="Whether KPI is active")


class KPIResponseSchema(BaseResponseSchema):
    """KPI response schema."""
    
    name: str = Field(..., description="KPI name")
    description: Optional[str] = Field(None, description="KPI description")
    kpi_type: str = Field(..., description="KPI type")
    formula: str = Field(..., description="KPI calculation formula")
    target_value: Optional[float] = Field(None, description="Target value")
    unit: Optional[str] = Field(None, description="KPI unit")
    user_id: str = Field(..., description="User ID")
    organization_id: Optional[str] = Field(None, description="Organization ID")
    department_id: Optional[str] = Field(None, description="Department ID")
    calculation_frequency: str = Field(..., description="Calculation frequency")
    is_active: bool = Field(..., description="Whether KPI is active")
    user_name: Optional[str] = Field(None, description="User name")
    organization_name: Optional[str] = Field(None, description="Organization name")
    department_name: Optional[str] = Field(None, description="Department name")


class KPIListResponseSchema(BaseListResponseSchema):
    """KPI list response schema."""
    
    items: List[KPIResponseSchema] = Field(..., description="List of KPIs")
    pagination: PaginationSchema = Field(..., description="Pagination information")


class KPICalculationCreateSchema(BaseCreateSchema):
    """KPI calculation creation schema."""
    
    kpi_id: str = Field(..., description="KPI ID")
    value: float = Field(..., description="Calculated value")
    period_start: datetime = Field(..., description="Period start")
    period_end: datetime = Field(..., description="Period end")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Calculation metadata")


class KPICalculationResponseSchema(BaseResponseSchema):
    """KPI calculation response schema."""
    
    kpi_id: str = Field(..., description="KPI ID")
    value: float = Field(..., description="Calculated value")
    period_start: datetime = Field(..., description="Period start")
    period_end: datetime = Field(..., description="Period end")
    metadata: Dict[str, Any] = Field(..., description="Calculation metadata")
    kpi_name: Optional[str] = Field(None, description="KPI name")


class KPIFilterSchema(BaseModel):
    """KPI filter schema."""
    
    user_id: Optional[str] = Field(None, description="Filter by user")
    organization_id: Optional[str] = Field(None, description="Filter by organization")
    department_id: Optional[str] = Field(None, description="Filter by department")
    kpi_type: Optional[str] = Field(None, description="Filter by KPI type")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    search: Optional[str] = Field(None, description="Search query")
    sort_by: Optional[str] = Field(None, description="Sort field")
    sort_order: Optional[str] = Field("asc", description="Sort order")
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")


class KPIStatisticsSchema(BaseModel):
    """KPI statistics schema."""
    
    total_kpis: int = Field(..., description="Total number of KPIs")
    active_kpis: int = Field(..., description="Number of active KPIs")
    inactive_kpis: int = Field(..., description="Number of inactive KPIs")
    kpis_by_type: Dict[str, int] = Field(..., description="KPIs by type")
    kpis_by_organization: Dict[str, int] = Field(..., description="KPIs by organization")
    kpis_by_department: Dict[str, int] = Field(..., description="KPIs by department")


class KPITrendSchema(BaseModel):
    """KPI trend schema."""
    
    kpi_id: str = Field(..., description="KPI ID")
    kpi_name: str = Field(..., description="KPI name")
    values: List[float] = Field(..., description="KPI values")
    periods: List[datetime] = Field(..., description="Period timestamps")
    trend: str = Field(..., description="Trend direction (up/down/stable)")
    change_percentage: float = Field(..., description="Percentage change")


class KPIComparisonSchema(BaseModel):
    """KPI comparison schema."""
    
    kpi_id: str = Field(..., description="KPI ID")
    kpi_name: str = Field(..., description="KPI name")
    current_value: float = Field(..., description="Current value")
    previous_value: float = Field(..., description="Previous value")
    target_value: Optional[float] = Field(None, description="Target value")
    change_percentage: float = Field(..., description="Percentage change")
    target_achievement: Optional[float] = Field(None, description="Target achievement percentage")


class KPIForecastSchema(BaseModel):
    """KPI forecast schema."""
    
    kpi_id: str = Field(..., description="KPI ID")
    kpi_name: str = Field(..., description="KPI name")
    historical_values: List[float] = Field(..., description="Historical values")
    forecasted_values: List[float] = Field(..., description="Forecasted values")
    forecast_periods: List[datetime] = Field(..., description="Forecast periods")
    confidence_interval: Optional[Dict[str, float]] = Field(None, description="Confidence interval")


class KPIAnomalySchema(BaseModel):
    """KPI anomaly schema."""
    
    kpi_id: str = Field(..., description="KPI ID")
    kpi_name: str = Field(..., description="KPI name")
    anomaly_type: str = Field(..., description="Anomaly type")
    detected_at: datetime = Field(..., description="Detection timestamp")
    value: float = Field(..., description="Anomalous value")
    expected_value: float = Field(..., description="Expected value")
    severity: str = Field(..., description="Anomaly severity")
    description: Optional[str] = Field(None, description="Anomaly description")


class KPIReportSchema(BaseModel):
    """KPI report schema."""
    
    report_id: str = Field(..., description="Report ID")
    title: str = Field(..., description="Report title")
    description: Optional[str] = Field(None, description="Report description")
    kpis: List[KPIResponseSchema] = Field(..., description="KPIs in report")
    calculations: List[KPICalculationResponseSchema] = Field(..., description="KPI calculations")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Generation timestamp")
    period_start: datetime = Field(..., description="Report period start")
    period_end: datetime = Field(..., description="Report period end")
