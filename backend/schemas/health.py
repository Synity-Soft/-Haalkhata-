"""
BazarBondhu AI — Health Check Pydantic Schemas
==============================================

Defines models for legacy ML health and unified system health endpoints.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DatabaseHealth(BaseModel):
    """Health and connectivity status of the SQLite database."""
    status: str = Field(..., description="'connected' or 'disconnected'")
    engine: str = Field(default="sqlite")
    database_file: str = Field(description="Name or path of the active SQLite database")
    total_tables: int = Field(description="Number of detected domain tables")
    total_records: int = Field(description="Total record count across verified tables")
    latency_ms: float = Field(description="Database ping / query round-trip latency in milliseconds")
    error: Optional[str] = Field(default=None, description="Error message if connectivity failed")


class MLServiceHealth(BaseModel):
    """Health and readiness status of the Machine Learning forecasting engine."""
    status: str = Field(..., description="'ready', 'degraded', or 'unavailable'")
    prediction_service_initialized: bool = Field(description="Whether PredictionService is in memory")
    model_7d_loaded: bool = Field(description="Whether the 7-day EXP3 HGB model is loaded")
    model_30d_loaded: bool = Field(description="Whether the 30-day HGB model is loaded")
    model_7d_id: Optional[str] = Field(default=None, description="Experiment model ID for 7-day horizon")
    model_30d_id: Optional[str] = Field(default=None, description="Experiment model ID for 30-day horizon")
    earliest_supported_date: Optional[str] = Field(default=None, description="Earliest forecast origin date supported")
    latest_supported_date: Optional[str] = Field(default=None, description="Latest calendar date supported")
    error: Optional[str] = Field(default=None, description="Error message if ML initialization failed")


class UnifiedHealthResponse(BaseModel):
    """
    Unified system health report combining database and ML status.
    Top-level 'status' field satisfies Frontend/src/lib/api.ts HealthResponse contract.
    """
    status: str = Field(
        ...,
        description="'healthy' if both DB and ML are operational; 'degraded' if one is down; 'unhealthy' if both failed"
    )
    version: str = Field(default="1.0.0", description="Backend application version")
    timestamp: str = Field(description="ISO-8601 server check timestamp")
    database: DatabaseHealth
    ml_service: MLServiceHealth
