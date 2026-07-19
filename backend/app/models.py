"""SentraGrid Backend — Pydantic models."""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from enum import Enum


# ── Enums ──

class ZoneType(str, Enum):
    CONFINED_SPACE = "confined_space"
    HOT_WORK_AREA = "hot_work_area"
    GENERAL = "general"
    STORAGE = "storage"
    CONTROL = "control"
    ELECTRICAL = "electrical"
    LOADING = "loading"
    WATER_TREATMENT = "water_treatment"


class SensorType(str, Enum):
    GAS_H2S = "gas_h2s"
    GAS_CO = "gas_co"
    TEMPERATURE = "temperature"
    PRESSURE = "pressure"


class PermitType(str, Enum):
    HOT_WORK = "hot_work"
    CONFINED_SPACE_ENTRY = "confined_space_entry"
    ELECTRICAL = "electrical"
    GENERAL = "general"


class PermitStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    PENDING = "pending"
    BLOCKED = "blocked"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ── Zone ──

class Zone(BaseModel):
    id: str
    name: str
    zone_type: str
    x_coord: float
    y_coord: float
    width: float = 120.0
    height: float = 80.0
    baseline_risk_level: str = "low"


class ZoneStatus(BaseModel):
    zone: Zone
    risk_level: str = "low"
    sensor_readings: list[dict] = []
    active_permits: list[dict] = []
    worker_count: int = 0
    recent_alerts: list[dict] = []


# ── Sensor ──

class Sensor(BaseModel):
    id: str
    zone_id: str
    sensor_type: str
    unit: str


class SensorReading(BaseModel):
    id: Optional[int] = None
    sensor_id: str
    value: float
    recorded_at: str = ""
    zone_id: Optional[str] = None
    sensor_type: Optional[str] = None


# ── Permit ──

class Permit(BaseModel):
    id: str
    zone_id: str
    permit_type: str
    status: str = "active"
    issued_by: str = ""
    issued_at: str = ""
    valid_until: str = ""
    zone_name: Optional[str] = None


class PermitRequest(BaseModel):
    zone_id: str
    permit_type: str
    issued_by: str = "Safety Officer"


class PermitEvaluation(BaseModel):
    approved: bool
    conflicts: list[str] = []
    recommendation: str = ""
    override_allowed: bool = True
    risk_level: str = "low"


class PermitOverride(BaseModel):
    permit_id: str
    justification: str
    officer_id: str = "Safety Officer"


# ── Worker ──

class Worker(BaseModel):
    id: str
    name: str
    role: str = ""


class WorkerPosition(BaseModel):
    id: Optional[int] = None
    worker_id: str
    zone_id: str
    recorded_at: str = ""
    worker_name: Optional[str] = None


# ── Alert ──

class Alert(BaseModel):
    id: str
    zone_id: str
    severity: str
    title: str
    explanation: str
    triggering_factors: dict = {}
    status: str = "open"
    created_at: str = ""
    zone_name: Optional[str] = None


# ── RAG ──

class RAGQuery(BaseModel):
    question: str


class RAGSource(BaseModel):
    title: str
    content_snippet: str
    source_type: str
    similarity: float = 0.0


class RAGResponse(BaseModel):
    answer: str
    sources: list[RAGSource] = []


# ── Risk Engine ──

class RiskEvaluation(BaseModel):
    zone_id: str
    severity: str
    title: str
    explanation: str
    triggering_factors: dict = {}
    should_alert: bool = False


# ── Dashboard ──

class DashboardKPIs(BaseModel):
    open_alerts: int = 0
    critical_alerts: int = 0
    warning_alerts: int = 0
    active_permits: int = 0
    elevated_zones: int = 0
    workers_on_site: int = 0


# ── Simulator ──

class SimulatorStatus(BaseModel):
    running: bool = False
    mode: str = "idle"
    phase: int = 0
    phase_description: str = ""
    elapsed_seconds: float = 0.0
