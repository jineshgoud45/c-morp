"""
Pydantic data models for C-MORP API
Defines data structures for energy management, devices, users, and alerts
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class DeviceType(str, Enum):
    """Device types in the microgrid"""
    SOLAR_PANEL = "solar_panel"
    BATTERY = "battery"
    INVERTER = "inverter"
    GRID_METER = "grid_meter"
    LOAD_METER = "load_meter"


class DeviceStatus(str, Enum):
    """Device operational status"""
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    ERROR = "error"


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EnergyData(BaseModel):
    """Real-time energy measurements"""
    timestamp: datetime
    consumption_kw: float = Field(..., ge=0, description="Current consumption in kW")
    generation_kw: float = Field(..., ge=0, description="Current generation in kW")
    battery_soc: float = Field(..., ge=0, le=100, description="Battery state of charge percentage")
    battery_power_kw: float = Field(..., description="Battery power (+charging, -discharging) in kW")
    grid_import_kw: float = Field(..., ge=0, description="Power imported from grid in kW")
    grid_export_kw: float = Field(..., ge=0, description="Power exported to grid in kW")
    cost_savings: float = Field(..., ge=0, description="Daily cost savings in INR")
    carbon_savings_kg: float = Field(..., ge=0, description="Carbon emissions saved in kg")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class Device(BaseModel):
    """Device information and status"""
    id: str
    name: str
    device_type: DeviceType
    status: DeviceStatus
    location: str
    capacity_kw: Optional[float] = None
    efficiency: Optional[float] = Field(None, ge=0, le=100, description="Efficiency percentage")
    last_update: datetime
    metadata: Dict[str, Any] = {}

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class OptimizationSettings(BaseModel):
    """User optimization preferences"""
    cost_priority: float = Field(..., ge=0, le=1, description="Priority for cost optimization (0-1)")
    green_priority: float = Field(..., ge=0, le=1, description="Priority for renewable energy (0-1)")
    battery_min_soc: float = Field(..., ge=10, le=50, description="Minimum battery SOC percentage")
    battery_max_soc: float = Field(..., ge=50, le=95, description="Maximum battery SOC percentage")
    peak_shaving_enabled: bool = True
    load_shifting_enabled: bool = True

    @validator('cost_priority', 'green_priority')
    def validate_priorities(cls, v):
        if not 0 <= v <= 1:
            raise ValueError('Priority must be between 0 and 1')
        return v


class OptimizationResult(BaseModel):
    """Results from energy optimization"""
    timestamp: datetime
    success: bool
    total_cost: float = Field(..., ge=0, description="Optimized cost in INR")
    baseline_cost: float = Field(..., ge=0, description="Baseline cost without optimization")
    savings_percentage: float = Field(..., ge=0, description="Cost savings percentage")
    battery_schedule: List[float] = Field(..., description="Battery power schedule for 24 hours")
    grid_schedule: List[float] = Field(..., description="Grid power schedule for 24 hours")
    solve_time_ms: float = Field(..., ge=0, description="Optimization solve time in milliseconds")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class Alert(BaseModel):
    """System alert or notification"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    message: str
    severity: AlertSeverity
    device_id: Optional[str] = None
    timestamp: datetime
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    metadata: Dict[str, Any] = {}

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class User(BaseModel):
    """User information and preferences"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    role: str = "user"
    created_at: datetime
    last_login: Optional[datetime] = None
    preferences: Dict[str, Any] = {}

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class HistoricalData(BaseModel):
    """Historical energy data for time period"""
    start_time: datetime
    end_time: datetime
    interval_minutes: int
    consumption_data: List[float]
    generation_data: List[float]
    battery_soc_data: List[float]
    cost_data: List[float]

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ApiResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool
    message: str
    data: Optional[Any] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class WebSocketMessage(BaseModel):
    """WebSocket message structure"""
    type: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any]

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ForecastRequest(BaseModel):
    """Request for energy forecast"""
    horizon_hours: int = Field(default=24, ge=1, le=168, description="Forecast horizon in hours")
    resolution_minutes: int = Field(default=60, ge=15, le=1440, description="Data resolution in minutes")


class ForecastResponse(BaseModel):
    """Energy forecast response"""
    timestamp: datetime
    solar_forecast: List[float]
    load_forecast: List[float]
    confidence_interval: List[float]  # Lower and upper bounds
    weather_conditions: Optional[Dict[str, str]] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }