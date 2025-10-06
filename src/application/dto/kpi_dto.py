"""
KPI Data Transfer Objects.
DTOs for KPI-related operations.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, validator

from src.domain.kpi.entities.kpi import KPIType, KPIStatus
from src.domain.kpi.entities.kpi_calculation import KPITrend


class KPICreateDTO(BaseModel):
    """DTO for creating a KPI."""
    
    name: str = Field(..., min_length=1, max_length=255, description="KPI name")
    description: Optional[str] = Field(default=None, description="KPI description")
    formula: str = Field(..., min_length=1, description="KPI formula")
    data_source: Dict[str, Any] = Field(..., description="Data source configuration")
    target_value: Optional[float] = Field(default=None, ge=0, description="Target value")
    previous_period_days: int = Field(default=30, ge=1, description="Previous period in days")
    refresh_interval: int = Field(default=3600, ge=0, description="Refresh interval in seconds")
    category: str = Field(default="general", description="KPI category")
    unit: Optional[str] = Field(default=None, description="KPI unit")
    kpi_type: KPIType = Field(default=KPIType.NUMERIC, description="KPI type")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate KPI name."""
        if not v.strip():
            raise ValueError("KPI name cannot be empty or only whitespace")
        return v.strip()
    
    @validator("formula")
    def validate_formula(cls, v):
        """Validate KPI formula."""
        if not v.strip():
            raise ValueError("KPI formula cannot be empty or only whitespace")
        return v.strip()
    
    @validator("data_source")
    def validate_data_source(cls, v):
        """Validate data source configuration."""
        if not v:
            raise ValueError("Data source configuration cannot be empty")
        
        # Check required fields
        required_fields = ["type", "connection"]
        for field in required_fields:
            if field not in v:
                raise ValueError(f"Data source configuration must contain '{field}' field")
        
        return v
    
    @validator("target_value")
    def validate_target_value(cls, v):
        """Validate target value."""
        if v is not None and v < 0:
            raise ValueError("Target value cannot be negative")
        return v
    
    @validator("refresh_interval")
    def validate_refresh_interval(cls, v):
        """Validate refresh interval."""
        if v < 0:
            raise ValueError("Refresh interval cannot be negative")
        return v


class KPIUpdateDTO(BaseModel):
    """DTO for updating a KPI."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="KPI name")
    description: Optional[str] = Field(default=None, description="KPI description")
    formula: Optional[str] = Field(default=None, min_length=1, description="KPI formula")
    data_source: Optional[Dict[str, Any]] = Field(default=None, description="Data source configuration")
    target_value: Optional[float] = Field(default=None, ge=0, description="Target value")
    previous_period_days: Optional[int] = Field(default=None, ge=1, description="Previous period in days")
    refresh_interval: Optional[int] = Field(default=None, ge=0, description="Refresh interval in seconds")
    category: Optional[str] = Field(default=None, description="KPI category")
    unit: Optional[str] = Field(default=None, description="KPI unit")
    kpi_type: Optional[KPIType] = Field(default=None, description="KPI type")
    is_active: Optional[bool] = Field(default=None, description="Active status")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    
    @validator("name")
    def validate_name(cls, v):
        """Validate KPI name."""
        if v is not None and not v.strip():
            raise ValueError("KPI name cannot be empty or only whitespace")
        return v.strip() if v else v
    
    @validator("formula")
    def validate_formula(cls, v):
        """Validate KPI formula."""
        if v is not None and not v.strip():
            raise ValueError("KPI formula cannot be empty or only whitespace")
        return v.strip() if v else v
    
    @validator("data_source")
    def validate_data_source(cls, v):
        """Validate data source configuration."""
        if v is not None:
            if not v:
                raise ValueError("Data source configuration cannot be empty")
            
            # Check required fields
            required_fields = ["type", "connection"]
            for field in required_fields:
                if field not in v:
                    raise ValueError(f"Data source configuration must contain '{field}' field")
        
        return v
    
    @validator("target_value")
    def validate_target_value(cls, v):
        """Validate target value."""
        if v is not None and v < 0:
            raise ValueError("Target value cannot be negative")
        return v
    
    @validator("refresh_interval")
    def validate_refresh_interval(cls, v):
        """Validate refresh interval."""
        if v is not None and v < 0:
            raise ValueError("Refresh interval cannot be negative")
        return v


class KPIResponseDTO(BaseModel):
    """DTO for KPI response."""
    
    id: UUID = Field(..., description="KPI ID")
    name: str = Field(..., description="KPI name")
    description: Optional[str] = Field(default=None, description="KPI description")
    formula: str = Field(..., description="KPI formula")
    data_source: Dict[str, Any] = Field(..., description="Data source configuration")
    target_value: Optional[float] = Field(default=None, description="Target value")
    previous_period_days: int = Field(..., description="Previous period in days")
    refresh_interval: int = Field(..., description="Refresh interval in seconds")
    category: str = Field(..., description="KPI category")
    unit: Optional[str] = Field(default=None, description="KPI unit")
    kpi_type: KPIType = Field(..., description="KPI type")
    is_active: bool = Field(..., description="Active status")
    created_by: UUID = Field(..., description="KPI creator ID")
    organization_id: Optional[UUID] = Field(default=None, description="Organization ID")
    department_id: Optional[UUID] = Field(default=None, description="Department ID")
    last_calculation: Optional[datetime] = Field(default=None, description="Last calculation time")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True


class KPIListResponseDTO(BaseModel):
    """DTO for KPI list response."""
    
    kpis: List[KPIResponseDTO] = Field(..., description="List of KPIs")
    total_count: int = Field(..., description="Total number of KPIs")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")
    
    class Config:
        from_attributes = True


class KPICalculationCreateDTO(BaseModel):
    """DTO for creating a KPI calculation."""
    
    calculation_id: str = Field(..., min_length=1, description="Unique calculation ID")
    value: float = Field(..., description="Calculated value")
    target_value: Optional[float] = Field(default=None, description="Target value")
    previous_value: Optional[float] = Field(default=None, description="Previous value")
    calculation_metadata: Dict[str, Any] = Field(default_factory=dict, description="Calculation metadata")
    insights: Dict[str, Any] = Field(default_factory=dict, description="Calculation insights")
    
    @validator("calculation_id")
    def validate_calculation_id(cls, v):
        """Validate calculation ID."""
        if not v.strip():
            raise ValueError("Calculation ID cannot be empty or only whitespace")
        return v.strip()
    
    @validator("value")
    def validate_value(cls, v):
        """Validate calculated value."""
        if not isinstance(v, (int, float)):
            raise ValueError("Calculated value must be a number")
        return float(v)


class KPICalculationResponseDTO(BaseModel):
    """DTO for KPI calculation response."""
    
    id: UUID = Field(..., description="Calculation ID")
    calculation_id: str = Field(..., description="Unique calculation ID")
    kpi_id: Optional[UUID] = Field(default=None, description="KPI ID")
    calculated_by: UUID = Field(..., description="User who calculated the KPI")
    value: float = Field(..., description="Calculated value")
    target_value: Optional[float] = Field(default=None, description="Target value")
    previous_value: Optional[float] = Field(default=None, description="Previous value")
    trend: KPITrend = Field(..., description="Value trend")
    change_percentage: Optional[float] = Field(default=None, description="Change percentage")
    status: KPIStatus = Field(..., description="Calculation status")
    calculated_at: datetime = Field(..., description="Calculation timestamp")
    calculation_metadata: Dict[str, Any] = Field(..., description="Calculation metadata")
    insights: Dict[str, Any] = Field(..., description="Calculation insights")
    
    class Config:
        from_attributes = True


class KPIStatisticsDTO(BaseModel):
    """DTO for KPI statistics."""
    
    total_kpis: int = Field(..., description="Total number of KPIs")
    active_kpis: int = Field(..., description="Number of active KPIs")
    kpis_by_type: Dict[str, int] = Field(..., description="KPIs grouped by type")
    kpis_by_category: Dict[str, int] = Field(..., description="KPIs grouped by category")
    kpis_by_organization: Dict[str, int] = Field(..., description="KPIs grouped by organization")
    kpis_by_department: Dict[str, int] = Field(..., description="KPIs grouped by department")
    average_calculation_frequency: float = Field(..., description="Average calculation frequency")
    kpis_needing_calculation: int = Field(..., description="Number of KPIs needing calculation")
    most_recent_calculations: List[Dict[str, Any]] = Field(..., description="Most recent calculations")
    
    class Config:
        from_attributes = True


class KPICalculationStatisticsDTO(BaseModel):
    """DTO for KPI calculation statistics."""
    
    total_calculations: int = Field(..., description="Total number of calculations")
    calculations_by_status: Dict[str, int] = Field(..., description="Calculations grouped by status")
    calculations_by_trend: Dict[str, int] = Field(..., description="Calculations grouped by trend")
    average_value: float = Field(..., description="Average calculated value")
    min_value: float = Field(..., description="Minimum calculated value")
    max_value: float = Field(..., description="Maximum calculated value")
    calculations_by_date: Dict[str, int] = Field(..., description="Calculations grouped by date")
    most_active_calculators: List[Dict[str, Any]] = Field(..., description="Most active calculators")
    
    class Config:
        from_attributes = True
